# Build e distribuição do app mobile — runbook

Até a BER-51, a única forma de rodar o app era via Expo Go — suficiente para demo,
não para colocar na mão de um leitor de verdade. Este documento cobre como gerar um
build instalável (TestFlight / APK) via [EAS Build](https://docs.expo.dev/build/introduction/).

> **Atualizado em 21/09/2026 (BER-51).** O caminho Android **foi rodado de verdade**. O que
> continua não feito é iOS e loja. A frase "nada aqui foi rodado de verdade", que este documento
> carregou até hoje, deixou de valer.

## Estado real

| O quê | Situação em 21/09/2026 | Evidência |
|---|---|---|
| Conta Expo (EAS) | **Existe**: `ph-tavares` (Owner) | `eas whoami` |
| Projeto EAS | **Criado**: `@ph-tavares/bereading`, id `82039f0e-aa51-479e-8413-7086e1214662` | `extra.eas.projectId` em `mobile/app.json` |
| Keystore Android | **Gerado na nuvem pela Expo** no primeiro build | log do `eas build` |
| Build Android `preview` | **Rodado** | ver histórico em expo.dev |
| EAS Update (OTA) | **Configurado**: `expo-updates` instalado, canal `preview` | `updates.url` em `app.json` |
| Apple Developer Program | **Não feito** — US$ 99/ano | — |
| Google Play Console | **Não feito** — US$ 25 (taxa única) | — |

## Pré-requisitos por plataforma

| O quê | Custo | Necessário para |
|---|---|---|
| Conta Expo (EAS) | Plano Free: 15 builds Android + 15 iOS por mês, fila de baixa prioridade | Rodar qualquer build |
| Apple Developer Program | US$ 99/ano | Build e submissão iOS — **não há alternativa** para iPhone real |
| Google Play Console | US$ 25 (taxa única) | Faixa de teste interno e publicação Android |

**Sobre testador iOS:** os "até 100 testadores internos sem revisão da Apple" do TestFlight são
*"App Store Connect users with access to your content"* — pessoas adicionadas à sua conta de
desenvolvedor. Para banca, orientador ou leitor comum o caminho é **testador externo**, e aí o
primeiro build passa por **Beta App Review**. Não confunda os dois: o prazo é diferente.

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

O perfil `preview` tem `distribution: internal`, então o Android sai como **APK** e a Expo hospeda
uma **URL de instalação** (UUID de 32 caracteres, aberta a quem tiver o link). É esse link que se
manda para o testador. No aparelho, ele precisa autorizar instalação de fonte desconhecida.

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
# eas env:create está DEPRECIADO (eas-cli 24.7.0 avisa na saída). Use env:set.
eas env:set --scope project --name EXPO_PUBLIC_SUPABASE_URL --value <url> --environment preview
eas env:set --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <publishable-key> --environment preview --visibility sensitive
```

Qual environment o build lê: a doc da Expo diz que sem o campo `environment` no perfil, o default é
`production` quando `distribution: store`, `development` quando `developmentClient: true`, e
`preview` para todo o resto. Em 21/09/2026 os dois perfis do `mobile/eas.json` passaram a declarar
`environment` **explicitamente**, para ninguém depender desse default.

Confira que resolveu antes de gastar um build:

```bash
eas env:exec preview 'node -e "console.log(process.env.EXPO_PUBLIC_SUPABASE_URL)"'
```

Apesar do nome da variável, o valor é a **publishable key** (`sb_publishable_…`), não a
`anon` legada: as chaves legadas serão desativadas (BER-76), e um build com a `anon` para de
funcionar nesse dia — e APK instalado **não se atualiza sozinho**, então cada testador teria de
reinstalar.

Medido em 21/09/2026: a publishable key se comporta igual à `anon` legada nas três superfícies que
o app usa — `GET /auth/v1/health` → 200, `GET /rest/v1/books` → 200, e em
`POST /functions/v1/get-entitlement` as duas devolvem exatamente o mesmo
`{"error":"Invalid or expired session"}` (sem chave o erro é outro: `Authentication required`).
Ou seja, é substituição direta.

Repita para `preview` se os ambientes de teste e produção usarem projetos Supabase
diferentes.

## Atualização sem novo build (EAS Update)

Desde 21/09/2026 o app tem `expo-updates`, então correção de **JavaScript** vai para o aparelho do
testador sem gerar APK novo:

```bash
cd mobile
eas update --channel preview --environment preview --message "o que mudou"
```

A flag `--environment` não é enfeite: sem ela o update não enxerga as variáveis `EXPO_PUBLIC_*`
criadas no EAS. **O update não aparece na hora** — é baixado em segundo plano na abertura do app e
entra em vigor na abertura seguinte. Avise o testador para fechar e reabrir.

**O que OTA NÃO atualiza** (doc oficial): código nativo, dependência nativa nova, permissão nova e
versão do SDK. Qualquer uma dessas exige build novo.

`runtimeVersion` usa a política **`fingerprint`** (e não `appVersion`): o hash é calculado a partir
do config e das dependências nativas, então uma mudança nativa muda o runtime e o update
simplesmente **não é oferecido** a um binário incompatível, em vez de ser entregue e quebrar. O
preço, que a doc da Expo declara, é "necessário criar builds com mais frequência". Para conferir se
a sua árvore ainda casa com um APK já distribuído:

```bash
npx expo-updates fingerprint:generate --platform android
```

## Pendências conhecidas

- **`expo-asset` não está declarado em `mobile/package.json`.** O `expo-doctor` reprova esse check
  ("Missing peer dependency: expo-asset, Required by: expo-audio"). Medido em 21/09/2026: o pacote
  **já está instalado** (`expo-asset@57.0.18`, dependência direta do `expo@57.0.24`, hoisted no topo
  do `node_modules` e autolinkado), então o crash que o doctor alerta não se aplica a esta árvore.
  Não foi declarado porque `npx expo install expo-asset` **também injeta um config plugin**, e isso
  mudou o fingerprint de `bd9ab62f…` para `08da6783…` — ou seja, invalidaria o OTA do APK que
  acabou de ser distribuído. Declare junto com o próximo build, não antes.

## O que este runbook NÃO cobre

- Submissão às lojas (`eas submit`) precisa das credenciais de cada uma (API key da
  Apple, service account JSON do Google) — não configuradas.
- Ficha da loja: descrição, screenshots, categoria, classificação etária.
- Termos de uso, política de privacidade e exclusão de conta (BER-62) — exigidos pelas
  duas lojas antes de qualquer submissão passar em revisão.
