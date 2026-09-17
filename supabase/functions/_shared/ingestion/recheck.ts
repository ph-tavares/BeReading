// supabase/functions/_shared/ingestion/recheck.ts
// Capítulo sem nenhum fato confirmado ganha nova busca depois (BER-59, spec §7): conteúdo
// sobre um livro aparece na internet com o tempo. Três tentativas espaçadas bastam para não
// pagar busca para sempre por um livro que ninguém resume.
export const RECHECK_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_RECHECKS = 3;
