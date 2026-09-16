import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  decideSource,
  detectLicense,
  type DomainPolicy,
  FULL_TEXT_MIN_WORDS,
  looksLikeLoginOrPaywall,
  type PageFacts,
  type PolicyInput,
} from './policy.ts';

const page = (over: Partial<PageFacts> = {}): PageFacts => ({
  status: 200,
  loginOrPaywall: false,
  supported: true,
  isBookFile: false,
  wordCount: 800,
  license: null,
  pageLanguage: 'pt',
  robotsAllowed: true,
  noAi: false,
  ...over,
});

const input = (over: Partial<PolicyInput> = {}): PolicyInput => ({
  domain: 'blog-de-resumos.com.br',
  domainPolicy: null,
  page: page(),
  edition: { authorDeathYear: null, firstPublicationYear: 2002, originalLanguage: 'en', publisherDomains: ['editora.com.br'] },
  currentYear: 2026,
  ...over,
});

const policy = (over: Partial<DomainPolicy>): DomainPolicy => ({
  domain: 'x.org', policy: 'allowed', weight: 'B', sourceType: 'encyclopedia', authorizesFullText: false, hostCountry: 'US', ...over,
});

const livroInteiro = page({ isBookFile: true, wordCount: FULL_TEXT_MIN_WORDS + 1 });

Deno.test('domínio bloqueado é rejeitado antes de tudo', () => {
  const d = decideSource(input({ domainPolicy: policy({ policy: 'blocked', weight: null, sourceType: null }) }));
  assertEquals([d.decision, d.reason], ['rejected', 'dominio_bloqueado']);
});

Deno.test('robots.txt ou noai rejeitam', () => {
  assertEquals(decideSource(input({ page: page({ robotsAllowed: false }) })).reason, 'robots');
  assertEquals(decideSource(input({ page: page({ noAi: true }) })).reason, 'robots');
});

Deno.test('login, paywall, 401 e 403 são acesso restrito; outro 4xx/5xx é erro_http', () => {
  assertEquals(decideSource(input({ page: page({ loginOrPaywall: true }) })).reason, 'acesso_restrito');
  assertEquals(decideSource(input({ page: page({ status: 403 }) })).reason, 'acesso_restrito');
  assertEquals(decideSource(input({ page: page({ status: 404 }) })).reason, 'erro_http');
});

Deno.test('formato ilegível e página sem texto útil são rejeitados', () => {
  assertEquals(decideSource(input({ page: page({ supported: false }) })).reason, 'formato_nao_suportado');
  assertEquals(decideSource(input({ page: page({ wordCount: 40 }) })).reason, 'sem_texto_util');
});

Deno.test('resumo em domínio fora da lista entra com peso D, tipo web', () => {
  const d = decideSource(input());
  assertEquals([d.decision, d.sourceType, d.weight], ['accepted', 'web', 'D']);
});

Deno.test('domínio da lista usa o peso e o tipo dela; editora ganha B', () => {
  const w = decideSource(input({ domain: 'wikipedia.org', domainPolicy: policy({ weight: 'B', sourceType: 'encyclopedia' }) }));
  assertEquals([w.sourceType, w.weight], ['encyclopedia', 'B']);
  const e = decideSource(input({ domain: 'editora.com.br' }));
  assertEquals([e.sourceType, e.weight], ['publisher', 'B']);
});

Deno.test('texto integral de obra protegida sem sinal de autorização é rejeitado (spec §5.4)', () => {
  const d = decideSource(input({ page: livroInteiro }));
  assertEquals([d.decision, d.reason], ['rejected', 'texto_integral_sem_autorizacao']);
});

Deno.test('texto integral em domínio público, no idioma original, é fonte A com a base registrada', () => {
  const d = decideSource(input({
    domain: 'gutenberg.net.au',
    domainPolicy: policy({ weight: 'A', sourceType: 'public_domain_text', authorizesFullText: false, hostCountry: 'AU' }),
    page: page({ isBookFile: true, wordCount: 90000, pageLanguage: 'en' }),
    edition: { authorDeathYear: 1950, firstPublicationYear: 1949, originalLanguage: 'en', publisherDomains: [] },
  }));
  assertEquals([d.decision, d.sourceType, d.weight], ['accepted', 'public_domain_text', 'A']);
  assertEquals(d.publicDomainBasis?.startsWith('BR:'), true);
});

Deno.test('tradução de obra em domínio público não passa pela regra de domínio público', () => {
  const d = decideSource(input({
    page: page({ isBookFile: true, wordCount: 90000, pageLanguage: 'pt' }),
    edition: { authorDeathYear: 1950, firstPublicationYear: 1949, originalLanguage: 'en', publisherDomains: [] },
  }));
  assertEquals(d.reason, 'texto_integral_sem_autorizacao');
});

Deno.test('texto integral com licença aberta, de repositório autorizado ou da editora é aceito como A', () => {
  assertEquals(decideSource(input({ page: page({ ...livroInteiro, license: 'creative_commons' }) })).sourceType, 'open_license_text');
  const repo = decideSource(input({
    domain: 'scielo.org',
    domainPolicy: policy({ weight: 'A', sourceType: 'open_license_text', authorizesFullText: true }),
    page: livroInteiro,
  }));
  assertEquals([repo.decision, repo.weight], ['accepted', 'A']);
  const editora = decideSource(input({ domain: 'editora.com.br', page: livroInteiro }));
  assertEquals([editora.decision, editora.sourceType, editora.weight], ['accepted', 'publisher', 'A']);
});

Deno.test('detectLicense e looksLikeLoginOrPaywall', () => {
  assertEquals(detectLicense('<a href="https://creativecommons.org/licenses/by/4.0/">CC BY</a>'), 'creative_commons');
  assertEquals(detectLicense('<p>Livro em acesso aberto</p>'), 'open_access');
  assertEquals(detectLicense('<p>Todos os direitos reservados</p>'), null);
  assertEquals(looksLikeLoginOrPaywall('<input type="password" name="senha">'), true);
  assertEquals(looksLikeLoginOrPaywall('<div>Conteúdo exclusivo para assinantes</div>'), true);
  assertEquals(looksLikeLoginOrPaywall('<p>Resumo do capítulo 3</p>'), false);
});
