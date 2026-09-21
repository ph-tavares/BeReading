-- BER-87: revoga a escrita direta do cliente em reading_sessions.
--
-- A BER-28 fechou `streaks`, `student_badges` e `answers`; a BER-58 fechou
-- `student_books`. `reading_sessions` ficou de fora, ainda com a policy
-- `FOR ALL ... USING (user_id = auth.uid())` vinda da baseline
-- (20260910210000_baseline_reconciled_from_live.sql:342). Com ela, o cliente
-- grava sessão direto via REST com a anon key + o próprio JWT, sem passar pelo
-- `register-reading-session`, contornando a validação de intervalo, a cota de
-- livros do plano gratuito (BER-58) e o cálculo de páginas novas.
--
-- Isso deixou de ser teórico depois de 11/09, porque duas coisas passaram a ler
-- esta tabela como verdade:
--   * BER-68: `pages_read` deixou de ser coluna gerada. Virou valor que o
--     servidor grava, e medalhas e estatísticas somam esse campo — inventar uma
--     sessão vira XP e medalha.
--   * BER-48: a trava do quiz no `evaluate-answer` (`_shared/progress.ts`) usa a
--     maior `end_page` das sessões — inventar uma sessão destrava quiz de
--     capítulo não lido, e com ele a cota de quiz.
--
-- O app só LÊ esta tabela (`getReadingSessions`, mobile/src/api/queries.ts:261;
-- nenhum insert/update/delete em mobile/src ou mobile/app). Quem escreve são as
-- Edge Functions com chave de servidor, que não passam pela RLS:
-- `register-reading-session` (insert) e `delete-account` (delete).
--
-- `reading_sessions_teacher_read` já é só de SELECT e fica como está.

drop policy reading_sessions_own on public.reading_sessions;
create policy reading_sessions_own on public.reading_sessions for select to authenticated
  using (user_id = auth.uid());
