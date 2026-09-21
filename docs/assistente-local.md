# Testar o assistente de leitura na sua máquina (BER-100)

Como fotografar uma página e ver o assistente responder **sem gastar crédito da API da Anthropic**:
a chamada de IA sai pelo **Claude Code CLI**, com a credencial de assinatura. É o mesmo mecanismo
que a ingestão usa (`docs/ingestao-local.md`), adaptado para o caminho que leva imagem.

**Produção não muda.** `_shared/ai.ts` continua com a credencial de API, e o `scan-page` roda aqui
exatamente como roda no servidor: a ponte entra por fora, pelo `ANTHROPIC_BASE_URL` que o módulo de
IA já aceita desde a BER-59. Nenhum arquivo de produção sabe que ela existe.

## O que isto prova, e o que não prova

| Prova | Não prova |
|---|---|
| Que o caminho inteiro funciona: câmera, corte da imagem no aparelho, upload, `scan-page`, prompt, leitura do JSON, gravação nas tabelas, tela | **O custo real por interação.** O `usage` volta zerado de propósito (ver abaixo) |
| Que a foto chega ao modelo e que ele devolve transcrição, sugestões e a página impressa | Que a resposta da API seria igual: aqui o modelo é o do Claude Code, com system prompt próprio |
| Que as sugestões saem **daquela** página, que é o primeiro critério de aceite da issue | Que o prompt é byte a byte o de produção: a ponte acrescenta uma linha mandando abrir o arquivo da foto |
| Que as recusas e falhas devolvem o código certo | Nada sobre o limite de CPU da Edge Function, que só existe no servidor |

O teste de aceitação da BER-107 (zero spoiler, zero invenção de enredo, custo real medido)
**continua exigindo o modelo de produção via API**. Isto aqui é para desenvolver, não para aprovar.

## Pré-requisitos

- `deno`, o `claude` CLI, o Supabase CLI e o Docker instalados.
- **Na sua máquina:** basta estar logado no Claude Code. Nada a configurar.
- **Em máquina sem navegador:** gere um token com `claude setup-token` e exporte
  `CLAUDE_CODE_OAUTH_TOKEN` — a variável tem precedência sobre a sessão local. Use a credencial da
  conta do time, nunca a pessoal, e jamais versione.

## 1. Subir o backend local

```bash
supabase start
supabase db reset     # aplica as migrations do zero, a do assistente inclusive
```

O `db reset` traz os 3 livros do piloto junto, então dá para testar com o 1984 na estante.

## 2. Ligar a ponte

```bash
cd supabase/functions
deno run --allow-net --allow-env --allow-run=claude --allow-read --allow-write \
  scripts/ai-bridge-local.ts
```

Ela fica ouvindo em `http://127.0.0.1:8788` e fala o protocolo da Anthropic. Cada chamada imprime o
que chegou: a ordem dos blocos, o tamanho da imagem e o modelo que respondeu.

## 3. Servir as Edge Functions apontando para ela

Crie `supabase/functions/.env` (o `.gitignore` da raiz bloqueia `*.env`):

```bash
ANTHROPIC_API_KEY=credencial-vem-do-claude-code-cli
AI_PROVIDER=anthropic
ANTHROPIC_MODEL=claude-haiku-4-5
ANTHROPIC_BASE_URL=http://host.docker.internal:8788
```

A chave é uma string qualquer: o `_shared/ai.ts` só precisa de algo para pôr no cabeçalho, e a ponte
ignora o valor. Quem autentica é o CLI.

```bash
supabase functions serve --env-file supabase/functions/.env
```

## 4. Apontar o app para a máquina

Crie `mobile/.env.local` (gitignored por `.env*.local`), com o **IP da máquina na rede**, não
`127.0.0.1` — quem abre o app é o celular:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://192.168.0.43:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<PUBLISHABLE_KEY que o `supabase start` imprimiu>
```

```bash
cd mobile && npx expo start
```

Cadastre-se (o stack local não pede confirmação de e-mail), coloque um livro em leitura, e a bolinha
aparece na Hoje. **Apague o `.env.local` quando terminar**, senão o app continua falando com a sua
máquina em vez de produção.

Se o celular não conectar, quase sempre é o firewall: libere as portas 54321 e 8081 para a rede
privada.

## Quando for usar a API de verdade

Uma linha. Em `supabase/functions/.env`:

1. **apague** a linha `ANTHROPIC_BASE_URL` — sem ela, o `_shared/ai.ts` fala com
   `https://api.anthropic.com`;
2. troque `ANTHROPIC_API_KEY` pela chave `sk-ant-` do console da Anthropic;
3. reinicie o `functions serve`, que lê o env só na subida.

A ponte pode continuar ligada, ociosa. Nada mais muda — nem no app, nem no banco, nem no código.

Custo, para dimensionar: a spec mediu **na ordem de US$ 0,005 por interação com foto** com
`claude-haiku-4-5`. Vinte fotos de teste dão cerca de dez centavos de dólar.

## Duas coisas que mentem no modo local

Valem para o modo Claude Code, e somem quando a API real entra:

- **`assistant_messages.model`** grava o que está em `ANTHROPIC_MODEL`, e não o modelo que o CLI
  realmente usou. O `_shared/ai.ts` reporta a credencial configurada, o que está certo em produção.
- **`input_tokens` e `output_tokens` ficam em zero.** É a mesma decisão do
  `_shared/ai-claude-code.ts`: os números do CLI são dominados pelo system prompt do próprio harness
  (medido em 20/09/2026, cerca de 32 mil tokens de cache numa pergunta de três palavras) e não são a
  fatura da API. Somá-los faria o custo por interação mentir.

## O isolamento, e a concessão que ele tem

O adaptador da ingestão roda com `--tools ""`: nenhuma ferramenta, porque o prompt carrega texto
raspado de sites. Aqui a entrada é uma **imagem**, e o `--print` só recebe texto no stdin — a única
forma de a foto chegar ao modelo é ele abrir o arquivo com `Read`. Então `Read` fica ligado.

A foto do leitor é entrada igualmente não confiável (spec §6.4), então o que sobra importa:
`--restricted` tira Bash, REPL e WebFetch e ignora settings de usuário, projeto e local;
`--strict-mcp-config` ignora os servidores MCP da máquina; e o `--add-dir` de cada chamada aponta
para uma pasta temporária com **um arquivo dentro**, a própria foto, apagada quando a chamada
termina. `Read` não enxerga mais nada — nem este repositório.

Quem não quiser essa concessão usa a API de verdade, onde a foto é um bloco de conteúdo e nenhuma
ferramenta existe.
