// supabase/functions/scan-page/suggestions.test.ts
// BER-100: leitura do JSON que o modelo devolve sobre a foto.
import { assertEquals, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { parseScanResult, readDetectedPage } from './suggestions.ts';

const OK = JSON.stringify({
  is_book_page: true,
  page_text: 'Quem controla o passado controla o futuro.',
  suggestions: ['o que é duplipensar', 'me explica esse trecho', 'quem é O\'Brien'],
  detected_page: 220,
});

Deno.test('parseScanResult: lê transcrição, sugestões e página', () => {
  const result = parseScanResult(OK, 328);
  assertEquals(result.isBookPage, true);
  assertEquals(result.suggestions.length, 3);
  assertEquals(result.detectedPage, 220);
  assertEquals(result.rejected, []);
});

// BER-37: resposta de LLM chega com cerca de markdown e texto em volta.
Deno.test('parseScanResult: atravessa a cerca de markdown', () => {
  const result = parseScanResult('Claro! Aqui:\n```json\n' + OK + '\n```', 328);
  assertEquals(result.detectedPage, 220);
});

// BER-38: uma sugestão estragada não pode derrubar as outras.
Deno.test('parseScanResult: descarta sugestão vazia, repetida, longa ou que não é texto', () => {
  const raw = JSON.stringify({
    is_book_page: true,
    page_text: 'trecho',
    suggestions: ['o que é duplipensar', '   ', 'o que é duplipensar', 'x'.repeat(200), 42, 'quem é O\'Brien'],
    detected_page: null,
  });
  const result = parseScanResult(raw);
  assertEquals(result.suggestions, ['o que é duplipensar', 'quem é O\'Brien']);
  assertEquals(result.rejected.length, 4);
});

Deno.test('parseScanResult: nunca devolve mais que quatro sugestões', () => {
  const raw = JSON.stringify({
    is_book_page: true,
    page_text: 'trecho',
    suggestions: ['a', 'b', 'c', 'd', 'e', 'f'],
  });
  assertEquals(parseScanResult(raw).suggestions, ['a', 'b', 'c', 'd']);
});

Deno.test('parseScanResult: a foto que não é página de livro vira recusa, não erro', () => {
  const result = parseScanResult(JSON.stringify({ is_book_page: false }));
  assertEquals(result.isBookPage, false);
  assertEquals(result.suggestions, []);
});

// Um campo ausente não pode virar "não é livro" em silêncio: isso mandaria o leitor
// fotografar a mesma página para sempre.
Deno.test('parseScanResult: só `false` explícito é recusa', () => {
  const result = parseScanResult(JSON.stringify({ page_text: 'trecho', suggestions: ['o que é isso'] }));
  assertEquals(result.isBookPage, true);
});

Deno.test('parseScanResult: sem transcrição ou sem sugestão aproveitável, é falha de IA', () => {
  assertThrows(
    () => parseScanResult(JSON.stringify({ is_book_page: true, page_text: '  ', suggestions: ['x'] })),
    Error,
    'sem transcrição',
  );
  assertThrows(
    () => parseScanResult(JSON.stringify({ is_book_page: true, page_text: 'trecho', suggestions: [] })),
    Error,
    'sem nenhuma sugestão',
  );
  assertThrows(() => parseScanResult('desculpe, não consegui ler a imagem'), Error);
});

Deno.test('parseScanResult: corta a transcrição que passa do teto pedido no prompt', () => {
  const raw = JSON.stringify({
    is_book_page: true,
    page_text: 'a'.repeat(5000),
    suggestions: ['o que é isso'],
  });
  assertEquals(parseScanResult(raw).pageText.length, 1200);
});

// O número impresso no cabeçalho de 1984 é o caso clássico de leitura errada com
// confiança — e ele viraria a oferta de "registrar até aqui" da BER-104.
Deno.test('readDetectedPage: recusa o que não é página possível', () => {
  assertEquals(readDetectedPage(220, 328), 220);
  assertEquals(readDetectedPage(1984, 328), null, 'passa do total do livro');
  assertEquals(readDetectedPage(0), null);
  assertEquals(readDetectedPage(-3), null);
  assertEquals(readDetectedPage(12.5), null);
  assertEquals(readDetectedPage('220'), null, 'texto não vira número por conta própria');
  assertEquals(readDetectedPage(null), null);
  assertEquals(readDetectedPage(1984), 1984, 'sem saber o total do livro, não dá para refutar');
});
