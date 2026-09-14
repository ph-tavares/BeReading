-- BER-29: qualquer usuário logado podia virar "professor" de si mesmo.
--
-- `teachers_own` era `ALL` (insert/update/delete incluídos) com
-- `with_check (user_id = auth.uid())`, sem restringir `school_id`. Isso permite,
-- via /rest/v1, sem passar por nenhuma tela do app:
--   1. INSERT teachers(user_id=self, school_id=<qualquer escola>)
--   2. INSERT classroom_teachers(<turma daquela escola>, self)
--   3. SELECT reading_sessions/answers/streaks/profiles de todos os alunos da
--      turma, via as policies "*_teacher_read" que confiam em `get_teacher_id()`
--
-- O mesmo buraco existe em `classroom_teachers_teacher`, que também é `ALL`.
--
-- Como o lado escola está inativo no produto B2C atual (ver BER-52), a
-- correção escolhida foi a mais simples e mais segura: revogar a
-- autoatribuição por completo, em vez de tentar validar `school_id` num
-- fluxo que ninguém usa hoje. Superfície de ataque que não existe não precisa
-- ser defendida com uma regra mais complexa. Quando a expansão escolar
-- (BER-47) voltar à pauta, a criação de `teachers`/`classroom_teachers` entra
-- por um fluxo controlado (edge function com convite validado, ou
-- provisionamento admin) — não mais por escrita direta do cliente.
--
-- A leitura da própria linha é preservada: nada que hoje depende de saber "eu
-- sou professor?" quebra.

drop policy if exists "teachers_own" on public.teachers;
create policy "teachers_own_read" on public.teachers
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "classroom_teachers_teacher" on public.classroom_teachers;
create policy "classroom_teachers_teacher_read" on public.classroom_teachers
  for select
  to authenticated
  using (teacher_id = private.get_teacher_id());
