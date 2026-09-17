// supabase/functions/_shared/ingestion/sources/openlibrary-edition.ts
// Metadado da edição para a ingestão (BER-59, passo `edition`). Além do que a BER-72 lê,
// resolve o autor (ano de morte, para domínio público), a obra (ano da primeira publicação)
// e o idioma original, estimado pelo idioma da edição mais antiga da obra.
import { HttpStatusError } from '../queue.ts';
import type { DeclaredChapter } from '../types.ts';

const BASE = 'https://openlibrary.org';

const LANGUAGES: Record<string, string> = {
  por: 'pt', eng: 'en', spa: 'es', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de', ita: 'it', jpn: 'ja', rus: 'ru',
};

export interface OpenLibraryEdition {
  title: string | null;
  authors: string[];
  authorDeathYear: number | null;
  publishers: string[];
  language: string | null;
  publishYear: number | null;
  firstPublishYear: number | null;
  workKey: string | null;
  originalLanguage: string | null;
  tableOfContents: DeclaredChapter[];
}

export function languageFromKey(key: string | undefined): string | null {
  const code = key?.split('/').pop();
  return code ? LANGUAGES[code] ?? null : null;
}

export function parseYear(value: unknown): number | null {
  const match = typeof value === 'string' ? value.match(/\b(1\d{3}|2\d{3})\b/) : null;
  return match ? Number(match[1]) : null;
}

const PART_HEADER = /^(parte|part|livro|book)\b/i;

export function parseTableOfContents(toc: unknown): DeclaredChapter[] {
  if (!Array.isArray(toc)) return [];
  const chapters: DeclaredChapter[] = [];
  let part: string | null = null;
  let inPart = 0;
  for (const entry of toc) {
    const title = typeof entry === 'string' ? entry : typeof entry?.title === 'string' ? entry.title : null;
    if (!title || !title.trim()) continue;
    if (PART_HEADER.test(title.trim())) {
      part = title.trim();
      inPart = 0;
      continue;
    }
    inPart += 1;
    chapters.push({ number: chapters.length + 1, part, numberInPart: part ? inPart : null, title: title.trim() });
  }
  return chapters;
}

export function originalLanguageFromEditions(entries: { publish_date?: string; languages?: { key: string }[] }[]): string | null {
  const dated = entries
    .map((e) => ({ year: parseYear(e.publish_date), language: languageFromKey(e.languages?.[0]?.key) }))
    .filter((e): e is { year: number; language: string } => e.year !== null && e.language !== null)
    .sort((a, b) => a.year - b.year);
  return dated[0]?.language ?? null;
}

async function getJson(url: string, fetchFn: typeof fetch): Promise<Record<string, any> | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const res = await fetchFn(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpStatusError(res.status, `Open Library ${res.status} em ${url}`);
  return await res.json();
}

export async function fetchOpenLibraryEdition(isbn: string, fetchFn: typeof fetch = fetch): Promise<OpenLibraryEdition | null> {
  const edition = await getJson(`${BASE}/isbn/${isbn}.json`, fetchFn);
  if (!edition) return null;

  const authorKeys: string[] = (edition.authors ?? [])
    .map((a: { key?: string }) => a.key)
    .filter((key: unknown): key is string => typeof key === 'string')
    .slice(0, 3);
  const authors: string[] = [];
  let authorDeathYear: number | null = null;
  for (const [i, key] of authorKeys.entries()) {
    const author = await getJson(`${BASE}${key}.json`, fetchFn);
    if (typeof author?.name === 'string') authors.push(author.name);
    if (i === 0) authorDeathYear = parseYear(author?.death_date);
  }

  const workKey: string | null = edition.works?.[0]?.key ?? null;
  let firstPublishYear: number | null = null;
  let originalLanguage: string | null = null;
  if (workKey) {
    const work = await getJson(`${BASE}${workKey}.json`, fetchFn);
    firstPublishYear = parseYear(work?.first_publish_date);
    const editions = await getJson(`${BASE}${workKey}/editions.json?limit=100`, fetchFn);
    originalLanguage = originalLanguageFromEditions(editions?.entries ?? []);
  }

  return {
    title: typeof edition.title === 'string' ? edition.title : null,
    authors,
    authorDeathYear,
    publishers: Array.isArray(edition.publishers) ? edition.publishers.filter((p: unknown) => typeof p === 'string') : [],
    language: languageFromKey(edition.languages?.[0]?.key),
    publishYear: parseYear(edition.publish_date),
    firstPublishYear,
    workKey,
    originalLanguage,
    tableOfContents: parseTableOfContents(edition.table_of_contents),
  };
}
