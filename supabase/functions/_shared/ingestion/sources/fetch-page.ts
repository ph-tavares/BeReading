// supabase/functions/_shared/ingestion/sources/fetch-page.ts
// Download de fonte (BER-59, spec §5.1 e §5.9): URL pública checada a cada salto, no máximo
// 3 redirecionamentos, 15 s, 5 MB, 1 requisição a cada 2 s por domínio e identificação
// como BeReadingBot. Extrai o texto de HTML (Readability), PDF (unpdf) ou texto puro; a
// decisão de usar ou não o texto é da política, não daqui.
import { Readability } from 'npm:@mozilla/readability@0.6.0';
import { parseHTML } from 'npm:linkedom@0.18.13';
import { extractText, getDocumentProxy } from 'npm:unpdf@1.8.1';
import { PermanentStepError } from '../queue.ts';
import { ALLOW_ALL, parseRobots, type RobotsRules, USER_AGENT } from '../robots.ts';
import { assertPublicUrl, type ResolveFn } from '../ssrf.ts';

export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_REDIRECTS = 3;
export const MAX_PDF_PAGES = 1000;
/** PDF a partir deste número de páginas é tratado como arquivo de livro. */
export const BOOK_FILE_MIN_PAGES = 40;
export const DOMAIN_INTERVAL_MS = 2_000;

export interface FetchDeps {
  fetchFn: typeof fetch;
  resolve: ResolveFn;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

export class DomainThrottle {
  private readonly last = new Map<string, number>();

  constructor(private readonly deps: Pick<FetchDeps, 'sleep' | 'now'>) {}

  async wait(host: string): Promise<void> {
    const previous = this.last.get(host);
    if (previous !== undefined) {
      const remaining = previous + DOMAIN_INTERVAL_MS - this.deps.now();
      if (remaining > 0) await this.deps.sleep(remaining);
    }
    this.last.set(host, this.deps.now());
  }
}

export interface FetchedPage {
  finalUrl: string;
  status: number;
  kind: 'html' | 'pdf' | 'text' | 'other';
  text: string;
  title: string | null;
  html: string | null;
  pdfPages: number | null;
  headers: Headers;
}

export function countWords(text: string): number {
  return (text.match(/\p{L}+/gu) ?? []).length;
}

export function htmlToText(html: string): { title: string | null; text: string } {
  // linkedom's Window type não expõe `document` nos tipos ambiente do Deno (BER-59)
  const { document } = parseHTML(html) as unknown as { document: { title?: string; body?: { textContent?: string } } };
  const title = document.title?.trim() || null;
  // deno-lint-ignore no-explicit-any
  const article = new Readability(document as any).parse();
  const text = (article?.textContent ?? document.body?.textContent ?? '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return { title, text };
}

export async function readLimited(res: Response, maxBytes: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new PermanentStepError(`corpo acima de ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function decode(bytes: Uint8Array, contentType: string): string {
  const charset = contentType.match(/charset=([^;]+)/i)?.[1]?.trim();
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

async function request(url: string, deps: FetchDeps, throttle: DomainThrottle): Promise<{ res: Response; finalUrl: string }> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = await assertPublicUrl(current, deps.resolve);
    await throttle.wait(parsed.hostname);
    const res = await deps.fetchFn(parsed.toString(), {
      redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/pdf,text/plain;q=0.9,*/*;q=0.5' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      current = new URL(location, parsed).toString();
      continue;
    }
    return { res, finalUrl: parsed.toString() };
  }
  throw new PermanentStepError(`mais de ${MAX_REDIRECTS} redirecionamentos a partir de ${url}`);
}

export async function fetchPage(url: string, deps: FetchDeps, throttle: DomainThrottle): Promise<FetchedPage> {
  const { res, finalUrl } = await request(url, deps, throttle);
  const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
  const base = { finalUrl, status: res.status, headers: res.headers, title: null, html: null, pdfPages: null };

  if (res.status >= 400) {
    await res.body?.cancel();
    return { ...base, kind: 'other', text: '' };
  }

  const bytes = await readLimited(res, MAX_BYTES);

  if (contentType.includes('application/pdf') || /\.pdf($|\?)/i.test(finalUrl)) {
    const pdf = await getDocumentProxy(bytes);
    if (pdf.numPages > MAX_PDF_PAGES) throw new PermanentStepError(`PDF com ${pdf.numPages} páginas`);
    const { text } = await extractText(pdf, { mergePages: true });
    return { ...base, kind: 'pdf', text: String(text), pdfPages: pdf.numPages };
  }

  if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
    const html = decode(bytes, contentType);
    const { title, text } = htmlToText(html);
    return { ...base, kind: 'html', text, title, html };
  }

  if (contentType.startsWith('text/plain')) {
    return { ...base, kind: 'text', text: decode(bytes, contentType) };
  }

  return { ...base, kind: 'other', text: '' };
}

const DISALLOW_ALL: RobotsRules = { isAllowed: () => false };

/** RFC 9309: robots.txt ausente (4xx) libera; servidor indisponível (5xx, rede) bloqueia. */
export async function fetchRobots(origin: string, deps: FetchDeps, throttle: DomainThrottle): Promise<RobotsRules> {
  try {
    const { res } = await request(`${origin}/robots.txt`, deps, throttle);
    if (res.status >= 500) {
      await res.body?.cancel();
      return DISALLOW_ALL;
    }
    if (res.status >= 400) {
      await res.body?.cancel();
      return ALLOW_ALL;
    }
    return parseRobots(decode(await readLimited(res, 512 * 1024), res.headers.get('content-type') ?? ''));
  } catch {
    return DISALLOW_ALL;
  }
}
