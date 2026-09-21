// supabase/functions/_shared/chapter-web-content.ts
// Conteúdo de um capítulo buscado na web na hora de gerar o quiz (BER-60/BER-59).
//
// Livro cadastrado pelo leitor não tem `book_contents`, e a ingestão verificada da BER-59 leva
// dezenas de minutos e nem sempre confirma a estrutura. Sem nada, todo capítulo caía em
// NO_CONTENT (BER-66) e o livro novo não tinha quiz nenhum. Aqui uma busca só, do capítulo que o
// leitor acabou de fechar, traz o que resumos e resenhas dizem dele. É conteúdo NÃO verificado:
// o app diz isso ao leitor, e o prompt manda usar só o que for daquele capítulo.
//
// Só o texto dos trechos vai ao prompt; nada daqui é gravado. O que fica guardado é o resumo que
// a IA escreve com as próprias palavras (ver generate-questions), para o evaluate-answer.

export interface WebChapterContent {
  text: string;
  /** Domínios de onde vieram os trechos, para o app mostrar a origem. */
  domains: string[];
}

/** Menos que isto não sustenta pergunta de compreensão: o quiz vai para as perguntas sobre a leitura. */
export const WEB_CONTENT_MIN_CHARS = 200;
/** Teto do que vai ao prompt. */
export const WEB_CONTENT_MAX_CHARS = 6000;
export const WEB_MAX_RESULTS = 6;

const GENERIC_CHAPTER_TITLE = /^cap[ií]tulo\s+\d+$/i;

/**
 * Consulta do capítulo. O título dele entra quando diz algo ("Parte 2 - Capítulo 1", "A chegada");
 * "Capítulo 3" genérico vira "capítulo 3".
 */
export function buildChapterWebQuery(
  book: { title: string; author: string },
  chapter: { number: number; title: string | null },
): string {
  const titulo = chapter.title?.trim() ?? '';
  const rotulo = titulo && !GENERIC_CHAPTER_TITLE.test(titulo) ? titulo : `capítulo ${chapter.number}`;
  return `"${book.title}" ${book.author} ${rotulo} resumo`.replace(/\s+/g, ' ').trim();
}

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Monta o conteúdo a partir da resposta do Tavily (resposta sintetizada + trechos dos resultados). */
export function webContentFromSearch(json: unknown): WebChapterContent | null {
  const body = (json ?? {}) as { answer?: unknown; results?: unknown };
  const partes: string[] = [];
  const dominios = new Set<string>();

  if (typeof body.answer === 'string' && body.answer.trim()) partes.push(body.answer.trim());
  for (const item of Array.isArray(body.results) ? body.results : []) {
    const r = item as { url?: unknown; content?: unknown };
    const trecho = typeof r.content === 'string' ? r.content.trim() : '';
    if (!trecho || partes.includes(trecho)) continue;
    partes.push(trecho);
    const dominio = typeof r.url === 'string' ? domainOf(r.url) : null;
    if (dominio) dominios.add(dominio);
  }

  const text = partes.join('\n\n').slice(0, WEB_CONTENT_MAX_CHARS);
  if (text.length < WEB_CONTENT_MIN_CHARS) return null;
  return { text, domains: [...dominios].sort() };
}

export async function searchChapterOnWeb(
  query: string,
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<WebChapterContent | null> {
  const res = await fetchFn('https://api.tavily.com/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query, search_depth: 'basic', max_results: WEB_MAX_RESULTS, include_answer: 'basic', include_raw_content: false,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return webContentFromSearch(await res.json());
}
