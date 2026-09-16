import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { detectLanguage } from './language.ts';

Deno.test('detectLanguage: português (Dom Casmurro, domínio público)', () => {
  assertEquals(detectLanguage(
    'Uma noite destas, vindo da cidade para o Engenho Novo, encontrei no trem da Central um rapaz ' +
      'aqui do bairro, que eu conheço de vista e de chapéu. Cumprimentou-me, sentou-se ao pé de mim, ' +
      'falou da lua e dos ministros, e acabou recitando-me versos.',
  ), 'pt');
});

Deno.test('detectLanguage: inglês', () => {
  assertEquals(detectLanguage(
    'It was the best of times and it was the worst of times, and the people who were there ' +
      'had everything before them, but they had nothing that was their own.',
  ), 'en');
});

Deno.test('detectLanguage: texto curto demais devolve null', () => {
  assertEquals(detectLanguage('Capítulo 1'), null);
});
