// Política de fonte (BER-59, spec §5), aplicada antes de o texto chegar à IA. Toda decisão
// vira linha em `ingestion_sources` com o motivo, para o time auditar o que foi lido e o
// que foi descartado.
//
// Texto integral é aceito de qualquer domínio com sinal de autorização (domínio público,
// licença aberta, repositório autorizado, editora). Sem sinal, texto integral de obra
// protegida é rejeitado com `texto_integral_sem_autorizacao`: a spec registra que mudar esta
// regra é decisão do time com parecer jurídico, não ajuste de código.
import { publicDomainInAny } from './public-domain.ts';
import type { SourceType, SourceWeight } from './types.ts';

export type RejectionReason =
  | 'dominio_bloqueado'
  | 'robots'
  | 'acesso_restrito'
  | 'erro_http'
  | 'formato_nao_suportado'
  | 'sem_texto_util'
  | 'texto_integral_sem_autorizacao'
  | 'endereco_nao_publico'
  // Limites do download (BER-59, spec §5.9), antes registrados só como passo falho.
  | 'arquivo_grande_demais'
  | 'pdf_paginas_demais'
  | 'redirecionamentos_demais';

export interface DomainPolicy {
  domain: string;
  policy: 'allowed' | 'blocked';
  weight: SourceWeight | null;
  sourceType: SourceType | null;
  authorizesFullText: boolean;
  hostCountry: string | null;
}

export interface PageFacts {
  status: number;
  loginOrPaywall: boolean;
  /** HTML, texto puro ou PDF legível. */
  supported: boolean;
  /** Arquivo de livro (PDF/EPUB com cara de obra inteira). */
  isBookFile: boolean;
  wordCount: number;
  license: 'creative_commons' | 'open_access' | null;
  pageLanguage: string | null;
  robotsAllowed: boolean;
  noAi: boolean;
}

export interface EditionFacts {
  authorDeathYear: number | null;
  firstPublicationYear: number | null;
  originalLanguage: string | null;
  /** Domínios registráveis oficiais da editora da edição. */
  publisherDomains: string[];
}

export interface PolicyInput {
  domain: string | null;
  domainPolicy: DomainPolicy | null;
  page: PageFacts;
  edition: EditionFacts;
  currentYear: number;
}

export interface PolicyDecision {
  decision: 'accepted' | 'rejected';
  reason: RejectionReason | null;
  sourceType: SourceType | null;
  weight: SourceWeight | null;
  publicDomainBasis: string | null;
}

/** Abaixo disto não há o que extrair de um capítulo. */
export const MIN_USEFUL_WORDS = 150;
/** Página HTML acima disto tem volume de corpo de livro, não de resumo. */
export const FULL_TEXT_MIN_WORDS = 20000;

const reject = (reason: RejectionReason): PolicyDecision => ({
  decision: 'rejected', reason, sourceType: null, weight: null, publicDomainBasis: null,
});

const accept = (sourceType: SourceType, weight: SourceWeight, publicDomainBasis: string | null = null): PolicyDecision => ({
  decision: 'accepted', reason: null, sourceType, weight, publicDomainBasis,
});

export function isFullText(page: PageFacts): boolean {
  return page.isBookFile || page.wordCount >= FULL_TEXT_MIN_WORDS;
}

export function decideSource(input: PolicyInput): PolicyDecision {
  const { domain, domainPolicy, page, edition, currentYear } = input;

  if (domainPolicy?.policy === 'blocked') return reject('dominio_bloqueado');
  if (!page.robotsAllowed || page.noAi) return reject('robots');
  if (page.loginOrPaywall || page.status === 401 || page.status === 403) return reject('acesso_restrito');
  if (page.status >= 400) return reject('erro_http');
  if (!page.supported) return reject('formato_nao_suportado');
  if (page.wordCount < MIN_USEFUL_WORDS) return reject('sem_texto_util');

  const isPublisher = domain !== null && edition.publisherDomains.includes(domain);

  if (isFullText(page)) {
    // Tradução tem direito próprio: só o texto no idioma original passa pela regra.
    const isTranslation = edition.originalLanguage === null || page.pageLanguage === null ||
      page.pageLanguage !== edition.originalLanguage;
    const pd = publicDomainInAny(['US', ...(domainPolicy?.hostCountry ? [domainPolicy.hostCountry] : [])], {
      authorDeathYear: edition.authorDeathYear,
      firstPublicationYear: edition.firstPublicationYear,
      isTranslation,
      currentYear,
    });
    if (pd.isPublicDomain) return accept('public_domain_text', 'A', pd.basis);
    if (page.license !== null) return accept('open_license_text', 'A');
    if (domainPolicy?.policy === 'allowed' && domainPolicy.authorizesFullText) {
      return accept(domainPolicy.sourceType ?? 'open_license_text', 'A', `repositório autorizado: ${domainPolicy.domain}`);
    }
    if (isPublisher || domainPolicy?.sourceType === 'publisher') return accept('publisher', 'A');
    return reject('texto_integral_sem_autorizacao');
  }

  if (domainPolicy?.policy === 'allowed' && domainPolicy.weight && domainPolicy.sourceType) {
    return accept(domainPolicy.sourceType, domainPolicy.weight);
  }
  if (isPublisher) return accept('publisher', 'B');
  return accept('web', 'D');
}

export function detectLicense(html: string): 'creative_commons' | 'open_access' | null {
  if (/creativecommons\.org\/(licenses|publicdomain)\//i.test(html)) return 'creative_commons';
  if (/\bopen access\b|\bacesso aberto\b/i.test(html)) return 'open_access';
  return null;
}

export function looksLikeLoginOrPaywall(html: string): boolean {
  if (/<input[^>]+type=["']password["']/i.test(html)) return true;
  return /(exclusivo para assinantes|assine para (ler|continuar)|subscribe to (read|continue)|subscribers only)/i.test(html);
}
