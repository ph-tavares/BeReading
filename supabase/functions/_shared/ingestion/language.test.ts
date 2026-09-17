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

Deno.test('detectLanguage: espanhol', () => {
  assertEquals(detectLanguage(
    'Una vez ella fue al mercado con sus hermanas pero cuando llegaron no había nadie y los vendedores habían cerrado sus puertas porque era muy tarde ya en el día.',
  ), 'es');
});

Deno.test('detectLanguage: francês', () => {
  assertEquals(detectLanguage(
    'Les enfants qui sont allés à l\'école pour étudier avec le professeur mais elle n\'était pas là et il n\'y avait pas de cours prévu pour eux ce jour.',
  ), 'fr');
});
