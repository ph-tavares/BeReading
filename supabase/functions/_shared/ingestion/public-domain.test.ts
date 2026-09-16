import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { isPublicDomainIn, publicDomainInAny, type PublicDomainInput } from './public-domain.ts';

const input = (over: Partial<PublicDomainInput>): PublicDomainInput => ({
  authorDeathYear: null,
  firstPublicationYear: null,
  isTranslation: false,
  currentYear: 2026,
  ...over,
});

Deno.test('BR: 70 anos contados de 1º de janeiro do ano seguinte à morte (LDA art. 41)', () => {
  // Machado de Assis morreu em 1908.
  assertEquals(isPublicDomainIn('BR', input({ authorDeathYear: 1908 })).isPublicDomain, true);
  // Orwell morreu em 1950: domínio público no Brasil desde 1º/1/2021.
  assertEquals(isPublicDomainIn('BR', input({ authorDeathYear: 1950, currentYear: 2021 })).isPublicDomain, true);
  assertEquals(isPublicDomainIn('BR', input({ authorDeathYear: 1950, currentYear: 2020 })).isPublicDomain, false);
  // Borda: morte em 1955 entra em 1º/1/2026.
  assertEquals(isPublicDomainIn('BR', input({ authorDeathYear: 1955 })).isPublicDomain, true);
  assertEquals(isPublicDomainIn('BR', input({ authorDeathYear: 1956 })).isPublicDomain, false);
});

Deno.test('BR: autor vivo ou sem data de morte não é domínio público', () => {
  assertEquals(isPublicDomainIn('BR', input({})), { isPublicDomain: false, basis: null });
});

Deno.test('US: 95 anos da publicação', () => {
  assertEquals(isPublicDomainIn('US', input({ firstPublicationYear: 1930 })).isPublicDomain, true);
  assertEquals(isPublicDomainIn('US', input({ firstPublicationYear: 1931 })).isPublicDomain, false);
  // 1984 saiu em 1949: protegido nos EUA mesmo com Orwell em domínio público no Brasil.
  assertEquals(isPublicDomainIn('US', input({ firstPublicationYear: 1949, authorDeathYear: 1950 })).isPublicDomain, false);
});

Deno.test('AU: morte antes de 1955 já é domínio público (extensão para 70 anos não retroagiu)', () => {
  assertEquals(isPublicDomainIn('AU', input({ authorDeathYear: 1950 })).isPublicDomain, true);
  assertEquals(isPublicDomainIn('AU', input({ authorDeathYear: 1960 })).isPublicDomain, false);
});

Deno.test('AU: respeita o prazo antigo (vida + 50) para morte antes de 1955', () => {
  // Morte em 1950: prazo antigo (vida + 50) expira em 2001.
  assertEquals(isPublicDomainIn('AU', input({ authorDeathYear: 1950, currentYear: 2000 })).isPublicDomain, false);
  assertEquals(isPublicDomainIn('AU', input({ authorDeathYear: 1950, currentYear: 2001 })).isPublicDomain, true);
});

Deno.test('CA: morte até 1971 já é domínio público', () => {
  assertEquals(isPublicDomainIn('CA', input({ authorDeathYear: 1971 })).isPublicDomain, true);
  assertEquals(isPublicDomainIn('CA', input({ authorDeathYear: 1972 })).isPublicDomain, false);
});

Deno.test('CA: respeita o prazo antigo (vida + 50) para morte até 1971', () => {
  // Morte em 1950: prazo antigo (vida + 50) expira em 2001.
  assertEquals(isPublicDomainIn('CA', input({ authorDeathYear: 1950, currentYear: 2000 })).isPublicDomain, false);
  assertEquals(isPublicDomainIn('CA', input({ authorDeathYear: 1950, currentYear: 2001 })).isPublicDomain, true);
});

Deno.test('tradução tem direito próprio: sem dado do tradutor, nunca é domínio público', () => {
  assertEquals(isPublicDomainIn('BR', input({ authorDeathYear: 1908, isTranslation: true })).isPublicDomain, false);
  assertEquals(isPublicDomainIn('US', input({ firstPublicationYear: 1900, isTranslation: true })).isPublicDomain, false);
});

Deno.test('publicDomainInAny: avalia o Brasil primeiro e devolve a base aplicada', () => {
  const r = publicDomainInAny(['US'], input({ authorDeathYear: 1950, firstPublicationYear: 1949 }));
  assertEquals(r.isPublicDomain, true);
  assertEquals(r.basis?.startsWith('BR:'), true);
  assertEquals(publicDomainInAny(['US'], input({ firstPublicationYear: 1949 })).isPublicDomain, false);
});
