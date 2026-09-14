// supabase/functions/_shared/progress.ts
// Progresso de leitura: uma regra só, para quem dispara o quiz e para quem o libera.
//
// BER-48: register-reading-session considera um capítulo completo quando a maior
// página registrada alcança o fim dele, e é aí que dispara a geração das perguntas.
// A trava do evaluate-answer usa exatamente a mesma conta — se as duas
// discordassem, o leitor receberia um quiz que não consegue responder, ou
// responderia um capítulo que não leu.

/** Página mais alta já alcançada nas sessões. */
export function getMaxPageReached(sessions: { end_page: number }[]): number {
  if (sessions.length === 0) return 0;
  return Math.max(...sessions.map((s) => s.end_page));
}

/** O leitor chegou ao fim deste capítulo? */
export function hasReachedChapterEnd(
  chapterEndPage: number,
  sessions: { end_page: number }[],
): boolean {
  return getMaxPageReached(sessions) >= chapterEndPage;
}
