// supabase/functions/_shared/ingestion/sources/fetch-page.ts
// Download de fonte (BER-59, spec §5.1 e §5.9): URL pública checada a cada salto, no máximo
// 3 redirecionamentos, 15 s, 5 MB, 1 requisição a cada 2 s por domínio e identificação
// como BeReadingBot. Extrai o texto de HTML (Readability), PDF (unpdf) ou texto puro; a
// decisão de usar ou não o texto é da política, não daqui.
import { Readability } from 'npm:@mozilla/readability@0.6.0';
import { parseHTML } from 'npm:linkedom@0.18.13';
import { getDocumentProxy } from 'npm:unpdf@1.8.1';
import { PermanentStepError } from '../queue.ts';
import { ALLOW_ALL, parseRobots, type RobotsRules, USER_AGENT } from '../robots.ts';
import { assertPublicUrl, type ResolveFn } from '../ssrf.ts';

export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_REDIRECTS = 3;
export const MAX_PDF_PAGES = 1000;
/** PDF a partir deste número de páginas é tratado como arquivo de livro. */
export const BOOK_FILE_MIN_PAGES = 40;
/**
 * Páginas de PDF lidas por passo (BER-59). A Edge Function tem 2 s de CPU por chamada, e extrair
 * as 384 páginas de um PDF de 1984 de uma vez gastou 1,1 a 1,8 s numa máquina local, e estourou
 * em produção. 50 páginas custam em torno de 150 ms locais; o resto vira passos seguintes.
 */
export const PDF_PAGES_PER_BATCH = 50;
export const DOMAIN_INTERVAL_MS = 2_000;

/**
 * Fonte recusada por um motivo de auditoria, não por falha (BER-59): o passo `fetch` grava a
 * fonte rejeitada com `reason` em vez de falhar o passo sem deixar linha. `isBookFile` marca o que
 * já se sabe ser arquivo de livro (PDF/EPUB grande demais), para contar em `pdfs_rejeitados`.
 */
export class SourceRejectedError extends PermanentStepError {
  constructor(readonly reason: string, message: string, readonly isBookFile = false) {
    super(message);
  }
}

/**
 * Chamado antes de cada salto, já com o endereço checado e antes de baixar (BER-59): devolve o
 * motivo para recusar (domínio bloqueado, robots.txt) ou `null`. Checar só a URL final depois do
 * download baixaria o conteúdo de um domínio bloqueado alcançado por redirecionamento.
 */
export type BeforeRequest = (url: URL) => Promise<string | null>;

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
  /** Próxima página do PDF a ler num passo seguinte; null quando o PDF acabou ou não é PDF. */
  pdfNextPage: number | null;
  headers: Headers;
}

export interface FetchOptions {
  /** Primeira página do PDF a extrair (padrão 1). */
  pdfFromPage?: number;
}

// Mesmo formato do `extractText` do unpdf com `mergePages`: quebra de linha onde o PDF marca fim
// de linha, páginas separadas por quebra de linha.
async function pdfPagesText(pdf: Awaited<ReturnType<typeof getDocumentProxy>>, from: number, to: number): Promise<string> {
  const pages: string[] = [];
  for (let n = from; n <= to; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    pages.push(content.items.map((item) => {
      const i = item as { str?: string; hasEOL?: boolean };
      return (i.str ?? '') + (i.hasEOL ? '\n' : '');
    }).join(''));
  }
  return pages.join('\n');
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
      throw new SourceRejectedError('arquivo_grande_demais', `corpo acima de ${maxBytes} bytes`);
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

async function request(
  url: string,
  deps: FetchDeps,
  throttle: DomainThrottle,
  beforeRequest?: BeforeRequest,
): Promise<{ res: Response; finalUrl: string }> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = await assertPublicUrl(current, deps.resolve);
    const reason = beforeRequest ? await beforeRequest(parsed) : null;
    if (reason) throw new SourceRejectedError(reason, `${parsed} recusada antes do download: ${reason}`);
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
  throw new SourceRejectedError('redirecionamentos_demais', `mais de ${MAX_REDIRECTS} redirecionamentos a partir de ${url}`);
}

export async function fetchPage(
  url: string,
  deps: FetchDeps,
  throttle: DomainThrottle,
  beforeRequest?: BeforeRequest,
  options: FetchOptions = {},
): Promise<FetchedPage> {
  const { res, finalUrl } = await request(url, deps, throttle, beforeRequest);
  const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
  const base = { finalUrl, status: res.status, headers: res.headers, title: null, html: null, pdfPages: null, pdfNextPage: null };

  if (res.status >= 400) {
    await res.body?.cancel();
    return { ...base, kind: 'other', text: '' };
  }

  let bytes: Uint8Array;
  try {
    bytes = await readLimited(res, MAX_BYTES);
  } catch (err) {
    // PDF/EPUB acima de 5 MB é, na prática, o arquivo do livro (BER-59): entra em `pdfs_rejeitados`.
    const bookType = contentType.includes('application/pdf') || contentType.includes('application/epub');
    if (err instanceof SourceRejectedError) throw new SourceRejectedError(err.reason, err.message, bookType);
    throw err;
  }

  if (contentType.includes('application/pdf') || /\.pdf($|\?)/i.test(finalUrl)) {
    // unpdf lança em PDF corrompido ou cifrado: isso é formato que não sabemos ler, não falha de
    // rede para repetir (BER-59), e fica registrado como fonte rejeitada.
    const unreadable = (err: unknown) =>
      new SourceRejectedError('formato_nao_suportado', `PDF ilegível: ${err instanceof Error ? err.message : String(err)}`);
    const pdf = await getDocumentProxy(bytes).catch((err) => {
      throw unreadable(err);
    });
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new SourceRejectedError('pdf_paginas_demais', `PDF com ${pdf.numPages} páginas`, true);
    }
    const from = Math.max(1, options.pdfFromPage ?? 1);
    if (from > pdf.numPages) return { ...base, kind: 'pdf', text: '', pdfPages: pdf.numPages };
    const to = Math.min(pdf.numPages, from + PDF_PAGES_PER_BATCH - 1);
    const text = await pdfPagesText(pdf, from, to).catch((err) => {
      throw unreadable(err);
    });
    return { ...base, kind: 'pdf', text, pdfPages: pdf.numPages, pdfNextPage: to < pdf.numPages ? to + 1 : null };
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
