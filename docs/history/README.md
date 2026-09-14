# Documentos históricos (arquivados)

Este diretório guarda documentos que já representaram o estado real do
projeto e deixaram de valer, mantidos só como referência de como as coisas
eram — nenhum deles deve guiar trabalho atual.

## Migrations mortas

Os 5 arquivos `20260323000001` a `...005` foram as migrations originais do
projeto. Ficaram desatualizadas em relação ao banco de produção sem que
nenhuma migration nova documentasse a mudança (pivô B2C `students` →
`profiles`, entre outras) — ver BER-31.

Não representam mais o schema real e não devem ser aplicadas. O schema atual
foi reconciliado a partir do banco vivo em `supabase/migrations/20260910210000_baseline_reconciled_from_live.sql`,
que é a fonte única da verdade a partir de 10/09/2026.

## Design spec do piloto escolar

`2026-03-23-bereading-mvp-design.md` descrevia o MVP original — piloto
escolar, dashboard de professor, roles student/teacher — que nunca existiu de
fato no código e deixou de ser o produto depois do pivô B2C oficializado em
31/08/2026 (ver BER-52). A expansão escolar fica para fase 2 (BER-47); se
voltar à pauta, este documento é o ponto de partida, mas precisa ser revisto
contra o schema real antes de valer de novo.
