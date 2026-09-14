// supabase/functions/generate-questions/claim.ts
// BER-41: quem pode gerar as perguntas de um capítulo agora.
//
// A geração era check-then-insert com uma chamada de IA de segundos no meio: dois
// leitores terminando o mesmo capítulo juntos geravam as perguntas duas vezes, e o
// quiz ficava com 8. A solução certa seria um status `generating`, mas o CHECK de
// chapter_quiz_status só aceita pending/generated/failed, e migration não chega ao
// banco hoje (BER-31). O contorno usa as colunas que existem: a tentativa "reserva"
// o capítulo gravando last_attempt_at num UPDATE condicional que só uma chamada
// consegue fazer (ver index.ts).

/** Uma tentativa em andamento segura o capítulo por este tempo. */
export const CLAIM_TTL_MS = 2 * 60 * 1000;

export interface ClaimRow {
  status: string;
  last_attempt_at: string | null;
}

/** O capítulo pode ser reivindicado por uma nova tentativa agora? */
export function isClaimable(row: ClaimRow, nowMs: number): boolean {
  if (row.status === 'generated') return false;
  if (row.last_attempt_at === null) return true;
  return Date.parse(row.last_attempt_at) < nowMs - CLAIM_TTL_MS;
}

/** O mesmo critério de `isClaimable` para o tempo, no formato do `.or()` do PostgREST. */
export function buildClaimableFilter(nowMs: number): string {
  const cutoff = new Date(nowMs - CLAIM_TTL_MS).toISOString();
  return `last_attempt_at.is.null,last_attempt_at.lt.${cutoff}`;
}
