import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { countChapterHeadings, principalLooksTruncated } from './full-text.ts';

Deno.test('countChapterHeadings: conta cabeçalhos, sem repetir o mesmo capítulo seguido', () => {
  const texto = ['CAPÍTULO I', 'Era um dia frio de abril.', 'Capítulo 2', 'Winston escreve.', 'Chapter 3', 'Fim.'].join(String.fromCharCode(10));
  assertEquals(countChapterHeadings(texto), 3);
  const comRepeticao = ['Capítulo 5', 'Capítulo 5', 'texto', 'Capítulo 6'].join(String.fromCharCode(10));
  assertEquals(countChapterHeadings(comRepeticao), 2);
  assertEquals(countChapterHeadings('Nenhum cabeçalho aqui, só o capítulo da vida dele.'), 0);
});

Deno.test('principalLooksTruncated: só acusa com diferença acima da margem', () => {
  assertEquals(principalLooksTruncated(8, 24), true);
  assertEquals(principalLooksTruncated(22, 24), false, 'formatação diferente não é truncamento');
  assertEquals(principalLooksTruncated(24, 24), false);
  assertEquals(principalLooksTruncated(24, 20), false, 'a conferência menor não acusa nada');
});
