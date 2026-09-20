# Rodar a ingestão na sua máquina (BER-59)

Como exercitar o pipeline de ingestão de conteúdo de capítulo **sem gastar crédito da API da
Anthropic**: a chamada de IA sai pelo **Claude Code CLI**, com a credencial de assinatura, pelo
cliente oficial dela. É o mesmo mecanismo que o agente do Schools Out usa.

**Produção não muda.** `_shared/ai.ts` e `production-context.ts` continuam com a credencial de API.
O Edge Runtime não abre subprocesso, então nada disto roda no servidor — é ferramenta de
desenvolvimento.

## O que isto prova, e o que não prova

| Prova | Não prova |
|---|---|
| Que o pipeline roda fim a fim: fila, passos, política de fonte, extração, confirmação cruzada, publicação, guarda de spoiler | **Qualidade do conteúdo.** O modelo aqui é o do Claude Code; produção usa `claude-haiku-4-5` |
| Que o Claude Code devolve JSON no formato que os prompts do pipeline esperam | Que a resposta da API seria igual — o Claude Code tem system prompt próprio |
| Que dá para iterar no pipeline de graça | Nada sobre o limite de 2 s de CPU da Edge Function, que só existe lá |

A aceitação registrada em 15/09/2026 na BER-59 (precisão ≥ 90%, cobertura ≥ 70%, zero spoiler)
**continua exigindo o modelo de produção via API**. Isto aqui é para desenvolver, não para aprovar.

## Pré-requisitos

- `deno` e o `claude` CLI instalados.
- **Na sua máquina:** basta estar logado no Claude Code. Nada a configurar.
- **Em máquina sem navegador (container, CI):** gere um token com `claude setup-token` e exporte
  `CLAUDE_CODE_OAUTH_TOKEN`. Verificado em 20/09/2026: a variável tem precedência sobre a sessão
  local — com um token inválido a chamada falha com `401 OAuth access token is invalid`, então não
  há risco de "passar sem querer" pela sessão logada.

```bash
export CLAUDE_CODE_OAUTH_TOKEN="$(claude setup-token)"   # nunca versionar
```

> Use a credencial **da conta do time**, não a pessoal, e guarde no gerenciador de segredos —
> mesmo padrão do `dev@schoolsout` no 1Password.

## 1. Provar que o ambiente funciona (2 minutos)

```bash
cd supabase/functions
deno run --allow-net --allow-env --allow-run=claude scripts/smoke-claude-code.ts
```

Roda duas etapas com IA real, sobre texto sintético e rede dublada, e termina em `SMOKE OK`:

1. o prompt de extração real → Claude Code → o parser real do pipeline;
2. o worker inteiro, do ISBN ao conhecimento publicado por capítulo.

Saída de uma execução de 20/09/2026:

```
--- Etapa 1: prompt de extração real -> Claude Code -> parser real ---
modelo: claude-opus-5 | 32.3s | 4131 caracteres de resposta
estrutura: 2 capítulo(s) — 1:A chegada, 2:O irmão
afirmações: 14 | descartadas pelo parser: 0
ETAPA 1: OK
--- Etapa 2: worker completo (rede dublada, IA real) ---
  fonte accepted tipo=public_domain_text peso=A grupo=obra — https://exemplo.org/texto
  fonte accepted tipo=publisher peso=B grupo=guia-exemplo.net — https://guia-exemplo.net/resumo
run: partial (capitulos_sem_confirmacao)
capítulos confirmados: 2
  cap 1: partial fatos=2
  cap 2: confirmed fatos=6
texto bruto restante: 0 (tem de ser 0)
ETAPA 2: OK
===== SMOKE OK | 5 chamadas ao Claude Code =====
```

## 2. Rodar um livro de verdade

```bash
cd supabase/functions
deno run --allow-net --allow-env --allow-read --allow-run=claude \
  scripts/ingest-local.ts --isbn=9788535914849 --sources=./fontes.json
```

Opções:

| Flag | Padrão | Para quê |
|---|---|---|
| `--isbn=` | (obrigatório) | ISBN da edição |
| `--store=memory\|supabase` | `memory` | `memory` não precisa de banco; `supabase` usa o stack local e persiste |
| `--sources=<arquivo.json>` | — | Lista de URLs, quando não houver `TAVILY_API_KEY` |
| `--book-id=<uuid>` | — | Liga a edição a um livro do catálogo |
| `--max-cycles=<n>` | `100` | Teto de ciclos do worker |

**Descoberta de fontes:** com `TAVILY_API_KEY` no ambiente, usa o Tavily — caminho idêntico ao de
produção. Sem a chave, `--sources` aponta um JSON assim:

```json
[{ "url": "https://exemplo.org/texto", "title": "Texto integral" },
 { "url": "https://guia-exemplo.net/resumo", "title": "Guia por capítulo" }]
```

**Fontes precisam ser de domínios diferentes.** Duas URLs do mesmo domínio caem no mesmo grupo de
independência e nada se confirma (spec §11, item 39). Todo texto integral da obra, venha de onde
vier, entra num grupo só.

**Com `--store=supabase`**, suba antes o stack local e exporte as variáveis:

```bash
supabase start                      # precisa da porta 54321 livre
export SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_SERVICE_ROLE_KEY=<a que o `supabase status` imprime>
```

## Diferenças de comportamento, e por quê

| Ponto | Produção | Local | Motivo |
|---|---|---|---|
| Timeout da chamada | 60 s (`AI_STEP_TIMEOUT_MS`) | 5 min (`LOCAL_AI_TIMEOUT_MS`) | Medido: uma extração pelo Claude Code passa de 60 s e o subprocesso morre com SIGTERM |
| Teto de CPU | 1 s por ciclo | sem teto (`cpuMs` = null) | Os 2 s de CPU são limite da Edge Function |
| `usage` / custo do run | tokens reais da API | **zerado** | O `usage` alimenta o teto de US$ 3, que mede a fatura da API. Aqui não há fatura, e os números do CLI são dominados pelo system prompt do harness (medido: ~32 mil tokens de cache numa pergunta de 3 palavras) |
| Avisos de operação | webhook (`OPS_ALERT_WEBHOOK_URL`) | terminal | — |

## Quando algo falha

- `credencial do Claude Code inválida ou expirada (HTTP 401)` — o passo **volta para a fila**, não
  morre. Renove com `claude setup-token` e rode de novo; o run retoma de onde parou.
- `claude CLI saiu com código 143` — SIGTERM, ou seja, timeout. Também é tratado como transitório.
- `sem_texto_util` nas fontes — a página tem menos de 150 palavras (`MIN_USEFUL_WORDS`).
- `estrutura_nao_confirmada` — nenhuma fonte declarou a lista completa de capítulos, ou duas listas
  incompatíveis se anularam.

## Arquivos

| Arquivo | O que é |
|---|---|
| `_shared/ai-claude-code.ts` | O adaptador: mesmo contrato de `callAI`, por baixo chama o CLI |
| `_shared/ingestion/local-context.ts` | Contexto de passo para uso local |
| `scripts/ingest-local.ts` | Roda um livro pelo ISBN |
| `scripts/smoke-claude-code.ts` | Prova de ambiente (não é teste de suíte: depende de modelo) |
