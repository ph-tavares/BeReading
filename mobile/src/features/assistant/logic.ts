// Regra da tela do assistente de leitura (BER-100), fora do componente para ser
// testada de verdade. Mesmo padrao dos outros logic.ts de src/features.

/**
 * Borda maior da foto que sobe para o servidor.
 *
 * A pagina inteira precisa ficar legivel para o modelo transcrever, e 1.500 px
 * e o ponto onde isso acontece sem pagar por pixel que nao muda a resposta: o
 * custo medido da interacao com foto fica na ordem de US$ 0,005 (spec, secao 7).
 * A foto de um celular atual chega com 3.000 a 4.000 px de borda maior.
 */
export const MAX_IMAGE_EDGE = 1500;

/** O que o expo-image-manipulator recebe: so um lado, para ele manter a proporcao. */
export type ResizeTarget = { width: number } | { height: number };

/**
 * Para qual tamanho reduzir, ou `null` quando a foto ja cabe.
 *
 * Passar o lado menor deixaria o maior passar de 1.500, que e justamente o
 * criterio de aceite da issue. Por isso a reducao sempre olha o maior.
 */
export function resizeTarget(width: number, height: number): ResizeTarget | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  if (Math.max(width, height) <= MAX_IMAGE_EDGE) return null;
  return width >= height ? { width: MAX_IMAGE_EDGE } : { height: MAX_IMAGE_EDGE };
}

/** O chip que identifica de onde a conversa fala: livro e, quando houver, pagina. */
export function scanChipLabel(bookTitle: string | null, page: number | null): string | null {
  if (!bookTitle) return page ? `pag. ${page}` : null;
  return page ? `${bookTitle} · pag. ${page}` : bookTitle;
}

/**
 * Os codigos de falha que o `scan-page` devolve, mais os dois que so o aparelho
 * conhece: sem internet e permissao de camera negada.
 */
export type ScanFailure =
  | 'not_a_book_page'
  | 'image_too_large'
  | 'ai_image_unsupported'
  | 'ai_unavailable'
  | 'scan_failed'
  | 'offline'
  | 'unknown';

/**
 * O que o leitor le em cada falha.
 *
 * Nenhuma delas e "erro generico" (spec, secao 7): cada caso diz o que houve e o
 * que da para fazer. E nenhuma acusa o leitor de nada, nem quando a foto nao era
 * de um livro.
 */
export function scanFailureLine(failure: ScanFailure): string {
  switch (failure) {
    case 'not_a_book_page':
      return 'Isso aí não parece página de livro. Tenta de novo com o livro aberto.';
    case 'image_too_large':
      return 'Essa foto ficou pesada demais pra enviar. Tenta de novo, um pouco mais longe da página.';
    case 'offline':
      return 'Você está sem internet agora. Tenta de novo quando voltar.';
    case 'ai_image_unsupported':
    case 'ai_unavailable':
    case 'scan_failed':
    case 'unknown':
    default:
      // O time e avisado automaticamente (notifyOps no scan-page), entao a fala
      // nao pede pro leitor reportar nada.
      return 'Não consegui ler essa foto agora. Tenta de novo daqui a pouco.';
  }
}

/** O convite do botao, que muda de acordo com o que ja se sabe do livro. */
export function scanInviteLine(bookTitle: string | null): string {
  return bookTitle
    ? `Travou em alguma página de ${bookTitle}?`
    : 'Travou em alguma página?';
}
