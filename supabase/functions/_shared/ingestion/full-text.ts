// supabase/functions/_shared/ingestion/full-text.ts
// Uma leitura do corpo da obra por run, e as demais cópias viram conferência (BER-59, spec §11,
// item 39). Ler o mesmo romance de quatro repositórios custa quatro vezes e não traz quatro
// testemunhos: traz o mesmo livro quatro vezes. A segunda cópia continua útil, mas para outra
// coisa — dizer se a primeira veio truncada —, e isso o nosso código faz sem IA.

/** Cabeçalho de capítulo: "Capítulo 3", "CAPÍTULO III", "Chapter 12", "Cap. 4". */
const CHAPTER_HEADING = /^[^\p{L}\n]{0,4}(?:cap[ií]tulo|chapter|cap\.)\s*(\d{1,3}|[ivxlc]{1,7})\b/imu;

/**
 * Quantos capítulos o texto mostra, contando cabeçalhos. É a medida de integridade da cópia: um
 * PDF truncado ou uma adaptação têm menos capítulos que o livro.
 */
export function countChapterHeadings(text: string): number {
  let total = 0;
  let previous = '';
  for (const line of text.split('\n')) {
    const match = CHAPTER_HEADING.exec(line);
    if (!match) continue;
    // Linha repetida (cabeçalho de página, sumário) não conta duas vezes seguidas.
    const current = match[1].toLowerCase();
    if (current === previous) continue;
    previous = current;
    total++;
  }
  return total;
}

/** Margem antes de desconfiar da cópia principal: diferença de capítulos que já indica falta. */
export const MISSING_CHAPTERS_MARGIN = 3;

/**
 * A cópia principal parece incompleta perto da conferência? Só acusa quando a diferença passa da
 * margem: contagem por cabeçalho varia com formatação, e acusar por um capítulo de diferença daria
 * alarme falso em toda edição.
 */
export function principalLooksTruncated(principalChapters: number, conferenceChapters: number): boolean {
  return conferenceChapters - principalChapters > MISSING_CHAPTERS_MARGIN;
}
