// supabase/functions/_shared/ingestion/sources/googlebooks.ts
// Segunda base de metadado (BER-59, passo `edition`): preenche o que a Open Library não traz.
// Só metadado; nunca o conteúdo do livro.
import { HttpStatusError } from '../queue.ts';
import { parseYear } from './openlibrary-edition.ts';

export interface GoogleBooksVolume {
  title: string | null;
  authors: string[];
  publisher: string | null;
  language: string | null;
  publishYear: number | null;
}

export async function fetchGoogleBooks(isbn: string, fetchFn: typeof fetch = fetch): Promise<GoogleBooksVolume | null> {
  const res = await fetchFn(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new HttpStatusError(res.status, `Google Books ${res.status}`);
  const json = await res.json();
  const info = json.items?.[0]?.volumeInfo;
  if (!info) return null;
  return {
    title: typeof info.title === 'string' ? info.title : null,
    authors: Array.isArray(info.authors) ? info.authors.filter((a: unknown) => typeof a === 'string') : [],
    publisher: typeof info.publisher === 'string' ? info.publisher : null,
    language: typeof info.language === 'string' ? info.language.slice(0, 2).toLowerCase() : null,
    publishYear: parseYear(info.publishedDate),
  };
}
