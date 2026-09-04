// supabase/functions/_shared/content.ts
// Contrato do caso "capítulo sem conteúdo" (BER-66), compartilhado porque três
// pontos precisam concordar sobre ele:
//   - `generate-questions` grava;
//   - `retry-pending-quizzes` usa para NÃO re-tentar;
//   - o app (`mobile/src/utils/quizStatus.ts`) usa para dizer a verdade ao leitor.

/**
 * Mínimo de caracteres para considerar que há conteúdo de capítulo utilizável.
 *
 * As 25 paráfrases do piloto (`0005_book_contents_pilot.sql`) vão de 572 a 798
 * caracteres, então 200 fica confortavelmente abaixo do menor caso legítimo e
 * ainda barra o que não sustenta 4 perguntas.
 */
export const MIN_CONTENT_CHARS = 200;

/**
 * Prefixo do `error_message` gravado em `chapter_quiz_status`.
 *
 * O status continua sendo `failed` porque o CHECK da tabela só aceita
 * ('pending','generated','failed'), e migration nova não é aplicável enquanto a
 * BER-31 não destravar o backend. O prefixo é o que distingue "faltou conteúdo"
 * de "a IA falhou" — e a diferença importa: a segunda se resolve com retry, a
 * primeira não.
 */
export const NO_CONTENT_ERROR_PREFIX = 'NO_CONTENT';

/** Há conteúdo de capítulo suficiente para gerar perguntas com lastro? */
export function hasUsableContent(text: string | null | undefined): boolean {
  return (text ?? '').trim().length >= MIN_CONTENT_CHARS;
}

/** Mensagem gravada em `error_message` — formato estável, lido pelo app. */
export function buildNoContentMessage(text: string | null | undefined): string {
  const chars = (text ?? '').trim().length;
  return `${NO_CONTENT_ERROR_PREFIX}: capítulo sem conteúdo utilizável em ` +
    `book_contents (${chars} caracteres, mínimo ${MIN_CONTENT_CHARS})`;
}
