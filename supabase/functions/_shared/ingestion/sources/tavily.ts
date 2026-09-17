// supabase/functions/_shared/ingestion/sources/tavily.ts
// Descoberta de fontes (BER-59, spec D2). Só a busca: o conteúdo das páginas é baixado pelo
// nosso fetch, que aplica robots.txt e a política antes de ler. Busca básica custa 1 crédito.
import { HttpStatusError } from '../queue.ts';

export interface SearchResult {
  url: string;
  title: string;
}

export interface SearchResponse {
  results: SearchResult[];
  credits: number;
}

export const TAVILY_MAX_RESULTS = 8;

export function normalizeResultUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith('utm_') || key === 'fbclid' || key === 'gclid') parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function tavilySearch(query: string, apiKey: string, fetchFn: typeof fetch = fetch): Promise<SearchResponse> {
  const res = await fetchFn('https://api.tavily.com/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, search_depth: 'basic', max_results: TAVILY_MAX_RESULTS, include_answer: false, include_raw_content: false }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new HttpStatusError(res.status, `Tavily ${res.status}: ${await res.text()}`);

  const json = await res.json();
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const item of Array.isArray(json.results) ? json.results : []) {
    const url = typeof item?.url === 'string' ? normalizeResultUrl(item.url) : null;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    results.push({ url, title: typeof item.title === 'string' ? item.title : '' });
  }
  return { results, credits: 1 };
}
