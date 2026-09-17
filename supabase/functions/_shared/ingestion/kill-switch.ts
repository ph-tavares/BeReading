// supabase/functions/_shared/ingestion/kill-switch.ts
// BER-59 (M3): leitura tolerante do secret `INGESTION_ENABLED`, compartilhada por `ingest-book`
// e `process-ingestion` — "false"/"0"/"off"/"no" desligam a ingestão mesmo com variação de
// caixa ou espaço em volta (quem grava o secret pode digitar "False" ou "off" sem querer).
const DISABLED_VALUES = new Set(['false', '0', 'off', 'no']);

export function ingestionDisabled(value: string | undefined): boolean {
  if (!value) return false;
  return DISABLED_VALUES.has(value.trim().toLowerCase());
}
