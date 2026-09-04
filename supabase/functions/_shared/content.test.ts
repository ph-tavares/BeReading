// supabase/functions/_shared/content.test.ts
import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  buildNoContentMessage,
  hasUsableContent,
  MIN_CONTENT_CHARS,
  NO_CONTENT_ERROR_PREFIX,
} from './content.ts';

// BER-66: conteúdo ausente não pode virar prompt com "Conteúdo: " em branco.

Deno.test('hasUsableContent: recusa ausente, vazio e só espaço', () => {
  assertEquals(hasUsableContent(undefined), false);
  assertEquals(hasUsableContent(null), false);
  assertEquals(hasUsableContent(''), false);
  assertEquals(hasUsableContent('   \n\t  '), false);
});

Deno.test('hasUsableContent: recusa conteúdo curto demais para sustentar 4 perguntas', () => {
  assertEquals(hasUsableContent('Arthur Dent acorda.'), false);
  assertEquals(hasUsableContent('x'.repeat(MIN_CONTENT_CHARS - 1)), false);
});

Deno.test('hasUsableContent: aceita a partir do mínimo', () => {
  assertEquals(hasUsableContent('x'.repeat(MIN_CONTENT_CHARS)), true);
});

Deno.test('hasUsableContent: aceita a menor paráfrase real do piloto (572 chars)', () => {
  // A 0005_book_contents_pilot.sql tem 25 paráfrases de 572 a 798 caracteres.
  // O mínimo precisa ficar confortavelmente abaixo da menor delas, senão a guarda
  // passa a barrar conteúdo legítimo — trocando um bug por outro pior.
  assertEquals(hasUsableContent('x'.repeat(572)), true);
  assert(MIN_CONTENT_CHARS < 572, 'o mínimo não pode barrar conteúdo legítimo do piloto');
});

Deno.test('hasUsableContent: ignora espaço em volta ao medir', () => {
  assertEquals(hasUsableContent('   ' + 'x'.repeat(MIN_CONTENT_CHARS) + '   '), true);
  assertEquals(hasUsableContent('   ' + 'x'.repeat(MIN_CONTENT_CHARS - 1) + '   '), false);
});

Deno.test('NO_CONTENT_ERROR_PREFIX: é estável — o cron e o app dependem dele', () => {
  // Mudar este valor sem mudar `mobile/src/utils/quizStatus.ts` e o filtro do
  // retry faz o app voltar a mostrar "deu erro" e o cron voltar a re-tentar.
  assertEquals(NO_CONTENT_ERROR_PREFIX, 'NO_CONTENT');
});

Deno.test('buildNoContentMessage: começa pelo prefixo e informa o tamanho medido', () => {
  const msg = buildNoContentMessage('   ');
  assert(msg.startsWith(NO_CONTENT_ERROR_PREFIX), `mensagem deve começar pelo prefixo: ${msg}`);
  assertStringIncludes(msg, '0 caracteres');
  assertStringIncludes(msg, String(MIN_CONTENT_CHARS));
});

Deno.test('buildNoContentMessage: aceita ausente sem quebrar', () => {
  assert(buildNoContentMessage(null).startsWith(NO_CONTENT_ERROR_PREFIX));
  assert(buildNoContentMessage(undefined).startsWith(NO_CONTENT_ERROR_PREFIX));
});
