// supabase/functions/_shared/ingestion/queries.ts
// Consultas de descoberta (BER-59, spec §3, passo `discover`). Texto integral só é procurado
// quando a obra pode estar em domínio público: procurar livro protegido inteiro gastaria
// busca com o que a política rejeitaria de qualquer jeito.
import { publicDomainInAny } from './public-domain.ts';

export interface EditionForQueries {
  title: string;
  authors: string[];
  publisher: string | null;
  authorDeathYear: number | null;
  firstPublishYear: number | null;
}

function base(edition: EditionForQueries): string {
  return `"${edition.title}" ${edition.authors[0] ?? ''}`.trim();
}

export function buildBookQueries(edition: EditionForQueries, currentYear: number): string[] {
  const b = base(edition);
  const queries = [`${b} resumo por capítulo`, `${b} capítulos`];
  if (edition.publisher) queries.push(`${b} ${edition.publisher} sumário`);
  queries.push(`${b} chapter summary`);

  const maybePublicDomain = publicDomainInAny(['US'], {
    authorDeathYear: edition.authorDeathYear,
    firstPublicationYear: edition.firstPublishYear,
    isTranslation: false,
    currentYear,
  }).isPublicDomain;
  if (maybePublicDomain) queries.push(`${b} texto integral domínio público`);

  return [...new Set(queries)];
}

export function buildChapterQuery(edition: EditionForQueries, chapter: { number: number; title: string | null }): string {
  const title = chapter.title ? ` "${chapter.title}"` : '';
  return `${base(edition)} capítulo ${chapter.number}${title} resumo`;
}
