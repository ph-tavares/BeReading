import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  assignIndependenceGroups,
  hammingDistance,
  NEAR_DUPLICATE_MAX_DISTANCE,
  registrableDomain,
  simhash,
} from './independence.ts';

// Trechos de Dom Casmurro (domínio público).
const TRECHO_1 = 'Uma noite destas, vindo da cidade para o Engenho Novo, encontrei no trem da Central ' +
  'um rapaz aqui do bairro, que eu conheço de vista e de chapéu.';
const TRECHO_2 = 'Agora que expliquei o título, passo a escrever o livro. Antes disso, porém, digamos ' +
  'os motivos que me põem a pena na mão.';

Deno.test('registrableDomain: subdomínio vira o domínio registrável', () => {
  assertEquals(registrableDomain('https://pt.wikisource.org/wiki/Dom_Casmurro'), 'wikisource.org');
  assertEquals(registrableDomain('https://www.blog.com.br/resumo'), 'blog.com.br');
  assertEquals(registrableDomain('não é url'), null);
});

Deno.test('simhash: pontuação, caixa e acento diferentes dão a mesma impressão', () => {
  const a = simhash(TRECHO_1);
  const b = simhash(TRECHO_1.toUpperCase().replaceAll(',', ' ;').replaceAll('ê', 'e'));
  assert(a !== null);
  assertEquals(a, b);
});

Deno.test('simhash: textos diferentes ficam longe', () => {
  assert(hammingDistance(simhash(TRECHO_1)!, simhash(TRECHO_2)!) > NEAR_DUPLICATE_MAX_DISTANCE);
});

Deno.test('simhash: texto curto demais não gera impressão', () => {
  assertEquals(simhash('Resumo do capítulo 1'), null);
});

Deno.test('assignIndependenceGroups: mesmo domínio é o mesmo grupo', () => {
  const groups = assignIndependenceGroups([
    { id: 's1', domain: 'blog.com', fingerprint: null },
    { id: 's2', domain: 'blog.com', fingerprint: null },
    { id: 's3', domain: 'outro.com', fingerprint: null },
  ]);
  assertEquals(groups.get('s1'), groups.get('s2'));
  assert(groups.get('s1') !== groups.get('s3'));
});

Deno.test('assignIndependenceGroups: cópia em outro domínio é o mesmo grupo, rotulado pelo menor domínio', () => {
  const groups = assignIndependenceGroups([
    { id: 's1', domain: 'zeta.com', fingerprint: 'ffffffffffffffff' },
    { id: 's2', domain: 'alfa.com', fingerprint: 'fffffffffffffffe' },
    { id: 's3', domain: 'beta.com', fingerprint: '0000000000000000' },
  ]);
  assertEquals(groups.get('s1'), 'alfa.com');
  assertEquals(groups.get('s2'), 'alfa.com');
  assertEquals(groups.get('s3'), 'beta.com');
});

Deno.test('assignIndependenceGroups: cópia liga grupos em cadeia', () => {
  const groups = assignIndependenceGroups([
    { id: 's1', domain: 'a.com', fingerprint: 'ffffffffffffffff' },
    { id: 's2', domain: 'b.com', fingerprint: 'ffffffffffffffff' },
    { id: 's3', domain: 'b.com', fingerprint: null },
  ]);
  assertEquals(groups.get('s3'), 'a.com');
});
