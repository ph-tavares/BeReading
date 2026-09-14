-- BER-68: reler um trecho já registrado somava as mesmas páginas de novo no
-- XP e nas medalhas — dava para inflar o total de páginas registrando 1-200
-- várias vezes.
--
-- `pages_read` era uma coluna GERADA (`end_page - start_page + 1`), calculada
-- pelo Postgres a partir do intervalo bruto da sessão. O backend nunca
-- escolhe esse valor — não havia onde implementar "contar só as páginas
-- novas". `ALTER COLUMN ... DROP EXPRESSION` converte a coluna para uma
-- coluna normal, preservando os valores já gravados: o histórico não muda
-- retroativamente (não tira XP nem medalha de ninguém), e a regra nova vale
-- só a partir daqui — o handler passa a calcular e gravar o valor explicitamente
-- (ver register-reading-session/reading.ts, computeNewPagesRead).

alter table public.reading_sessions
  alter column pages_read drop expression;
