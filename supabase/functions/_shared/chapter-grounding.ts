// supabase/functions/_shared/chapter-grounding.ts
// Liga o conhecimento verificado da ingestão (BER-59) ao quiz do app. O que chega aqui é só o
// capítulo que o leitor acabou de fechar — nunca um capítulo adiante —, pela mesma leitura que a
// spec reserva para consumo (`getKnowledgeUpTo`, spec §6.4, guarda 3).
//
// O catálogo do app e a edição ingerida numeram capítulos de jeitos diferentes: o 1984 do app tem
// 9 capítulos ("Parte 2 - Capítulo 1"), a edição tem 24 (a parte recomeça a contagem). Por isso a
// ponte é pelo rótulo "Parte X - Capítulo Y" e, sem ele, só vale quando as duas contagens batem.
// Na dúvida, não há conhecimento: o quiz segue com o conteúdo do catálogo, como antes.
import { getKnowledgeUpTo } from './ingestion/knowledge.ts';
import { partsOf } from './ingestion/locate.ts';
import type { KnowledgeFact, KnowledgeRow } from './ingestion/store.ts';
import type { EditionChapter } from './ingestion/types.ts';
import type { createServiceClient } from './supabase-client.ts';

type Db = ReturnType<typeof createServiceClient>;

/** Capítulo com menos fatos que isto não sustenta pergunta; o quiz fica só com o catálogo. */
export const MIN_GROUNDING_FACTS = 2;
/** Teto de fatos no prompt: o capítulo 1 do 1984 tem 38, e o prompt não precisa de todos. */
export const MAX_GROUNDING_FACTS = 20;

export interface ChapterGrounding {
  editionChapterNumber: number;
  status: 'confirmed' | 'partial';
  facts: KnowledgeFact[];
  domains: string[];
}

/** O que vai para `chapter_quiz_status.grounding`, lido pelo app. Sem texto de fato: só contagem e origem. */
export interface GroundingSummary {
  fontes: number;
  dominios: string[];
  fatos: number;
  status: 'confirmed' | 'partial';
}

const PARTE_CAPITULO = /parte\s+(\d+)\D+?cap[ií]tulo\s+(\d+)/i;

/**
 * Capítulo da edição que corresponde ao capítulo do app, ou null quando não dá para ter certeza.
 * "Parte 2 - Capítulo 1" vira o primeiro capítulo da segunda parte da edição.
 */
export function editionChapterForAppChapter(
  appChapter: { number: number; title: string | null },
  appChapterCount: number,
  editionChapters: EditionChapter[],
): number | null {
  const rotulo = PARTE_CAPITULO.exec(appChapter.title ?? '');
  if (rotulo) {
    const parte = partsOf(editionChapters)[Number(rotulo[1]) - 1];
    const dentro = Number(rotulo[2]);
    const capitulo = parte?.find((c) => (c.numberInPart ?? c.number) === dentro);
    return capitulo?.number ?? null;
  }
  const mesmaContagem = editionChapters.length > 0 && editionChapters.length === appChapterCount;
  return mesmaContagem && editionChapters.some((c) => c.number === appChapter.number) ? appChapter.number : null;
}

/** Só o capítulo pedido, e só com conhecimento publicado que sustente pergunta. */
export function groundingFromKnowledge(
  rows: KnowledgeRow[],
  editionChapterNumber: number,
  domains: string[],
): ChapterGrounding | null {
  const row = rows.find((r) => r.chapterNumber === editionChapterNumber);
  if (!row || row.status === 'insufficient') return null;
  const facts = [...row.facts]
    // Fato antes de interpretação, e o mais confiável primeiro.
    .sort((a, b) => Number(a.isInterpretation) - Number(b.isInterpretation) || b.confidence - a.confidence)
    .slice(0, MAX_GROUNDING_FACTS);
  if (facts.length < MIN_GROUNDING_FACTS) return null;
  return { editionChapterNumber, status: row.status, facts, domains: [...new Set(domains)].sort() };
}

/** Bloco que entra no prompt junto com o conteúdo do catálogo. */
export function groundingText(grounding: ChapterGrounding): string {
  const linhas = grounding.facts.map((f) => `- ${f.statement}${f.isInterpretation ? ' (interpretação)' : ''}`);
  return `Fatos deste capítulo, confirmados em fontes independentes:\n${linhas.join('\n')}`;
}

export function groundingSummary(grounding: ChapterGrounding): GroundingSummary {
  return { fontes: grounding.domains.length, dominios: grounding.domains, fatos: grounding.facts.length, status: grounding.status };
}

function must<T>(result: { data: T | null; error: { message: string } | null }, context: string): T {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data as T;
}

/**
 * Conhecimento verificado do capítulo do app, ou null. Consultas simples, uma tabela por vez: é
 * caminho do quiz, e a leitura precisa ser fácil de conferir contra o banco.
 */
export async function loadChapterGrounding(
  db: Db,
  chapter: { bookId: string; number: number; title: string | null },
): Promise<ChapterGrounding | null> {
  const edicoes = must(
    await db.from('book_editions').select('id').eq('book_id', chapter.bookId).order('created_at', { ascending: false }).limit(1),
    'book_editions',
  ) as { id: string }[];
  const edicao = edicoes[0];
  if (!edicao) return null;

  const capitulosDaEdicao = (must(
    await db.from('edition_chapters').select('id, number, part_label, number_in_part, title').eq('edition_id', edicao.id),
    'edition_chapters',
  ) as { id: string; number: number; part_label: string | null; number_in_part: number | null; title: string | null }[])
    .map((c) => ({ id: c.id, number: c.number, partLabel: c.part_label, numberInPart: c.number_in_part, title: c.title }));
  const capitulosDoApp = must(await db.from('chapters').select('id').eq('book_id', chapter.bookId), 'chapters') as { id: string }[];

  const numero = editionChapterForAppChapter(chapter, capitulosDoApp.length, capitulosDaEdicao);
  if (numero === null) return null;
  const capituloDaEdicao = capitulosDaEdicao.find((c) => c.number === numero)!;

  const conhecimento = must(
    await db.from('chapter_knowledge').select('id, status, confidence, summary, recheck_count').eq('edition_chapter_id', capituloDaEdicao.id),
    'chapter_knowledge',
  ) as { id: string; status: KnowledgeRow['status']; confidence: number; summary: string; recheck_count: number }[];
  const linha = conhecimento[0];
  if (!linha) return null;

  const fatos = must(
    await db.from('chapter_facts').select('id, kind, statement, is_interpretation, confidence').eq('chapter_knowledge_id', linha.id),
    'chapter_facts',
  ) as { id: string; kind: KnowledgeFact['kind']; statement: string; is_interpretation: boolean; confidence: number }[];
  const fontesDosFatos = fatos.length === 0 ? [] : must(
    await db.from('chapter_fact_sources').select('source_id').in('fact_id', fatos.map((f) => f.id)),
    'chapter_fact_sources',
  ) as { source_id: string }[];
  const ids = [...new Set(fontesDosFatos.map((f) => f.source_id))];
  const dominios = ids.length === 0 ? [] : (must(
    await db.from('ingestion_sources').select('registrable_domain').in('id', ids),
    'ingestion_sources',
  ) as { registrable_domain: string | null }[]).map((s) => s.registrable_domain).filter((d): d is string => !!d);

  const rows: KnowledgeRow[] = [{
    chapterNumber: numero, partLabel: capituloDaEdicao.partLabel, numberInPart: capituloDaEdicao.numberInPart,
    title: capituloDaEdicao.title, status: linha.status, confidence: Number(linha.confidence), summary: linha.summary,
    recheckCount: linha.recheck_count,
    facts: fatos.map((f) => ({ kind: f.kind, statement: f.statement, isInterpretation: f.is_interpretation, confidence: Number(f.confidence) })),
  }];
  // A guarda de spoiler da spec vale aqui também: só capítulos até o que o leitor fechou.
  const ateAqui = await getKnowledgeUpTo({ listKnowledge: () => Promise.resolve(rows) }, edicao.id, numero);
  return groundingFromKnowledge(ateAqui, numero, dominios);
}

/**
 * Texto do catálogo mais os fatos verificados, para quem avalia a resposta (`evaluate-answer`): a
 * pergunta pode ter saído desses fatos. Falha na leitura devolve só o catálogo, como antes.
 */
export async function contentWithGrounding(
  db: Db,
  catalogText: string,
  chapter: { bookId: string | null; number: number | null; title: string | null },
): Promise<string> {
  if (!chapter.bookId || chapter.number === null) return catalogText;
  try {
    const grounding = await loadChapterGrounding(db, { bookId: chapter.bookId, number: chapter.number, title: chapter.title });
    return [catalogText.trim(), grounding ? groundingText(grounding) : ''].filter(Boolean).join('\n\n');
  } catch (err) {
    console.error(`[chapter-grounding] conhecimento verificado indisponível: ${err}`);
    return catalogText;
  }
}
