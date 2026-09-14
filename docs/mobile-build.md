# Build e distribuição do app mobile — runbook

Até a BER-51, a única forma de rodar o app era via Expo Go — suficiente para demo,
não para colocar na mão de um leitor de verdade. Este documento cobre como gerar um
build instalável (TestFlight / APK) via [EAS Build](https://docs.expo.dev/build/introduction/).

**Nada aqui foi rodado de verdade.** Não existe conta EAS, conta de desenvolvedor
Apple/Google, nem os secrets abaixo configurados neste projeto ainda — o que existe é
a configuração (`mobile/eas.json`, o workflow) e este runbook, prontos para quando
alguém com essas contas assumir o próximo passo.

## Pré-requisitos (ainda não feitos)

| O quê | Custo | Necessário para |
|---|---|---|
| Conta Expo (EAS) | Grátis para o volume de um piloto | Rodar qualquer build |
| Apple Developer Program | US$ 99/ano | Build e submissão iOS |
| Google Play Console | US$ 25 (taxa única) | Build e submissão Android |

**Antes do primeiro build de loja**, o `bundleIdentifier`/`package` em `mobile/app.json`
precisa deixar de ser `com.anonymous.bereading` — é o placeholder do scaffold, nenhuma
loja aceita publicação sob `com.anonymous.*`, e trocar **depois** de publicar cria um
app novo (perde instalações, avaliações). Ver BER-62. Escolher o identificador
definitivo não é decisão técnica — fica para quem definir isso no projeto.

## Perfis (`mobile/eas.json`)

| Perfil | Distribuição | Uso |
|---|---|---|
| `preview` | Interna (ad-hoc / APK direto) | Testar num aparelho real sem passar pela loja — o equivalente ao "piloto" |
| `production` | Loja (`eas submit`) | TestFlight → App Store; Play Console (faixa interna/produção) |

## Como rodar

**Local** (precisa de `npm install -g eas-cli` e `eas login`):

```bash
cd mobile
eas build --profile preview --platform android   # ou ios / all
```

**Via GitHub Actions** (`.github/workflows/mobile-build.yml`, disparo manual):

Actions → **Mobile Build** → **Run workflow** → escolher `profile` e `platform`.
Só funciona depois do secret `EXPO_TOKEN` existir no repositório (Settings → Secrets
and variables → Actions). Sem ele, o passo de autenticação falha sem custo nenhum —
o workflow existe pronto, mas fica inerte até alguém configurar a conta.

Diferente do deploy do backend (BER-50), este workflow **não** dispara sozinho a cada
merge: cada build consome cota do plano EAS, e gerar um instalável não é algo que deva
sair sem alguém decidir que é a hora — por isso só `workflow_dispatch`.

## Variáveis de ambiente do build

O app usa `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` em runtime (ver
`README.md`). Para builds via EAS, configure-as no projeto (não neste repositório):

```bash
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value <url> --environment production
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key> --environment production
```

Repita para `preview` se os ambientes de teste e produção usarem projetos Supabase
diferentes.

## O que este runbook NÃO cobre

- Submissão às lojas (`eas submit`) precisa das credenciais de cada uma (API key da
  Apple, service account JSON do Google) — não configuradas.
- Ficha da loja: descrição, screenshots, categoria, classificação etária.
- Termos de uso, política de privacidade e exclusão de conta (BER-62) — exigidos pelas
  duas lojas antes de qualquer submissão passar em revisão.
