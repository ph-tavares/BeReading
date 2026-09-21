import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  editionChapterForAppChapter,
  groundingFromKnowledge,
  groundingSummary,
  groundingText,
  MAX_GROUNDING_FACTS,
} from './chapter-grounding.ts';
import type { KnowledgeRow } from './ingestion/store.ts';
import type { EditionChapter } from './ingestion/types.ts';

// Estrutura real da edição do 1984 em produção: 8 + 10 + 6, sem rótulo de parte.
const EDICAO_1984: EditionChapter[] = Array.from({ length: 24 }, (_, i) => ({
  id: `c${i + 1}`, number: i + 1, partLabel: null, title: null,
  numberInPart: i < 8 ? i + 1 : i < 18 ? i - 7 : i - 17,
}));

Deno.test('editionChapterForAppChapter: "Parte X - Capítulo Y" do app vira o capítulo da edição', () => {
  const para = (title: string) => editionChapterForAppChapter({ number: 0, title }, 9, EDICAO_1984);
  assertEquals(para('Parte 1 - Capítulo 1'), 1);
  assertEquals(para('Parte 1 - Capítulo 4'), 4);
  assertEquals(para('Parte 2 - Capítulo 1'), 9);
  assertEquals(para('Parte 2 - Capítulo 3'), 11);
  assertEquals(para('Parte 3 - Capítulo 2'), 20);
  // Capítulo que a edição não tem, ou parte que não existe: sem conhecimento.
  assertEquals(para('Parte 1 - Capítulo 9'), null);
  assertEquals(para('Parte 4 - Capítulo 1'), null);
});

Deno.test('editionChapterForAppChapter: sem rótulo de parte, só com a mesma contagem de capítulos', () => {
  const tres = EDICAO_1984.slice(0, 3).map((c) => ({ ...c, numberInPart: null }));
  assertEquals(editionChapterForAppChapter({ number: 2, title: 'O irmão' }, 3, tres), 2);
  // O app tem 9 capítulos e a edição 24: número igual não quer dizer capítulo igual.
  assertEquals(editionChapterForAppChapter({ number: 2, title: 'Capítulo 2' }, 9, EDICAO_1984), null);
  assertEquals(editionChapterForAppChapter({ number: 1, title: null }, 1, []), null);
});

const fato = (statement: string, over: Partial<KnowledgeRow['facts'][number]> = {}) =>
  ({ kind: 'event' as const, statement, isInterpretation: false, confidence: 0.9, ...over });
const linha = (chapterNumber: number, over: Partial<KnowledgeRow> = {}): KnowledgeRow => ({
  chapterNumber, partLabel: null, numberInPart: null, title: null, status: 'confirmed', confidence: 0.9,
  summary: '', recheckCount: 0, facts: [fato('Winston compra um diário.'), fato('Winston escreve a data.')], ...over,
});

Deno.test('groundingFromKnowledge: usa só o capítulo pedido, fato antes de interpretação', () => {
  const g = groundingFromKnowledge([
    linha(10, { facts: [fato('Tema: vigilância.', { isInterpretation: true, confidence: 1 }), fato('Julia marca o encontro.', { confidence: 0.8 })] }),
    linha(11),
  ], 10, ['wikipedia.org', 'uol.com.br', 'wikipedia.org']);
  assertEquals(g?.facts.map((f) => f.statement), ['Julia marca o encontro.', 'Tema: vigilância.']);
  assertEquals(g?.domains, ['uol.com.br', 'wikipedia.org']);
  assertEquals(groundingSummary(g!), { fontes: 2, dominios: ['uol.com.br', 'wikipedia.org'], fatos: 2, status: 'confirmed' });
  assertEquals(groundingText(g!).split('\n'), [
    'Fatos deste capítulo, confirmados em fontes independentes:',
    '- Julia marca o encontro.',
    '- Tema: vigilância. (interpretação)',
  ]);
});

Deno.test('groundingFromKnowledge: insuficiente, sem o capítulo ou com fato de menos não serve', () => {
  assertEquals(groundingFromKnowledge([linha(1, { status: 'insufficient' })], 1, []), null);
  assertEquals(groundingFromKnowledge([linha(2)], 1, []), null);
  assertEquals(groundingFromKnowledge([linha(1, { facts: [fato('Só um.')] })], 1, []), null);
});

Deno.test('groundingFromKnowledge: limita os fatos que vão ao prompt', () => {
  const muitos = Array.from({ length: 38 }, (_, i) => fato(`Fato ${i}.`));
  assertEquals(groundingFromKnowledge([linha(1, { facts: muitos })], 1, [])?.facts.length, MAX_GROUNDING_FACTS);
});
