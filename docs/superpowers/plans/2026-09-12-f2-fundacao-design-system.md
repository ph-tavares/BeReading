# F2 Fundação: design system, progresso e assistente — plano de implementação

> **Para executores:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** construir a fundação do redesign — tokens, tipografia, primitivos de UI, camada de progresso (XP, sequência, conquistas), assistente e guardas automatizadas — sem alterar nenhuma tela ainda.

**Arquitetura:** módulos puros e testados (`src/theme`, `src/game`, `src/assistant`) alimentam primitivos de apresentação (`src/ui`) construídos sobre `StyleSheet.create` e Reanimated 4. Nada de NativeWind. Nenhum valor visual existe fora de `src/theme/tokens.ts`, e isso é verificado por teste.

**Stack:** Expo 54 · React Native 0.81 · TypeScript strict · Reanimated 4 · expo-image · expo-haptics · Jest (jest-expo)

**Spec:** `docs/superpowers/specs/2026-09-11-premium-ui-redesign-design.md` (leia antes de começar; o plano argumenta a partir dela)

**Fase:** F2 de 9. As fases F3 a F9 ganham planos próprios, escritos antes de cada execução.

## Restrições globais

Valem para toda tarefa deste plano.

- **Branch:** `feature/premium-ui-redesign`. Todos os comandos rodam de `mobile/`.
- **Sem push e sem PR.** Commits locais apenas. Push só com pedido explícito do Breq.
- **Nenhuma alteração em `supabase/`**, em migrations, na API ou em regra de negócio.
- **Nenhuma tela (`app/**`) muda nesta fase**, exceto `app/_layout.tsx` na Tarefa 3 (fontes e splash).
- **Nada de dependência nova fora da lista da Tarefa 1.** Instalação sempre por `npx expo install`.
- **Regressão:** ao fim de cada tarefa, `npx jest` e `npx tsc --noEmit` passam. A base é **164 testes em 23 suítes**; o número só cresce.
- **Cor:** todo valor vem de `src/theme/tokens.ts`. Proibido hex, `rgb()` ou `rgba()` literal em `src/ui`, `src/features` ou `app`.
- **Tipografia:** todo texto usa uma variante de `type`. Proibido `fontSize` literal fora de `tokens.ts`. Piso de 12.
- **Copy:** português do Brasil, voz de 18–24 anos (§3.5 da spec). **Zero emoji** em texto de interface. Sem travessão (— –). Caixa de frase, nunca maiúsculas espaçadas.
- **Acessibilidade:** todo tocável tem `accessibilityRole` e `accessibilityLabel`. Alvo mínimo 44×44.
- **Comentário explica o porquê, não o quê**, no estilo do repo (veja `src/utils/quizAnswers.ts`). Em português.
- **Commits:** `<tipo>(BER-77): <o que muda>`, com a linha de atribuição:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `mobile/DESIGN.md` | contrato de marca legível (9 seções do padrão da Wiki) |
| `src/theme/tokens.ts` | **fonte única** de cor, espaço, raio, tipo, motion e elevação |
| `src/theme/fonts.ts` | carga de Newsreader e Hanken Grotesk |
| `src/theme/coverPalette.ts` | cor determinística da capa gerada, por `book.id` |
| `src/game/xp.ts` | XP e nível derivados de dado persistido |
| `src/game/streak.ts` | sequência efetiva, semana e risco, no fuso de São Paulo |
| `src/game/badges.ts` | ícone e progresso por `criteria_type` real |
| `src/assistant/persona.ts` | nome e identidade do assistente (constante única) |
| `src/assistant/lines.ts` | falas templated por estado, puras |
| `src/assistant/Glyph.tsx` | marcador âmbar (SVG) |
| `src/ui/Text.tsx` | texto por variante tipográfica |
| `src/ui/Button.tsx`, `IconButton.tsx` | ação, com todos os estados |
| `src/ui/Field.tsx`, `PageField.tsx` | entrada de texto e de página |
| `src/ui/Chip.tsx`, `Segmented.tsx` | seleção |
| `src/ui/Cover.tsx` | capa gerada, com capa real por cima quando houver |
| `src/ui/Ring.tsx`, `ProgressBar.tsx` | progresso |
| `src/ui/Skeleton.tsx`, `EmptyState.tsx`, `Banner.tsx` | estados de carga, vazio e erro |
| `src/ui/ListRow.tsx` | linha de lista com divisória (no lugar de card) |
| `src/ui/Toast.tsx` | toast e `ToastProvider`, no lugar de `Alert.alert` |
| `__tests__/guards/*.test.ts` | anti-patterns como teste |

Os componentes antigos de `src/components/` **continuam existindo e funcionando** durante toda a F2. Eles só são removidos quando a última tela deixar de usá-los, na F6.

---

## Tarefa 1: Alinhar dependências com o Expo Go do SDK 54

**Por quê:** `react-native-worklets` está em 0.8.1 e o Expo Go do SDK 54 traz o nativo **0.5.1**. Hoje ninguém usa Reanimated, então não quebra. Na primeira animação, o app quebra no aparelho com erro de versão entre JS e nativo. O Reanimated 4.1.7 aceita worklets `0.5 - 0.8`, então o downgrade é seguro.

**Arquivos:**
- Modifica: `mobile/package.json`, `mobile/package-lock.json`

**Interfaces:**
- Consome: nada
- Produz: `expo-image`, `expo-linear-gradient`, `expo-splash-screen`, `@expo-google-fonts/newsreader` e `@expo-google-fonts/hanken-grotesk` disponíveis para as tarefas seguintes

- [ ] **Passo 1: Registrar o estado atual**

```bash
cd C:/Users/guiro/bereading-redesign/mobile
npx expo install --check
```

Esperado: o comando aponta `react-native-worklets@0.8.1 - expected version: 0.5.1`.

- [ ] **Passo 2: Corrigir a versão do worklets**

```bash
npx expo install react-native-worklets@0.5.1
```

- [ ] **Passo 3: Instalar as dependências novas**

```bash
npx expo install expo-image expo-linear-gradient expo-splash-screen @expo-google-fonts/newsreader @expo-google-fonts/hanken-grotesk
```

Todas são oficiais do SDK 54 e existem no Expo Go, então o app continua abrindo sem build próprio.

- [ ] **Passo 4: Verificar que não sobrou divergência**

```bash
npx expo install --check
```

Esperado: nenhuma divergência de versão. Se aparecer outra, corrija com `npx expo install <pacote>` e rode de novo.

- [ ] **Passo 5: Verificar que nada regrediu**

```bash
npx jest --silent
npx tsc --noEmit
```

Esperado: **164 passed / 23 suítes** e 0 erro de tipo.

- [ ] **Passo 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(BER-77): alinhar worklets com o Expo Go do SDK 54 e instalar deps da fundação

react-native-worklets estava em 0.8.1 e o Expo Go do SDK 54 traz o nativo
0.5.1. Sem Reanimated em uso isso não quebrava; com o motion do redesign,
quebraria no aparelho. Reanimated 4.1.7 aceita 0.5 - 0.8.

Entram expo-image, expo-linear-gradient, expo-splash-screen e as duas
famílias de fonte, todas presentes no Expo Go.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 2: Tokens como fonte única, com contraste verificado por teste

**Por quê:** hoje são 26 tamanhos de fonte, 17 valores de letter-spacing e 15 literais de cor espalhados pelas telas. O token deixa de ser sugestão e passa a ser a única fonte, com o contraste medido em vez de estimado.

**Arquivos:**
- Cria: `mobile/src/theme/tokens.ts` (substitui o conteúdo do arquivo atual)
- Cria: `mobile/__tests__/theme/tokens.test.ts`
- Modifica: `mobile/package.json` (bloco `jest`)

**Interfaces:**
- Consome: nada
- Produz:
  - `color`: objeto com `bg`, `surface1`, `surface2`, `surface3`, `floating`, `line`, `line2`, `text`, `text2`, `text3`, `accent`, `accentInk`, `accentSoft`, `positive`, `positiveSoft`, `danger`, `dangerSoft`
  - `space`: `{ xs:4, sm:8, md:12, lg:16, gutter:20, xl:24, xxl:32, xxxl:40, huge:48 }`
  - `radius`: `{ tag:6, chip:10, control:14, card:20, sheet:28, pill:999 }`
  - `type`: mapa de `TypeVariant` → `{ fontFamily, fontSize, lineHeight, letterSpacing?, fontVariant? }`
  - `TypeVariant`: `'display' | 'title' | 'heading' | 'subhead' | 'body' | 'reading' | 'callout' | 'label' | 'caption' | 'button' | 'numericXL' | 'numericL' | 'numericM'`
  - `motion`: `{ press, enter, exit, stagger, count, skeleton }`
  - `elevation`: `{ flat, surface, floating }`
  - `fontFamily`: `{ serif, serifItalic, serifMedium, ui, uiMedium, uiSemi, uiBold }`
  - `COVER_INK`: `'#F6E9D4'`
  - `hitSlop`, `MIN_TOUCH: 44`

**IMPORTANTE:** o `tokens.ts` atual exporta `colors`, `radii`, `fonts`, `brandTriplet` e `BrandColor`, usados por 21 componentes e 13 telas. **Mantenha esses exports antigos intactos no mesmo arquivo**, marcados como legado, para não quebrar nada. Eles saem na F6, quando a última tela parar de usá-los.

- [ ] **Passo 1: Ampliar o testMatch do Jest para as pastas novas**

Em `mobile/package.json`, no bloco `jest.projects`, troque os dois `testMatch`. O projeto `node` passa a pegar todo teste `.ts` e o `react-native` todo teste `.tsx`, o que dispensa listar pasta por pasta a cada módulo novo:

```json
"testMatch": [
  "<rootDir>/__tests__/**/*.test.ts"
]
```

no projeto `node` (substituindo a lista de 4 caminhos), e no projeto `react-native`:

```json
"testMatch": [
  "<rootDir>/__tests__/**/*.test.tsx"
]
```

- [ ] **Passo 2: Escrever o teste que falha**

Crie `mobile/__tests__/theme/tokens.test.ts`:

```ts
import { color, space, radius, type, motion, COVER_PALETTE_COLORS, COVER_INK } from '../../src/theme/tokens';

/** Contraste WCAG 2.1 entre duas cores hex opacas. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const v = hex.replace('#', '');
    const ch = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
    const [r, g, bl] = ch.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const SURFACES = [color.bg, color.surface1, color.surface2];

describe('tokens · contraste', () => {
  it.each([['text', color.text], ['text2', color.text2], ['text3', color.text3]])(
    '%s passa em AA (4.5) sobre bg, surface1 e surface2',
    (_name, fg) => {
      for (const surface of SURFACES) {
        expect(contrast(fg, surface)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it.each([['accent', color.accent], ['positive', color.positive], ['danger', color.danger]])(
    '%s passa em AA sobre as superfícies',
    (_name, fg) => {
      for (const surface of SURFACES) {
        expect(contrast(fg, surface)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('accentInk é legível sobre accent (texto do botão primário)', () => {
    expect(contrast(color.accentInk, color.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('o creme da capa é legível sobre toda a paleta de capas', () => {
    for (const c of COVER_PALETTE_COLORS) {
      expect(contrast(COVER_INK, c)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('tokens · escalas', () => {
  it('todo espaço é múltiplo de 4', () => {
    for (const v of Object.values(space)) expect(v % 4).toBe(0);
  });

  it('nenhuma variante tipográfica fica abaixo de 12', () => {
    for (const v of Object.values(type)) expect(v.fontSize).toBeGreaterThanOrEqual(12);
  });

  it('toda variante tipográfica declara lineHeight', () => {
    for (const v of Object.values(type)) expect(v.lineHeight).toBeGreaterThan(0);
  });

  it('a saída é mais rápida que a entrada (regra de motion da Wiki)', () => {
    expect(motion.exit.duration).toBeLessThan(motion.enter.duration);
  });

  it('o raio do card é maior que o do controle', () => {
    expect(radius.card).toBeGreaterThan(radius.control);
  });
});
```

- [ ] **Passo 3: Rodar e ver falhar**

```bash
npx jest __tests__/theme/tokens.test.ts
```

Esperado: FALHA com `Cannot find module` ou export inexistente.

- [ ] **Passo 4: Escrever os tokens**

Em `mobile/src/theme/tokens.ts`, **acrescente no topo** (mantendo tudo o que já existe abaixo, sob um cabeçalho de legado):

```ts
// Design system do redesign (BER-77) — fonte única de verdade.
// Contrato legível em mobile/DESIGN.md. Nenhum valor visual existe fora daqui:
// __tests__/guards barra hex e fontSize soltos em src/ui, src/features e app.

export const color = {
  bg: '#12100E',
  surface1: '#1B1916',
  surface2: '#25221E',
  surface3: '#302C27',
  floating: '#2A2622',

  line: 'rgba(243,237,226,0.08)',
  line2: 'rgba(243,237,226,0.14)',

  text: '#F3EDE2',
  text2: '#B9B0A3',
  text3: '#978E82',

  accent: '#F0A83A',
  accentInk: '#1B1206',
  accentSoft: 'rgba(240,168,58,0.14)',

  positive: '#8CC28F',
  positiveSoft: 'rgba(140,194,143,0.14)',
  danger: '#EE7B67',
  dangerSoft: 'rgba(238,123,103,0.14)',
} as const;

/** Cores das capas geradas. O creme COVER_INK é legível sobre todas (teste cobre). */
export const COVER_PALETTE_COLORS = [
  '#5E2A2A', '#2F4A3A', '#22324F', '#7A5A1E',
  '#4A2F4F', '#1F4A4F', '#3A3F47', '#7A3B22',
] as const;

export const COVER_INK = '#F6E9D4';

export const space = {
  xs: 4, sm: 8, md: 12, lg: 16, gutter: 20, xl: 24, xxl: 32, xxxl: 40, huge: 48,
} as const;

export const radius = {
  tag: 6, chip: 10, control: 14, card: 20, sheet: 28, pill: 999,
} as const;

export const fontFamily = {
  serif: 'Newsreader_400Regular',
  serifItalic: 'Newsreader_400Regular_Italic',
  serifMedium: 'Newsreader_500Medium',
  ui: 'HankenGrotesk_400Regular',
  uiMedium: 'HankenGrotesk_500Medium',
  uiSemi: 'HankenGrotesk_600SemiBold',
  uiBold: 'HankenGrotesk_700Bold',
} as const;

export type TypeVariant =
  | 'display' | 'title' | 'heading' | 'subhead' | 'body' | 'reading'
  | 'callout' | 'label' | 'caption' | 'button'
  | 'numericXL' | 'numericL' | 'numericM';

interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  fontStyle?: 'italic';
  fontVariant?: ['tabular-nums'];
  /** Teto do Dynamic Type: acima disso o layout quebra. */
  maxFontSizeMultiplier: number;
}

// A camada do livro fala em serifa; a da interface, em sans. Números sempre
// tabulares, para não "pular" quando contam.
export const type: Record<TypeVariant, TypeStyle> = {
  display:   { fontFamily: fontFamily.serifMedium, fontSize: 34, lineHeight: 38, letterSpacing: -0.4, maxFontSizeMultiplier: 1.2 },
  title:     { fontFamily: fontFamily.serifMedium, fontSize: 28, lineHeight: 32, letterSpacing: -0.3, maxFontSizeMultiplier: 1.2 },
  heading:   { fontFamily: fontFamily.serifMedium, fontSize: 22, lineHeight: 28, maxFontSizeMultiplier: 1.3 },
  subhead:   { fontFamily: fontFamily.uiSemi,      fontSize: 17, lineHeight: 24, maxFontSizeMultiplier: 1.3 },
  body:      { fontFamily: fontFamily.ui,          fontSize: 16, lineHeight: 24, maxFontSizeMultiplier: 1.4 },
  reading:   { fontFamily: fontFamily.serif,       fontSize: 17, lineHeight: 27, fontStyle: 'italic', maxFontSizeMultiplier: 1.4 },
  callout:   { fontFamily: fontFamily.ui,          fontSize: 14, lineHeight: 20, maxFontSizeMultiplier: 1.3 },
  label:     { fontFamily: fontFamily.uiSemi,      fontSize: 13, lineHeight: 18, maxFontSizeMultiplier: 1.3 },
  caption:   { fontFamily: fontFamily.uiMedium,    fontSize: 12, lineHeight: 16, maxFontSizeMultiplier: 1.3 },
  button:    { fontFamily: fontFamily.uiSemi,      fontSize: 16, lineHeight: 20, maxFontSizeMultiplier: 1.2 },
  numericXL: { fontFamily: fontFamily.uiBold, fontSize: 40, lineHeight: 44, letterSpacing: -1, fontVariant: ['tabular-nums'], maxFontSizeMultiplier: 1.1 },
  numericL:  { fontFamily: fontFamily.uiBold, fontSize: 28, lineHeight: 32, letterSpacing: -0.6, fontVariant: ['tabular-nums'], maxFontSizeMultiplier: 1.1 },
  numericM:  { fontFamily: fontFamily.uiBold, fontSize: 20, lineHeight: 24, letterSpacing: -0.3, fontVariant: ['tabular-nums'], maxFontSizeMultiplier: 1.2 },
};

// Regras de motion da Wiki (standards/frontend/animation-patterns.md): saída em
// ~2/3 da entrada, ease-out no enter e ease-in no exit, nada de scale(0).
export const motion = {
  press: { damping: 18, stiffness: 320, mass: 0.6, scale: 0.98 },
  enter: { duration: 240, translateY: 8 },
  exit: { duration: 160 },
  stagger: { step: 40, max: 6 },
  count: { duration: 600 },
  skeleton: { duration: 200 },
} as const;

export const elevation = {
  flat: {},
  surface: { backgroundColor: color.surface1, borderWidth: 1, borderColor: color.line },
  floating: {
    backgroundColor: color.floating,
    borderWidth: 1,
    borderColor: color.line2,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 32,
    elevation: 12,
  },
} as const;

/** Alvo mínimo de toque (HIG e Material). */
export const MIN_TOUCH = 44;
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;

// ───────────────────────────────────────────────────────────────────
// LEGADO — "Luminous Library", o sistema anterior. Continua exportado
// porque 21 componentes e 13 telas ainda dependem dele. Sai na F6, quando
// a última tela migrar. Não use em código novo.
// ───────────────────────────────────────────────────────────────────
```

Abaixo dessa linha, mantenha o conteúdo atual do arquivo (`colors`, `radii`, `fonts`, `BrandColor`, `brandTriplet`) **sem alteração**.

- [ ] **Passo 5: Rodar e ver passar**

```bash
npx jest __tests__/theme/tokens.test.ts
```

Esperado: todos os testes passam. Se o contraste falhar em alguma cor, **ajuste a cor, não o limite**.

- [ ] **Passo 6: Verificar que nada regrediu**

```bash
npx jest --silent
npx tsc --noEmit
```

Esperado: 164 + 9 novos testes, e 0 erro de tipo.

- [ ] **Passo 7: Commit**

```bash
git add package.json src/theme/tokens.ts __tests__/theme/tokens.test.ts
git commit -m "feat(BER-77): tokens do design system, com contraste verificado por teste

Cor, espaço, raio, tipografia, motion e elevação numa fonte única. O teste
mede o contraste WCAG em vez de estimar: texto, acento, positivo e erro
passam em AA sobre as três superfícies, e o creme passa sobre as oito
cores de capa.

O sistema antigo (colors/radii/fonts) continua exportado como legado — 21
componentes ainda dependem dele e migram até a F6.

O testMatch do Jest passa a ser por extensão (.ts no projeto node, .tsx no
react-native), o que dispensa listar cada pasta nova.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 3: Fontes e splash sem tela preta

**Por quê:** hoje o `app/_layout.tsx` faz `if (!fontsLoaded) return null`, o que mostra uma tela **branca ou preta** enquanto as fontes carregam, num app escuro. O `expo-splash-screen` segura a splash até tudo estar pronto.

**Arquivos:**
- Modifica: `mobile/src/theme/fonts.ts`
- Modifica: `mobile/app/_layout.tsx`
- Modifica: `mobile/app.json`
- Cria: `mobile/__tests__/theme/fonts.test.ts`

**Interfaces:**
- Consome: `fontFamily` (Tarefa 2)
- Produz: `useAppFonts(): boolean`. A função antiga `useLuminousFonts()` continua existindo e carregando Plus Jakarta, porque as telas antigas ainda a usam.

- [ ] **Passo 1: Escrever o teste que falha**

Crie `mobile/__tests__/theme/fonts.test.ts`:

```ts
import { fontFamily } from '../../src/theme/tokens';
import { APP_FONT_MAP } from '../../src/theme/fonts';

describe('fontes do app', () => {
  it('toda família citada nos tokens está no mapa de carga', () => {
    const carregadas = Object.keys(APP_FONT_MAP);
    for (const familia of Object.values(fontFamily)) {
      expect(carregadas).toContain(familia);
    }
  });

  it('carrega exatamente os pesos usados, sem peso órfão', () => {
    const usadas = new Set<string>(Object.values(fontFamily));
    for (const chave of Object.keys(APP_FONT_MAP)) {
      expect(usadas.has(chave)).toBe(true);
    }
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx jest __tests__/theme/fonts.test.ts
```

Esperado: FALHA com `APP_FONT_MAP` inexistente.

- [ ] **Passo 3: Implementar a carga das fontes**

Em `mobile/src/theme/fonts.ts`, **acrescente** (mantendo `useLuminousFonts` como está):

```ts
import {
  useFonts as useNewsreader,
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
} from '@expo-google-fonts/newsreader';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';

/**
 * As fontes do redesign, com a chave igual ao valor de `fontFamily` em tokens.ts.
 * O teste garante que as duas listas não se separem: peso citado no token e não
 * carregado vira texto no fallback do sistema, que é o tipo de falha que só
 * aparece no aparelho.
 */
export const APP_FONT_MAP = {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} as const;

export function useAppFonts(): boolean {
  const [loaded] = useNewsreader(APP_FONT_MAP);
  return loaded;
}
```

- [ ] **Passo 4: Rodar e ver passar**

```bash
npx jest __tests__/theme/fonts.test.ts
```

Esperado: PASS.

- [ ] **Passo 5: Segurar a splash no layout raiz**

Em `mobile/app/_layout.tsx`, troque o import de `useLuminousFonts` por `useAppFonts`, e substitua o `if (!fontsLoaded) return null` do fim do arquivo. Acrescente no topo, **fora do componente**:

```ts
import * as SplashScreen from 'expo-splash-screen';
import { useCallback } from 'react';

// A splash fica até fonte e sessão estarem prontas. Sem isso, o app pisca uma
// tela vazia entre a splash e a primeira rota — num app escuro, isso aparece.
SplashScreen.preventAutoHideAsync().catch(() => {});
```

E no lugar do `return null` final:

```ts
  const onLayout = useCallback(() => {
    if (fontsLoaded && isInitialized) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, isInitialized]);

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }} onLayout={onLayout}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />
    </View>
  );
```

Ajuste os imports: `View` de `react-native` e `color` de `../src/theme/tokens`. A variável `fontsLoaded` passa a vir de `useAppFonts()`.

- [ ] **Passo 6: Ajustar o app.json para o tema escuro**

Em `mobile/app.json`, dentro de `expo`:

```json
"userInterfaceStyle": "dark",
"splash": {
  "image": "./assets/splash-icon.png",
  "resizeMode": "contain",
  "backgroundColor": "#12100E"
},
```

Troque também `android.adaptiveIcon.backgroundColor` de `#E6F4FE` para `#12100E`. A troca dos arquivos de imagem do ícone fica para a F3.

- [ ] **Passo 7: Verificar**

```bash
npx jest --silent
npx tsc --noEmit
```

Esperado: tudo verde. As telas antigas continuam usando Plus Jakarta, porque `useLuminousFonts` não saiu — só deixou de ser chamada no layout. **Atenção:** isso significa que, a partir daqui, as telas antigas caem no fallback do sistema até migrarem. É esperado e some ao longo das fases; registre no commit.

- [ ] **Passo 8: Commit**

```bash
git add src/theme/fonts.ts app/_layout.tsx app.json __tests__/theme/fonts.test.ts
git commit -m "feat(BER-77): carregar Newsreader e Hanken e segurar a splash

O layout fazia 'return null' enquanto a fonte carregava, o que pisca uma
tela vazia num app escuro. Agora a splash fica de pé até fonte e sessão
estarem prontas, e o app.json declara o tema escuro.

O teste amarra o mapa de carga aos tokens: peso citado e não carregado cai
no fallback do sistema, falha que só apareceria no aparelho.

Efeito transitório: as telas ainda não migradas passam a usar o fallback do
sistema, porque Plus Jakarta saiu do layout raiz. Volta ao normal conforme
cada tela migra (F4 a F6).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 4: DESIGN.md, o contrato de marca

**Por quê:** o padrão da Wiki (`standards/frontend/design-system-contract.md`) exige um contrato legível por pessoa e por agente, com os anti-patterns como seção de primeira classe. É o que impede a próxima tela de inventar valor.

**Arquivos:**
- Cria: `mobile/DESIGN.md`

**Interfaces:**
- Consome: `tokens.ts` (Tarefa 2)
- Produz: documento de referência citado por todas as tarefas seguintes

- [ ] **Passo 1: Escrever o documento**

Crie `mobile/DESIGN.md` com as 9 seções do padrão, extraindo os valores **do `tokens.ts`** (sem reinventar) e a voz da §3.5 da spec: Color, Typography, Spacing, Layout, Components, Motion, Voice, Brand e Anti-patterns. A seção Voice traz a tabela de copy e os 8 títulos de nível. A seção Anti-patterns repete a lista da §3.6 da spec, marcando com **(T)** os itens cobertos por teste na Tarefa 18.

No topo:

```markdown
# BeReading — DESIGN.md

> Contrato de marca. Toda UI obedece este arquivo. Direção: **Noturno editorial**,
> público 18–24, dark-first, anti-template.
> Valores canônicos em `src/theme/tokens.ts` — este documento explica, não duplica a fonte.
```

- [ ] **Passo 2: Conferir contra os tokens**

Leia `src/theme/tokens.ts` lado a lado e confirme que nenhum valor citado no `DESIGN.md` diverge. Onde houver número, cite o nome do token junto (ex.: "acento `color.accent` `#F0A83A`").

- [ ] **Passo 3: Commit**

```bash
git add DESIGN.md
git commit -m "docs(BER-77): DESIGN.md, o contrato de marca do redesign

Nove seções do padrão da Wiki, com os anti-patterns como seção de primeira
classe. Os valores canônicos vivem em src/theme/tokens.ts; aqui fica o
porquê e o limite.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 5: XP e nível derivados (`src/game/xp.ts`)

**Por quê:** hoje a tela mostra "+145 XP" calculado na hora, e **XP não existe no banco**. É o mesmo tipo de número inventado que a BER-54 já tirou da Home. A saída é derivar de dado persistido, com a mesma fórmula que a UI já exibia, e provar por teste.

**Arquivos:**
- Cria: `mobile/src/game/xp.ts`
- Cria: `mobile/__tests__/game/xp.test.ts`

**Interfaces:**
- Consome: nada
- Produz:
  - `XP_PER_PAGE = 5`, `XP_PER_BADGE = 100`
  - `xpFromPages(sessions: { pages_read: number }[]): number`
  - `xpFromScores(answers: ScoredAnswer[]): number`
  - `totalXp(input: XpInput): number`, com `XpInput = { sessions, answers, badgeCount }`
  - `ScoredAnswer = { comprehension_score: number | null; evaluation_status: string }`
  - `levelFor(xp: number): { level: number; title: string; floor: number; next: number | null; progress: number }`
  - `LEVEL_TITLES: readonly string[]`

- [ ] **Passo 1: Escrever o teste que falha**

Crie `mobile/__tests__/game/xp.test.ts`:

```ts
import { xpFromPages, xpFromScores, totalXp, levelFor, XP_PER_PAGE, XP_PER_BADGE } from '../../src/game/xp';

const avaliada = (score: number) => ({ comprehension_score: score, evaluation_status: 'completed' });

describe('xpFromPages', () => {
  it('conta 5 XP por página, a mesma fórmula que a tela já mostrava', () => {
    expect(xpFromPages([{ pages_read: 28 }, { pages_read: 12 }])).toBe(40 * XP_PER_PAGE);
  });

  it('sem sessão, zero', () => {
    expect(xpFromPages([])).toBe(0);
  });
});

describe('xpFromScores', () => {
  it('conta nota dividida por 5, arredondada', () => {
    expect(xpFromScores([avaliada(92), avaliada(80)])).toBe(18 + 16);
  });

  it('resposta sem nota não conta — nota ausente não é nota zero (BER-42)', () => {
    expect(xpFromScores([
      { comprehension_score: null, evaluation_status: 'pending' },
      avaliada(90),
    ])).toBe(18);
  });

  it('resposta com status diferente de completed não conta, mesmo com nota', () => {
    expect(xpFromScores([{ comprehension_score: 90, evaluation_status: 'failed' }])).toBe(0);
  });
});

describe('totalXp', () => {
  it('soma páginas, notas e conquistas', () => {
    expect(totalXp({
      sessions: [{ pages_read: 10 }],
      answers: [avaliada(100)],
      badgeCount: 2,
    })).toBe(50 + 20 + 2 * XP_PER_BADGE);
  });
});

describe('levelFor', () => {
  it('começa no nível 1 com zero XP', () => {
    const r = levelFor(0);
    expect(r.level).toBe(1);
    expect(r.title).toBe('Primeira página');
    expect(r.progress).toBe(0);
  });

  it.each([
    [219, 1], [220, 2], [659, 2], [660, 3],
    [1319, 3], [1320, 4], [2199, 4], [2200, 5],
  ])('XP %i cai no nível %i', (xp, nivel) => {
    expect(levelFor(xp).level).toBe(nivel);
  });

  it('o nível 4 se chama Constante e mostra o piso e o próximo limiar', () => {
    const r = levelFor(1840);
    expect(r.title).toBe('Constante');
    expect(r.floor).toBe(1320);
    expect(r.next).toBe(2200);
  });

  it('progress é a fração entre o piso e o próximo limiar', () => {
    const r = levelFor(1760); // meio do caminho entre 1320 e 2200
    expect(r.progress).toBeCloseTo(0.5, 2);
  });

  it('do nível 8 em diante o título não muda e não há próximo limiar', () => {
    const r = levelFor(999_999);
    expect(r.title).toBe('Lenda da estante');
    expect(r.next).toBeNull();
    expect(r.progress).toBe(1);
  });

  it('XP negativo ou inválido não quebra: cai no nível 1', () => {
    expect(levelFor(-10).level).toBe(1);
    expect(levelFor(Number.NaN).level).toBe(1);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx jest __tests__/game/xp.test.ts
```

Esperado: FALHA com `Cannot find module '../../src/game/xp'`.

- [ ] **Passo 3: Implementar**

Crie `mobile/src/game/xp.ts`:

```ts
// XP e nível derivados do que está no banco (BER-77).
//
// Não existe coluna de XP: a tela antiga calculava "páginas × 5" e "nota ÷ 5" na
// hora e jogava fora. A fórmula é a mesma; o que muda é a fonte — agora soma o
// que está persistido, então o mesmo leitor vê o mesmo número em qualquer
// aparelho. Persistir XP no banco é decisão de backend, fora desta branch.
//
// Caveat herdado: página relida conta de novo, porque `pages_read` é coluna
// gerada no servidor (BER-68).

export const XP_PER_PAGE = 5;
export const XP_PER_BADGE = 100;

export interface ScoredAnswer {
  comprehension_score: number | null;
  evaluation_status: string;
}

export function xpFromPages(sessions: { pages_read: number }[]): number {
  return sessions.reduce((sum, s) => sum + s.pages_read * XP_PER_PAGE, 0);
}

/** Só resposta avaliada conta. Nota ausente não é nota zero (BER-42). */
export function xpFromScores(answers: ScoredAnswer[]): number {
  return answers.reduce((sum, a) => {
    if (a.evaluation_status !== 'completed' || a.comprehension_score === null) return sum;
    return sum + Math.round(a.comprehension_score / 5);
  }, 0);
}

export interface XpInput {
  sessions: { pages_read: number }[];
  answers: ScoredAnswer[];
  badgeCount: number;
}

export function totalXp({ sessions, answers, badgeCount }: XpInput): number {
  return xpFromPages(sessions) + xpFromScores(answers) + badgeCount * XP_PER_BADGE;
}

export const LEVEL_TITLES = [
  'Primeira página', 'Curioso', 'Engatado', 'Constante',
  'Maratonista', 'Devorador', 'Rato de biblioteca', 'Lenda da estante',
] as const;

const MAX_LEVEL = LEVEL_TITLES.length; // 8: daí em diante o título se repete

/**
 * XP necessário para ALCANÇAR o nível n. Quadrática suave: cada nível custa um
 * pouco mais que o anterior, sem virar parede. Ajustar o ritmo é mudar só o 110.
 */
function threshold(level: number): number {
  return 110 * level * (level - 1);
}

export interface LevelInfo {
  level: number;
  title: string;
  /** XP em que este nível começou. */
  floor: number;
  /** XP do próximo nível; `null` no topo. */
  next: number | null;
  /** Fração de 0 a 1 entre `floor` e `next`. */
  progress: number;
}

export function levelFor(xp: number): LevelInfo {
  const safe = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;

  let level = 1;
  while (level < MAX_LEVEL && safe >= threshold(level + 1)) level++;

  const floor = threshold(level);
  const next = level < MAX_LEVEL ? threshold(level + 1) : null;
  const progress = next === null ? 1 : (safe - floor) / (next - floor);

  return { level, title: LEVEL_TITLES[level - 1], floor, next, progress };
}
```

- [ ] **Passo 4: Rodar e ver passar**

```bash
npx jest __tests__/game/xp.test.ts
```

Esperado: PASS em todos.

- [ ] **Passo 5: Commit**

```bash
git add src/game/xp.ts __tests__/game/xp.test.ts
git commit -m "feat(BER-77): XP e nível derivados de dado persistido

A tela antiga calculava XP na hora e jogava fora, e não existe coluna de XP
no banco. A fórmula é a mesma que já era exibida (páginas × 5, nota ÷ 5),
mas agora somada sobre o que está persistido, mais 100 por conquista — o
mesmo leitor vê o mesmo número em qualquer aparelho.

Nível por limiar quadrático T(n) = 110·n·(n−1), com os oito títulos do
contrato de voz. O ritmo se ajusta numa constante só.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 6: Sequência no fuso do servidor (`src/game/streak.ts`)

**Por quê:** o servidor vira o dia no **fuso de São Paulo** (`getTodayInSaoPaulo`, em `register-reading-session/reading.ts`). Se o app usar o fuso do aparelho, quem estiver fora de SP vê sequência e alerta errados. Além disso, `streaks.current_streak` só é atualizado no próximo registro: quem parou de ler há três dias continua vendo "4 dias seguidos" no banco.

**Arquivos:**
- Cria: `mobile/src/game/streak.ts`
- Cria: `mobile/__tests__/game/streak.test.ts`

**Interfaces:**
- Consome: nada
- Produz:
  - `todayInSaoPaulo(now?: Date): string` (formato `YYYY-MM-DD`)
  - `effectiveStreak(streak: { current_streak: number; last_read_date: string | null }, now?: Date): number`
  - `weekDays(sessions: { read_at: string }[], now?: Date): WeekDay[]`, com `WeekDay = { date: string; letter: string; read: boolean; isToday: boolean }`
  - `streakRisk(args: { streak: number; readToday: boolean; now?: Date }): { atRisk: boolean; hoursLeft: number }`

- [ ] **Passo 1: Escrever o teste que falha**

Crie `mobile/__tests__/game/streak.test.ts`:

```ts
import { todayInSaoPaulo, effectiveStreak, weekDays, streakRisk } from '../../src/game/streak';

/** 21:00 em São Paulo = 00:00 UTC do dia seguinte (UTC−3). */
const spNoite = new Date('2026-09-12T00:00:00.000Z');

describe('todayInSaoPaulo', () => {
  it('usa o fuso de São Paulo, não o do aparelho', () => {
    // 00:00 UTC do dia 12 ainda é dia 11 em São Paulo.
    expect(todayInSaoPaulo(spNoite)).toBe('2026-09-11');
  });

  it('meio-dia UTC cai no mesmo dia', () => {
    expect(todayInSaoPaulo(new Date('2026-09-11T15:00:00.000Z'))).toBe('2026-09-11');
  });
});

describe('effectiveStreak', () => {
  it('mantém a sequência de quem leu hoje', () => {
    expect(effectiveStreak({ current_streak: 4, last_read_date: '2026-09-11' }, spNoite)).toBe(4);
  });

  it('mantém a sequência de quem leu ontem — o dia ainda não acabou', () => {
    expect(effectiveStreak({ current_streak: 4, last_read_date: '2026-09-10' }, spNoite)).toBe(4);
  });

  it('zera quando a última leitura é anterior a ontem, mesmo com o banco dizendo 4', () => {
    expect(effectiveStreak({ current_streak: 4, last_read_date: '2026-09-08' }, spNoite)).toBe(0);
  });

  it('sem última leitura, zero', () => {
    expect(effectiveStreak({ current_streak: 0, last_read_date: null }, spNoite)).toBe(0);
  });
});

describe('weekDays', () => {
  it('devolve sete dias, de segunda a domingo, marcando quem leu', () => {
    const dias = weekDays([{ read_at: '2026-09-09T14:00:00Z' }, { read_at: '2026-09-11T23:00:00Z' }], spNoite);
    expect(dias).toHaveLength(7);
    expect(dias.map((d) => d.letter)).toEqual(['S', 'T', 'Q', 'Q', 'S', 'S', 'D']);
    expect(dias.find((d) => d.date === '2026-09-09')?.read).toBe(true);
    expect(dias.find((d) => d.date === '2026-09-10')?.read).toBe(false);
  });

  it('marca hoje pelo fuso de São Paulo', () => {
    const dias = weekDays([], spNoite);
    expect(dias.filter((d) => d.isToday)).toHaveLength(1);
    expect(dias.find((d) => d.isToday)?.date).toBe('2026-09-11');
  });

  it('sessão registrada às 23h de SP conta no dia certo, não no seguinte', () => {
    // 2026-09-11 23:30 em SP = 2026-09-12 02:30 UTC
    const dias = weekDays([{ read_at: '2026-09-12T02:30:00Z' }], spNoite);
    expect(dias.find((d) => d.date === '2026-09-11')?.read).toBe(true);
  });
});

describe('streakRisk', () => {
  it('avisa depois das 18h de SP quando a sequência vale a pena', () => {
    const r = streakRisk({ streak: 4, readToday: false, now: spNoite });
    expect(r.atRisk).toBe(true);
    expect(r.hoursLeft).toBe(3);
  });

  it('não avisa quem já leu hoje', () => {
    expect(streakRisk({ streak: 4, readToday: true, now: spNoite }).atRisk).toBe(false);
  });

  it('não avisa antes das 18h', () => {
    const tarde = new Date('2026-09-11T19:00:00.000Z'); // 16h em SP
    expect(streakRisk({ streak: 4, readToday: false, now: tarde }).atRisk).toBe(false);
  });

  it('não avisa com sequência menor que 2 — não há o que perder', () => {
    expect(streakRisk({ streak: 1, readToday: false, now: spNoite }).atRisk).toBe(false);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx jest __tests__/game/streak.test.ts
```

Esperado: FALHA com módulo inexistente.

- [ ] **Passo 3: Implementar**

Crie `mobile/src/game/streak.ts`:

```ts
// Sequência de leitura, no mesmo fuso do servidor (BER-77).
//
// O register-reading-session vira o dia em São Paulo (getTodayInSaoPaulo, em
// register-reading-session/reading.ts). Se o app usasse o fuso do aparelho,
// quem lê às 23h de Lisboa veria a sequência de outro dia — e o alerta de risco
// mentiria. Esta é a mesma conta, espelhada no cliente.

const SAOPAULO_OFFSET = -3;
const MS_PER_HOUR = 3_600_000;

/** Data (YYYY-MM-DD) em São Paulo. Espelha getTodayInSaoPaulo do servidor. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return dateInSaoPaulo(now).toISOString().split('T')[0];
}

/** O instante deslocado para o relógio de São Paulo. Só para ler campos UTC. */
function dateInSaoPaulo(now: Date): Date {
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utc + SAOPAULO_OFFSET * MS_PER_HOUR);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * A sequência que vale hoje.
 *
 * `streaks.current_streak` só é reescrito no próximo registro: quem parou há
 * três dias continua com 4 gravado no banco. Mostrar esse número seria mentir.
 * Vale enquanto a última leitura foi hoje ou ontem.
 */
export function effectiveStreak(
  streak: { current_streak: number; last_read_date: string | null },
  now: Date = new Date(),
): number {
  if (!streak.last_read_date) return 0;
  const hoje = todayInSaoPaulo(now);
  const ontem = addDays(hoje, -1);
  if (streak.last_read_date === hoje || streak.last_read_date === ontem) {
    return streak.current_streak;
  }
  return 0;
}

export interface WeekDay {
  date: string;
  letter: string;
  read: boolean;
  isToday: boolean;
}

const LETTERS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

/** Segunda a domingo da semana corrente, marcando os dias com leitura. */
export function weekDays(
  sessions: { read_at: string }[],
  now: Date = new Date(),
): WeekDay[] {
  const hoje = todayInSaoPaulo(now);
  const dow = new Date(`${hoje}T00:00:00.000Z`).getUTCDay(); // 0 = domingo
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  const segunda = addDays(hoje, offsetToMonday);

  // A sessão é datada pelo dia em SP, não pelo UTC do read_at: leitura às 23h
  // de SP cairia no dia seguinte se comparássemos a string crua.
  const lidos = new Set(sessions.map((s) => todayInSaoPaulo(new Date(s.read_at))));

  return LETTERS.map((letter, i) => {
    const date = addDays(segunda, i);
    return { date, letter, read: lidos.has(date), isToday: date === hoje };
  });
}

/** Depois das 18h de SP, sem leitura hoje e com sequência que valha a pena. */
export function streakRisk({
  streak,
  readToday,
  now = new Date(),
}: {
  streak: number;
  readToday: boolean;
  now?: Date;
}): { atRisk: boolean; hoursLeft: number } {
  const hora = dateInSaoPaulo(now).getUTCHours();
  const hoursLeft = 24 - hora;
  const atRisk = !readToday && streak >= 2 && hora >= 18;
  return { atRisk, hoursLeft };
}
```

- [ ] **Passo 4: Rodar e ver passar**

```bash
npx jest __tests__/game/streak.test.ts
```

Esperado: PASS.

- [ ] **Passo 5: Verificar que nada regrediu**

```bash
npx jest --silent
npx tsc --noEmit
```

- [ ] **Passo 6: Commit**

```bash
git add src/game/streak.ts __tests__/game/streak.test.ts
git commit -m "feat(BER-77): sequência no fuso do servidor, com sequência efetiva

O servidor vira o dia em São Paulo. Com o fuso do aparelho, quem lê às 23h
de Lisboa veria a sequência de outro dia e o alerta de risco mentiria.

Duas correções junto: current_streak só é reescrito no próximo registro,
então quem parou há três dias ainda tem 4 no banco — a sequência efetiva
mostra 0. E a sessão é datada pelo dia em SP, não pelo UTC cru do read_at.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 7: Conquistas com ícone e progresso reais (`src/game/badges.ts`)

**Por quê:** o `BadgeGrid` de hoje mapeia ícone por chaves que **não existem** (`pages_read`, `books_finished`, `quizzes_completed`, `answers_submitted`). Os `criteria_type` reais do seed são outros, então quase toda medalha cai no ícone genérico. E a medalha trancada mostra só um cadeado, quando o banco tem o `criteria_value` e o app tem o dado do leitor.

**Arquivos:**
- Cria: `mobile/src/game/badges.ts`
- Cria: `mobile/__tests__/game/badges.test.ts`

**Interfaces:**
- Consome: `Badge`, `StudentBadge` de `src/types/database`
- Produz:
  - `BADGE_ICONS: Record<string, LucideIcon>` e `iconForCriteria(criteriaType: string): LucideIcon`
  - `badgeProgress(badge: Badge, stats: BadgeStats): { current: number; target: number } | null`
  - `BadgeStats = { totalSessions: number; currentStreak: number; quizzesAnswered: number; booksFinished: number; totalPages: number }`
  - `decorateBadges(all: Badge[], earned: StudentBadge[], stats: BadgeStats): DecoratedBadge[]`
  - `DecoratedBadge = Badge & { earned: boolean; earnedAt: string | null; progress: { current, target } | null }`

- [ ] **Passo 1: Escrever o teste que falha**

Crie `mobile/__tests__/game/badges.test.ts`:

```ts
import { badgeProgress, decorateBadges, iconForCriteria, BADGE_ICONS } from '../../src/game/badges';
import type { Badge, StudentBadge } from '../../src/types/database';

const badge = (over: Partial<Badge>): Badge => ({
  id: 'b1', name: 'Medalha', description: 'desc', icon_url: null,
  criteria_type: 'total_pages', criteria_value: 500, ...over,
});

const stats = {
  totalSessions: 12, currentStreak: 5, quizzesAnswered: 3,
  booksFinished: 1, totalPages: 312,
};

describe('iconForCriteria', () => {
  it.each([
    'total_sessions', 'streak_days', 'quizzes_answered', 'books_finished',
    'reflection_score_80', 'total_pages', 'personal_book', 'avg_score_90_book',
  ])('tem ícone próprio para o criteria_type real %s', (tipo) => {
    expect(BADGE_ICONS[tipo]).toBeDefined();
  });

  it('tipo desconhecido cai num ícone genérico em vez de quebrar', () => {
    expect(iconForCriteria('tipo_que_nao_existe')).toBeDefined();
  });
});

describe('badgeProgress', () => {
  it('mostra progresso de páginas com o alvo do banco', () => {
    expect(badgeProgress(badge({ criteria_type: 'total_pages', criteria_value: 500 }), stats))
      .toEqual({ current: 312, target: 500 });
  });

  it('usa a sequência atual para streak_days', () => {
    expect(badgeProgress(badge({ criteria_type: 'streak_days', criteria_value: 7 }), stats))
      .toEqual({ current: 5, target: 7 });
  });

  it('não passa do alvo quando o leitor já ultrapassou', () => {
    expect(badgeProgress(badge({ criteria_type: 'total_sessions', criteria_value: 1 }), stats))
      .toEqual({ current: 1, target: 1 });
  });

  it('devolve null onde o app não sabe calcular, em vez de inventar', () => {
    expect(badgeProgress(badge({ criteria_type: 'avg_score_90_book' }), stats)).toBeNull();
    expect(badgeProgress(badge({ criteria_type: 'personal_book' }), stats)).toBeNull();
    expect(badgeProgress(badge({ criteria_type: 'reflection_score_80' }), stats)).toBeNull();
  });
});

describe('decorateBadges', () => {
  const todos = [
    badge({ id: 'ganha', criteria_type: 'total_sessions', criteria_value: 1 }),
    badge({ id: 'falta', criteria_type: 'streak_days', criteria_value: 7 }),
  ];
  const ganhas: StudentBadge[] = [
    { id: 'sb1', user_id: 'u1', badge_id: 'ganha', earned_at: '2026-09-02T10:00:00Z' },
  ];

  it('marca o que já foi conquistado, com a data', () => {
    const r = decorateBadges(todos, ganhas, stats);
    expect(r[0]).toMatchObject({ id: 'ganha', earned: true, earnedAt: '2026-09-02T10:00:00Z' });
  });

  it('conquista já ganha não mostra barra de progresso', () => {
    expect(decorateBadges(todos, ganhas, stats)[0].progress).toBeNull();
  });

  it('conquista que falta mostra quanto falta', () => {
    const r = decorateBadges(todos, ganhas, stats)[1];
    expect(r.earned).toBe(false);
    expect(r.progress).toEqual({ current: 5, target: 7 });
  });

  it('ordena as conquistadas primeiro', () => {
    const invertido = [todos[1], todos[0]];
    expect(decorateBadges(invertido, ganhas, stats).map((b) => b.id)).toEqual(['ganha', 'falta']);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx jest __tests__/game/badges.test.ts
```

Esperado: FALHA com módulo inexistente.

- [ ] **Passo 3: Implementar**

Crie `mobile/src/game/badges.ts`:

```ts
// Conquistas: ícone e progresso a partir do criteria_type REAL do banco (BER-77).
//
// O BadgeGrid antigo mapeava 'pages_read', 'books_finished', 'quizzes_completed'
// e 'answers_submitted' — nenhum desses existe. Os tipos do seed são os oito
// abaixo, e por isso quase toda medalha caía no ícone genérico.
//
// O progresso espelha evaluateBadges (award-badges/index.ts) só nos tipos que o
// app já tem em mãos. Onde o servidor precisa de conta que o app não faz
// (média por livro, livro fora da grade, reflexão acima de 80), devolve null: a
// medalha aparece com a descrição, sem barra. Inventar barra seria número falso.

import {
  BookOpen, Flame, MessageSquare, Trophy, Brain, Library, Compass, Target, Award,
} from 'lucide-react-native';
import type { Badge, StudentBadge } from '../types/database';

type IconComponent = typeof BookOpen;

export const BADGE_ICONS: Record<string, IconComponent> = {
  total_sessions: BookOpen,
  streak_days: Flame,
  quizzes_answered: MessageSquare,
  books_finished: Trophy,
  reflection_score_80: Brain,
  total_pages: Library,
  personal_book: Compass,
  avg_score_90_book: Target,
};

export function iconForCriteria(criteriaType: string): IconComponent {
  return BADGE_ICONS[criteriaType] ?? Award;
}

export interface BadgeStats {
  totalSessions: number;
  currentStreak: number;
  quizzesAnswered: number;
  booksFinished: number;
  totalPages: number;
}

export interface BadgeProgress {
  current: number;
  target: number;
}

export function badgeProgress(badge: Badge, stats: BadgeStats): BadgeProgress | null {
  const atual: Record<string, number> = {
    total_sessions: stats.totalSessions,
    streak_days: stats.currentStreak,
    quizzes_answered: stats.quizzesAnswered,
    books_finished: stats.booksFinished,
    total_pages: stats.totalPages,
  };

  const current = atual[badge.criteria_type];
  if (current === undefined) return null;

  return { current: Math.min(current, badge.criteria_value), target: badge.criteria_value };
}

export type DecoratedBadge = Badge & {
  earned: boolean;
  earnedAt: string | null;
  progress: BadgeProgress | null;
};

export function decorateBadges(
  all: Badge[],
  earned: StudentBadge[],
  stats: BadgeStats,
): DecoratedBadge[] {
  const porId = new Map(earned.map((e) => [e.badge_id, e]));

  return all
    .map((badge) => {
      const ganha = porId.get(badge.id);
      return {
        ...badge,
        earned: Boolean(ganha),
        earnedAt: ganha?.earned_at ?? null,
        progress: ganha ? null : badgeProgress(badge, stats),
      };
    })
    .sort((a, b) => Number(b.earned) - Number(a.earned));
}
```

- [ ] **Passo 4: Rodar e ver passar**

```bash
npx jest __tests__/game/badges.test.ts
```

Esperado: PASS.

- [ ] **Passo 5: Commit**

```bash
git add src/game/badges.ts __tests__/game/badges.test.ts
git commit -m "feat(BER-77): conquistas com ícone e progresso do criteria_type real

O BadgeGrid mapeava quatro chaves que não existem no banco, então quase
toda medalha caía no ícone genérico. Os oito tipos do seed agora têm ícone
próprio, com teste que trava o contrato.

A medalha trancada passa a mostrar quanto falta, espelhando evaluateBadges
nos tipos que o app já tem. Onde o servidor faz conta que o app não faz, o
progresso é null e não aparece barra — barra inventada seria número falso.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 8: O assistente — identidade e falas (`src/assistant/`)

**Por quê:** hoje a IA não tem presença: o quiz é formulário e a devolutiva é um card "do mestre". O assistente é o foco do produto, então precisa de nome num lugar só (ainda é provisório) e de falas **puras e testáveis**. Nada de texto gerado por IA fora da devolutiva que o `evaluate-answer` já devolve.

**Arquivos:**
- Cria: `mobile/src/assistant/persona.ts`
- Cria: `mobile/src/assistant/lines.ts`
- Cria: `mobile/__tests__/assistant/lines.test.ts`

**Interfaces:**
- Consome: `todayInSaoPaulo` (Tarefa 6)
- Produz:
  - `ASSISTANT_NAME: string` (provisório: `'Orelha'`), `ASSISTANT_INTRO: string`
  - `greeting(now?: Date): string`
  - `streakLine(streak: number): string`
  - `streakRiskLine(hoursLeft: number): string`
  - `chapterClosedTitle(chapterNumbers: number[]): string`
  - `levelUpLine(level: number, title: string): string`
  - `scoreLine(score: number | null): string`
  - `quizStateLine(state: QuizStateKey, chapterNumber: number): { text: string; cta?: string }`, com `QuizStateKey = 'polling' | 'still-generating' | 'no-content' | 'failed'`
  - `pendingQuizLine(chapterNumber: number, count: number): string`

- [ ] **Passo 1: Escrever o teste que falha**

Crie `mobile/__tests__/assistant/lines.test.ts`:

```ts
import {
  greeting, streakLine, streakRiskLine, chapterClosedTitle,
  levelUpLine, scoreLine, quizStateLine, pendingQuizLine,
} from '../../src/assistant/lines';
import { ASSISTANT_NAME } from '../../src/assistant/persona';

/** Toda copy do app passa por aqui: nada de emoji, nada de travessao. */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const TRAVESSAO = /[—–]/;

const TODAS = [
  greeting(new Date('2026-09-11T12:00:00Z')),
  streakLine(4), streakLine(0), streakLine(1),
  streakRiskLine(3),
  chapterClosedTitle([4]), chapterClosedTitle([4, 5]),
  levelUpLine(5, 'Maratonista'),
  scoreLine(92), scoreLine(60), scoreLine(null),
  pendingQuizLine(3, 4), pendingQuizLine(3, 1),
  quizStateLine('polling', 5).text,
  quizStateLine('still-generating', 5).text,
  quizStateLine('no-content', 5).text,
  quizStateLine('failed', 5).text,
];

describe('contrato de voz', () => {
  it.each(TODAS)('a fala %p nao tem emoji', (texto) => {
    expect(EMOJI.test(texto)).toBe(false);
  });

  it.each(TODAS)('a fala %p nao tem travessao', (texto) => {
    expect(TRAVESSAO.test(texto)).toBe(false);
  });

  it.each(TODAS)('a fala %p nao fica vazia', (texto) => {
    expect(texto.trim().length).toBeGreaterThan(0);
  });
});

describe('greeting', () => {
  it.each([
    ['2026-09-11T11:00:00Z', 'Bom dia'],
    ['2026-09-11T18:00:00Z', 'Boa tarde'],
    ['2026-09-12T00:00:00Z', 'Boa noite'],
  ])('em %s cumprimenta com %s', (iso, esperado) => {
    expect(greeting(new Date(iso))).toContain(esperado);
  });
});

describe('streakLine', () => {
  it('convida quem tem sequencia a continuar, com o numero certo', () => {
    expect(streakLine(4)).toBe('4 dias seguidos. Lê hoje e vira 5.');
  });

  it('trata o singular', () => {
    expect(streakLine(1)).toBe('1 dia seguido. Lê hoje e vira 2.');
  });

  it('sem sequencia, convida a comecar sem cobrar', () => {
    expect(streakLine(0)).toBe('Bora começar uma sequência? Uma página já conta.');
  });
});

describe('streakRiskLine', () => {
  it('diz quantas horas faltam e que pouco ja resolve', () => {
    expect(streakRiskLine(3)).toBe('Faltam 3h pra sua sequência zerar. Uma página já conta.');
  });

  it('na ultima hora, fala no singular', () => {
    expect(streakRiskLine(1)).toBe('Falta 1h pra sua sequência zerar. Uma página já conta.');
  });
});

describe('chapterClosedTitle', () => {
  it('nomeia o capitulo quando e um so', () => {
    expect(chapterClosedTitle([4])).toBe('Capítulo 4, fechado.');
  });

  it('conta quando sao varios', () => {
    expect(chapterClosedTitle([4, 5])).toBe('2 capítulos, fechados.');
  });
});

describe('levelUpLine', () => {
  it('anuncia o nivel e o titulo novo', () => {
    expect(levelUpLine(5, 'Maratonista')).toBe('Nível 5. Agora você é Maratonista.');
  });
});

describe('scoreLine', () => {
  it('elogia nota alta sem exagero', () => {
    expect(scoreLine(92)).toBe('Mandou bem.');
  });

  it('nota baixa aponta o caminho em vez de consolar', () => {
    expect(scoreLine(50)).toBe('Quase. Olha esse detalhe que passou.');
  });

  it('sem nota, diz o que esta acontecendo (BER-42)', () => {
    expect(scoreLine(null)).toBe('Salvei sua resposta. A nota chega quando eu terminar de avaliar.');
  });
});

describe('quizStateLine', () => {
  it('no polling, explica o que esta fazendo e cita o capitulo', () => {
    expect(quizStateLine('polling', 5).text).toContain('capítulo 5');
  });

  it('no no-content, assume o limite e nao oferece re-tentar', () => {
    const r = quizStateLine('no-content', 5);
    expect(r.text).toContain('chute');
    expect(r.cta).toBe('Voltar pro livro');
  });

  it('no still-generating, garante que a leitura esta salva e oferece verificar', () => {
    const r = quizStateLine('still-generating', 5);
    expect(r.text).toContain('salva');
    expect(r.cta).toBe('Verificar de novo');
  });

  it('no failed, assume a culpa em vez de mandar o leitor se virar', () => {
    expect(quizStateLine('failed', 5).text).toContain('meu lado');
  });
});

describe('pendingQuizLine', () => {
  it('lembra do quiz parado, com plural', () => {
    expect(pendingQuizLine(3, 4)).toBe('Você fechou o capítulo 3 e deixou 4 perguntas pra trás.');
  });

  it('trata o singular', () => {
    expect(pendingQuizLine(3, 1)).toBe('Você fechou o capítulo 3 e deixou 1 pergunta pra trás.');
  });
});

describe('persona', () => {
  it('o nome vive num lugar so, porque ainda e provisorio', () => {
    expect(ASSISTANT_NAME.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx jest __tests__/assistant/lines.test.ts
```

Esperado: FALHA com `Cannot find module '../../src/assistant/lines'`.

- [ ] **Passo 3: Implementar a persona**

Crie `mobile/src/assistant/persona.ts`:

```ts
// O assistente de leitura (BER-77).
//
// "Orelha" e PROVISORIO e por isso vive numa constante so: a orelha do livro e
// onde alguem te apresenta a obra. Trocar o nome e trocar esta linha.

export const ASSISTANT_NAME = 'Orelha';

/** Como o assistente se apresenta a quem abre o app pela primeira vez. */
export const ASSISTANT_INTRO =
  `Eu sou a ${ASSISTANT_NAME}. Você lê, eu te faço pensar sobre o que leu.`;
```

- [ ] **Passo 4: Implementar as falas**

Crie `mobile/src/assistant/lines.ts`:

```ts
// As falas do assistente. Puras e testadas (BER-77).
//
// Nada aqui e gerado por IA: a unica fala vinda do modelo e a devolutiva que o
// evaluate-answer ja devolve. Isso mantem a voz previsivel, testavel e barata.
//
// Voz: 18 a 24 anos, direta, sem emoji e sem travessao. Ver DESIGN.md secao Voice.

const SAOPAULO_OFFSET = -3;

function hourInSaoPaulo(now: Date): number {
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utc + SAOPAULO_OFFSET * 3_600_000).getUTCHours();
}

export function greeting(now: Date = new Date()): string {
  const h = hourInSaoPaulo(now);
  if (h < 12) return 'Bom dia,';
  if (h < 18) return 'Boa tarde,';
  return 'Boa noite,';
}

export function streakLine(streak: number): string {
  if (streak <= 0) return 'Bora começar uma sequência? Uma página já conta.';
  const dias = streak === 1 ? '1 dia seguido' : `${streak} dias seguidos`;
  return `${dias}. Lê hoje e vira ${streak + 1}.`;
}

export function streakRiskLine(hoursLeft: number): string {
  const verbo = hoursLeft === 1 ? 'Falta' : 'Faltam';
  return `${verbo} ${hoursLeft}h pra sua sequência zerar. Uma página já conta.`;
}

export function chapterClosedTitle(chapterNumbers: number[]): string {
  if (chapterNumbers.length === 1) return `Capítulo ${chapterNumbers[0]}, fechado.`;
  return `${chapterNumbers.length} capítulos, fechados.`;
}

export function levelUpLine(level: number, title: string): string {
  return `Nível ${level}. Agora você é ${title}.`;
}

/** A nota ja aparece como numero na tela; aqui vai so a leitura humana dela. */
export function scoreLine(score: number | null): string {
  if (score === null) return 'Salvei sua resposta. A nota chega quando eu terminar de avaliar.';
  if (score >= 85) return 'Mandou bem.';
  if (score >= 70) return 'Boa. Faltou pouco pro ponto principal.';
  return 'Quase. Olha esse detalhe que passou.';
}

export type QuizStateKey = 'polling' | 'still-generating' | 'no-content' | 'failed';

/**
 * Os estados da tela de quiz, ditos pelo assistente. A maquina de estados nao
 * muda (BER-40, BER-66); muda quem conta o que esta acontecendo.
 */
export function quizStateLine(
  state: QuizStateKey,
  chapterNumber: number,
): { text: string; cta?: string } {
  switch (state) {
    case 'polling':
      return { text: `Tô relendo o capítulo ${chapterNumber} pra montar suas perguntas.` };
    case 'still-generating':
      return {
        text: 'Tá demorando mais que o normal. Sua leitura já tá salva, e eu te aviso na Hoje quando ficar pronto.',
        cta: 'Verificar de novo',
      };
    case 'no-content':
      // BER-66: falta conteudo, nao e falha de IA. Nao oferecer re-tentar, porque
      // re-tentar sabidamente nao resolve.
      return {
        text: 'Ainda não tenho esse capítulo aqui. Perguntar sem ter lido seria chute, e eu não chuto. Sua leitura já tá salva.',
        cta: 'Voltar pro livro',
      };
    case 'failed':
      return { text: 'Deu ruim do meu lado. Tenta de novo daqui a pouco.', cta: 'Tentar de novo' };
  }
}

export function pendingQuizLine(chapterNumber: number, count: number): string {
  const perguntas = count === 1 ? '1 pergunta' : `${count} perguntas`;
  return `Você fechou o capítulo ${chapterNumber} e deixou ${perguntas} pra trás.`;
}
```

- [ ] **Passo 5: Rodar e ver passar**

```bash
npx jest __tests__/assistant/lines.test.ts
```

Esperado: PASS. Se um teste de emoji ou travessão falhar, **corrija a fala, não o teste**.

- [ ] **Passo 6: Verificar que nada regrediu**

```bash
npx jest --silent
npx tsc --noEmit
```

- [ ] **Passo 7: Commit**

```bash
git add src/assistant/ __tests__/assistant/
git commit -m "feat(BER-77): o assistente ganha nome e falas testadas

A IA nao tinha presenca: o quiz era formulario e a devolutiva, um card do
mestre. Agora as falas sao puras e testadas, e a unica fala vinda do modelo
segue sendo a devolutiva que o evaluate-answer ja devolve.

O contrato de voz virou teste: nenhuma fala passa com emoji, travessao ou
texto vazio. Os quatro estados do quiz (BER-40, BER-66) viram fala sem
mudar a maquina de estados, e o no-content continua sem oferecer um botao
que sabidamente nao resolve.

O nome Orelha e provisorio e vive numa constante so.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 9: `Text`, o primeiro primitivo

**Por quê:** é o componente mais usado do app e o que encerra os 26 tamanhos de fonte. Traz junto o teto de Dynamic Type, que hoje não existe.

**Arquivos:**
- Cria: `mobile/src/ui/Text.tsx`, `mobile/src/ui/index.ts`
- Cria: `mobile/__tests__/ui/Text.test.tsx`
- Cria: `mobile/jest.setup.ui.js`
- Modifica: `mobile/package.json` (projeto `react-native`)

**Interfaces:**
- Consome: `type`, `color`, `TypeVariant` (Tarefa 2)
- Produz: `<Text variant tone align numberOfLines style>` e `Tone`, exportados por `src/ui/index.ts`

- [ ] **Passo 1: Preparar o setup de teste do Reanimated**

Crie `mobile/jest.setup.ui.js`:

```js
// Reanimated roda em worklet no aparelho; no Jest, o mock oficial devolve a API
// sincrona. Sem isto, todo componente com animacao quebra no teste.
require('@testing-library/jest-native/extend-expect');
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
```

Em `mobile/package.json`, no projeto `react-native`, troque `setupFilesAfterEnv` por:

```json
"setupFilesAfterEnv": [
  "<rootDir>/jest.setup.ui.js"
]
```

- [ ] **Passo 2: Escrever o teste que falha**

Crie `mobile/__tests__/ui/Text.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { Text } from '../../src/ui/Text';
import { type as typeTokens, color } from '../../src/theme/tokens';

/** O style do RN pode vir como objeto ou array aninhado. */
function flat(style: any): Record<string, any> {
  if (!style) return {};
  if (Array.isArray(style)) return style.reduce((acc, s) => ({ ...acc, ...flat(s) }), {});
  return style;
}

describe('Text', () => {
  it('aplica tamanho, linha e familia da variante', () => {
    const { getByText } = render(<Text variant="heading">Magrathea</Text>);
    const s = flat(getByText('Magrathea').props.style);
    expect(s.fontSize).toBe(typeTokens.heading.fontSize);
    expect(s.lineHeight).toBe(typeTokens.heading.lineHeight);
    expect(s.fontFamily).toBe(typeTokens.heading.fontFamily);
  });

  it('usa body como variante padrao', () => {
    const { getByText } = render(<Text>Sem variante</Text>);
    expect(flat(getByText('Sem variante').props.style).fontSize).toBe(typeTokens.body.fontSize);
  });

  it.each([
    ['primary', color.text],
    ['secondary', color.text2],
    ['tertiary', color.text3],
    ['accent', color.accent],
    ['danger', color.danger],
  ])('o tone %s pinta com o token certo', (tone, esperado) => {
    const { getByText } = render(<Text tone={tone as any}>Cor</Text>);
    expect(flat(getByText('Cor').props.style).color).toBe(esperado);
  });

  it('limita o Dynamic Type para o layout nao quebrar', () => {
    const { getByText } = render(<Text variant="display">Guilherme</Text>);
    expect(getByText('Guilherme').props.maxFontSizeMultiplier)
      .toBe(typeTokens.display.maxFontSizeMultiplier);
  });

  it('numeros usam fonte tabular, para nao pular quando contam', () => {
    const { getByText } = render(<Text variant="numericXL">1840</Text>);
    expect(flat(getByText('1840').props.style).fontVariant).toEqual(['tabular-nums']);
  });

  it('deixa o chamador sobrescrever com style, sem perder a variante', () => {
    const { getByText } = render(<Text variant="body" style={{ marginTop: 8 }}>X</Text>);
    const s = flat(getByText('X').props.style);
    expect(s.marginTop).toBe(8);
    expect(s.fontSize).toBe(typeTokens.body.fontSize);
  });

  it('repassa numberOfLines', () => {
    const { getByText } = render(<Text numberOfLines={2}>Titulo longo</Text>);
    expect(getByText('Titulo longo').props.numberOfLines).toBe(2);
  });
});
```

- [ ] **Passo 3: Rodar e ver falhar**

```bash
npx jest __tests__/ui/Text.test.tsx
```

Esperado: FALHA com `Cannot find module '../../src/ui/Text'`.

- [ ] **Passo 4: Implementar**

Crie `mobile/src/ui/Text.tsx`:

```tsx
import { Text as RNText, StyleSheet, type TextProps, type TextStyle, type StyleProp } from 'react-native';
import { type as typeTokens, color, type TypeVariant } from '../theme/tokens';

export type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'positive' | 'danger' | 'inverse';

const TONE_COLOR: Record<Tone, string> = {
  primary: color.text,
  secondary: color.text2,
  tertiary: color.text3,
  accent: color.accent,
  positive: color.positive,
  danger: color.danger,
  inverse: color.accentInk,
};

interface Props extends Omit<TextProps, 'style'> {
  variant?: TypeVariant;
  tone?: Tone;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
}

// Um Text so, por variante. E o que encerra os 26 tamanhos de fonte soltos do
// app antigo: quem precisa de um tamanho novo acrescenta variante no token, e a
// guarda de __tests__/guards barra fontSize literal em tela.
export function Text({ variant = 'body', tone = 'primary', align, style, children, ...rest }: Props) {
  const t = typeTokens[variant];
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={t.maxFontSizeMultiplier}
      style={[styles[variant], { color: TONE_COLOR[tone] }, align ? { textAlign: align } : null, style]}
    >
      {children}
    </RNText>
  );
}

// StyleSheet.create em vez de objeto inline: o estilo e registrado uma vez, nao
// recriado a cada render.
const styles = StyleSheet.create(
  Object.fromEntries(
    Object.entries(typeTokens).map(([k, v]) => {
      const { maxFontSizeMultiplier: _teto, ...textStyle } = v;
      return [k, textStyle];
    }),
  ) as Record<TypeVariant, TextStyle>,
);
```

Crie `mobile/src/ui/index.ts`:

```ts
export { Text } from './Text';
export type { Tone } from './Text';
```

- [ ] **Passo 5: Rodar e ver passar**

```bash
npx jest __tests__/ui/Text.test.tsx
```

Esperado: PASS.

- [ ] **Passo 6: Verificar que nada regrediu**

```bash
npx jest --silent
npx tsc --noEmit
```

Esperado: as 4 suítes de componente antigas continuam verdes com o `setupFilesAfterEnv` novo.

- [ ] **Passo 7: Commit**

```bash
git add src/ui/ __tests__/ui/ jest.setup.ui.js package.json
git commit -m "feat(BER-77): primitivo Text, uma variante por papel tipografico

Encerra os 26 tamanhos de fonte soltos: quem precisa de um tamanho novo
acrescenta variante no token. Traz junto o teto de Dynamic Type, que nao
existia, e a fonte tabular nos numeros.

O setup de teste passa a mockar o Reanimated, para os primitivos com
animacao rodarem no Jest.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 10: `Button` e `IconButton`

**Por quê:** o `Press3DButton` atual é o visual mais datado do app (lábio de 6px, halo colorido e 6 cores saturadas) e não tem estado de loading. O botão novo responde por escala e haptic, não por deslocamento, e cobre os quatro estados.

**Arquivos:**
- Cria: `mobile/src/ui/Button.tsx`, `mobile/src/ui/IconButton.tsx`
- Cria: `mobile/__tests__/ui/Button.test.tsx`
- Modifica: `mobile/src/ui/index.ts`

**Interfaces:**
- Consome: `Text` (Tarefa 9), tokens (Tarefa 2)
- Produz:
  - `<Button variant size icon loading disabled onPress accessibilityLabel>`, com `variant: 'primary' | 'secondary' | 'ghost' | 'destructive'` e `size: 'md' | 'lg'`
  - `<IconButton icon accessibilityLabel onPress variant>`, com `variant: 'surface' | 'ghost'`, sempre 44×44

- [ ] **Passo 1: Escrever o teste que falha**

Crie `mobile/__tests__/ui/Button.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { X } from 'lucide-react-native';
import { Button } from '../../src/ui/Button';
import { IconButton } from '../../src/ui/IconButton';
import { color, MIN_TOUCH } from '../../src/theme/tokens';

function flat(style: any): Record<string, any> {
  if (!style) return {};
  if (Array.isArray(style)) return style.reduce((acc, s) => ({ ...acc, ...flat(s) }), {});
  return style;
}

describe('Button', () => {
  it('chama onPress no toque', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Button onPress={onPress}>Registrar leitura</Button>);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('nao chama onPress quando desabilitado', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Button onPress={onPress} disabled>Registrar</Button>);
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('nao chama onPress durante o loading, para nao enviar duas vezes', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Button onPress={onPress} loading>Registrar</Button>);
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('anuncia o estado desabilitado para o leitor de tela', () => {
    const { getByRole } = render(<Button onPress={jest.fn()} disabled>Registrar</Button>);
    expect(getByRole('button').props.accessibilityState.disabled).toBe(true);
  });

  it('anuncia busy durante o loading', () => {
    const { getByRole } = render(<Button onPress={jest.fn()} loading>Registrar</Button>);
    expect(getByRole('button').props.accessibilityState.busy).toBe(true);
  });

  it('usa o proprio texto como label acessivel quando nenhum e dado', () => {
    const { getByRole } = render(<Button onPress={jest.fn()}>Registrar leitura</Button>);
    expect(getByRole('button').props.accessibilityLabel).toBe('Registrar leitura');
  });

  it('o primario pinta com o acento e escreve com a tinta escura', () => {
    const { getByRole } = render(<Button onPress={jest.fn()}>Ir</Button>);
    expect(flat(getByRole('button').props.style).backgroundColor).toBe(color.accent);
  });

  it('o destrutivo usa o token de erro, nao o acento', () => {
    const { getByRole } = render(<Button variant="destructive" onPress={jest.fn()}>Sair</Button>);
    expect(flat(getByRole('button').props.style).backgroundColor).toBe(color.dangerSoft);
  });

  it('o desabilitado nao usa opacidade, para o texto seguir legivel', () => {
    const { getByRole } = render(<Button onPress={jest.fn()} disabled>Ir</Button>);
    const s = flat(getByRole('button').props.style);
    expect(s.backgroundColor).toBe(color.surface2);
    expect(s.opacity).toBeUndefined();
  });

  it('respeita o alvo minimo de toque', () => {
    const { getByRole } = render(<Button onPress={jest.fn()}>Ir</Button>);
    expect(flat(getByRole('button').props.style).height).toBeGreaterThanOrEqual(MIN_TOUCH);
  });
});

describe('IconButton', () => {
  it('exige e expoe um label, porque icone sozinho nao se explica', () => {
    const { getByLabelText } = render(
      <IconButton icon={X} accessibilityLabel="Fechar o quiz" onPress={jest.fn()} />,
    );
    expect(getByLabelText('Fechar o quiz')).toBeTruthy();
  });

  it('tem alvo de toque de ao menos 44 nos dois eixos', () => {
    const { getByRole } = render(
      <IconButton icon={X} accessibilityLabel="Fechar" onPress={jest.fn()} />,
    );
    const s = flat(getByRole('button').props.style);
    expect(s.width).toBeGreaterThanOrEqual(MIN_TOUCH);
    expect(s.height).toBeGreaterThanOrEqual(MIN_TOUCH);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx jest __tests__/ui/Button.test.tsx
```

Esperado: FALHA com módulo inexistente.

- [ ] **Passo 3: Implementar o Button**

Crie `mobile/src/ui/Button.tsx`:

```tsx
import { useCallback } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Text } from './Text';
import { color, radius, space, motion, MIN_TOUCH } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'md' | 'lg';
type IconCmp = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

interface Props {
  children: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconCmp;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

const BG: Record<Variant, string> = {
  primary: color.accent,
  secondary: color.surface2,
  ghost: 'transparent',
  destructive: color.dangerSoft,
};

const INK: Record<Variant, 'inverse' | 'primary' | 'secondary' | 'danger'> = {
  primary: 'inverse',
  secondary: 'primary',
  ghost: 'secondary',
  destructive: 'danger',
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Sai o labio 3D de 6px do Press3DButton: o toque e respondido por escala, cor e
// haptic. Desabilitado nao usa opacidade — o texto continua legivel, com o
// contraste do token text3 sobre surface2.
export function Button({
  children, onPress, variant = 'primary', size = 'lg', icon: Icon,
  loading = false, disabled = false, accessibilityLabel, style,
}: Props) {
  const inativo = disabled || loading;
  const scale = useSharedValue(1);

  const animado = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPressIn = useCallback(() => {
    if (inativo) return;
    scale.value = withSpring(motion.press.scale, motion.press);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [inativo, scale]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, motion.press);
  }, [scale]);

  const fundo = inativo ? color.surface2 : BG[variant];
  const tinta = inativo ? 'tertiary' : INK[variant];

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityState={{ disabled, busy: loading }}
      onPress={inativo ? undefined : onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={inativo}
      style={[
        styles.base,
        { height: size === 'lg' ? 50 : MIN_TOUCH, backgroundColor: fundo },
        variant === 'secondary' && !inativo ? styles.bordered : null,
        animado,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color.text3} />
      ) : (
        Icon ? <Icon size={18} color={tinta === 'inverse' ? color.accentInk : color.text} strokeWidth={2.2} /> : null
      )}
      <Text variant="button" tone={tinta}>{children}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
  },
  bordered: { borderWidth: 1, borderColor: color.line2 },
});
```

- [ ] **Passo 4: Implementar o IconButton**

Crie `mobile/src/ui/IconButton.tsx`:

```tsx
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { color, radius, MIN_TOUCH } from '../theme/tokens';

type IconCmp = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

interface Props {
  icon: IconCmp;
  /** Obrigatorio: icone sozinho nao se explica para quem usa leitor de tela. */
  accessibilityLabel: string;
  onPress: () => void;
  variant?: 'surface' | 'ghost';
  style?: ViewStyle;
}

export function IconButton({ icon: Icon, accessibilityLabel, onPress, variant = 'surface', style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'surface' ? styles.surface : null,
        pressed ? { backgroundColor: color.surface3 } : null,
        style,
      ]}
    >
      <Icon size={20} color={color.text} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surface: { backgroundColor: color.surface1, borderWidth: 1, borderColor: color.line },
});
```

Acrescente a `mobile/src/ui/index.ts`:

```ts
export { Button } from './Button';
export { IconButton } from './IconButton';
```

- [ ] **Passo 5: Rodar e ver passar**

```bash
npx jest __tests__/ui/Button.test.tsx
npx jest --silent && npx tsc --noEmit
```

Esperado: PASS em tudo.

- [ ] **Passo 6: Commit**

```bash
git add src/ui/ __tests__/ui/Button.test.tsx
git commit -m "feat(BER-77): Button e IconButton com os quatro estados

O Press3DButton nao tinha loading e usava labio de 6px com halo colorido em
seis cores saturadas, que e o visual mais datado do app. O botao novo
responde por escala, cor e haptic.

Dois detalhes que vieram da auditoria: loading tambem bloqueia o toque,
para nao enviar a leitura duas vezes, e desabilitado nao usa opacidade,
para o texto seguir legivel. IconButton exige label por tipo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 11: `Field` e `PageField`

**Por quê:** os campos de hoje usam a borda verde no foco e mandam o erro para um `Alert.alert`. O erro precisa aparecer no campo, e o `PageField` é a peça central do sheet de registro.

**Arquivos:**
- Cria: `mobile/src/ui/Field.tsx`, `mobile/src/ui/PageField.tsx`
- Cria: `mobile/__tests__/ui/Field.test.tsx`
- Modifica: `mobile/src/ui/index.ts`

**Interfaces:**
- Consome: `Text` (Tarefa 9), tokens
- Produz:
  - `<Field label value onChangeText error hint icon ...TextInputProps>`
  - `<PageField label value onChange placeholder max accessibilityLabel>` (só dígitos, teclado numérico)

- [ ] **Passo 1: Escrever o teste que falha**

Crie `mobile/__tests__/ui/Field.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Field } from '../../src/ui/Field';
import { PageField } from '../../src/ui/PageField';

describe('Field', () => {
  it('associa o rotulo ao campo para o leitor de tela', () => {
    const { getByLabelText } = render(
      <Field label="E-mail" value="" onChangeText={jest.fn()} />,
    );
    expect(getByLabelText('E-mail')).toBeTruthy();
  });

  it('mostra o erro no campo, nao num alerta', () => {
    const { getByText } = render(
      <Field label="Senha" value="123" onChangeText={jest.fn()} error="Mínimo de 6 caracteres" />,
    );
    expect(getByText('Mínimo de 6 caracteres')).toBeTruthy();
  });

  it('anuncia o estado invalido', () => {
    const { getByLabelText } = render(
      <Field label="Senha" value="1" onChangeText={jest.fn()} error="Curta" />,
    );
    expect(getByLabelText('Senha').props.accessibilityInvalid).toBe(true);
  });

  it('mostra a dica quando nao ha erro', () => {
    const { getByText, queryByText } = render(
      <Field label="Senha" value="" onChangeText={jest.fn()} hint="Mínimo de 6 caracteres" />,
    );
    expect(getByText('Mínimo de 6 caracteres')).toBeTruthy();
    expect(queryByText('erro')).toBeNull();
  });

  it('o erro substitui a dica, para nao empilhar mensagem', () => {
    const { getByText, queryByText } = render(
      <Field label="Senha" value="1" onChangeText={jest.fn()} hint="Dica" error="Erro" />,
    );
    expect(getByText('Erro')).toBeTruthy();
    expect(queryByText('Dica')).toBeNull();
  });

  it('repassa o texto digitado', () => {
    const onChangeText = jest.fn();
    const { getByLabelText } = render(
      <Field label="Nome" value="" onChangeText={onChangeText} />,
    );
    fireEvent.changeText(getByLabelText('Nome'), 'Guilherme');
    expect(onChangeText).toHaveBeenCalledWith('Guilherme');
  });
});

describe('PageField', () => {
  it('descarta o que nao e digito, porque pagina nao tem letra', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <PageField label="Até" value="" onChange={onChange} accessibilityLabel="Página final" />,
    );
    fireEvent.changeText(getByLabelText('Página final'), '1a2b');
    expect(onChange).toHaveBeenCalledWith('12');
  });

  it('abre o teclado numerico', () => {
    const { getByLabelText } = render(
      <PageField label="De" value="85" onChange={jest.fn()} accessibilityLabel="Página inicial" />,
    );
    expect(getByLabelText('Página inicial').props.keyboardType).toBe('number-pad');
  });

  it('limita o tamanho pelo total de paginas do livro', () => {
    const { getByLabelText } = render(
      <PageField label="Até" value="" onChange={jest.fn()} max={215} accessibilityLabel="Página final" />,
    );
    expect(getByLabelText('Página final').props.maxLength).toBe(3);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx jest __tests__/ui/Field.test.tsx
```

Esperado: FALHA com módulo inexistente.

- [ ] **Passo 3: Implementar o Field**

Crie `mobile/src/ui/Field.tsx`:

```tsx
import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './Text';
import { color, radius, space, type as typeTokens } from '../theme/tokens';

type IconCmp = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Mensagem de erro. Quando presente, substitui a dica. */
  error?: string;
  hint?: string;
  icon?: IconCmp;
}

// O erro vive no campo, nao num Alert.alert: quem erra a senha precisa ver o
// motivo ao lado do que digitou, nao numa caixa de sistema que some.
export function Field({ label, error, hint, icon: Icon, ...input }: Props) {
  const [focused, setFocused] = useState(false);
  const mensagem = error ?? hint;

  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="secondary" style={styles.label}>{label}</Text>
      <View style={[
        styles.box,
        focused ? styles.focused : null,
        error ? styles.invalid : null,
      ]}>
        {Icon ? <Icon size={18} color={color.text3} strokeWidth={2} /> : null}
        <TextInput
          {...input}
          accessibilityLabel={input.accessibilityLabel ?? label}
          accessibilityInvalid={Boolean(error)}
          placeholderTextColor={color.text3}
          onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
          style={styles.input}
        />
      </View>
      {mensagem ? (
        <Text variant="caption" tone={error ? 'danger' : 'tertiary'} style={styles.msg}>{mensagem}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  label: { marginBottom: space.xs + 2 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    paddingHorizontal: space.lg - 2,
    borderRadius: radius.control,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.line,
  },
  focused: { borderColor: color.text2 },
  invalid: { borderColor: color.danger },
  input: {
    flex: 1,
    color: color.text,
    fontFamily: typeTokens.body.fontFamily,
    fontSize: typeTokens.body.fontSize,
  },
  msg: { marginTop: space.xs + 2 },
});
```

- [ ] **Passo 4: Implementar o PageField**

Crie `mobile/src/ui/PageField.tsx`:

```tsx
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Text } from './Text';
import { color, radius, space, type as typeTokens } from '../theme/tokens';

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Total de paginas do livro: define quantos digitos cabem. */
  max?: number;
  accessibilityLabel: string;
}

export function PageField({ label, value, onChange, placeholder, max, accessibilityLabel }: Props) {
  const [focused, setFocused] = useState(false);
  const maxLength = max ? String(max).length : 4;

  return (
    <View style={styles.wrap}>
      <Text variant="label" tone={focused ? 'accent' : 'secondary'} style={styles.label}>{label}</Text>
      <View style={[styles.box, focused ? styles.focused : null]}>
        <TextInput
          value={value}
          accessibilityLabel={accessibilityLabel}
          // Pagina nao tem letra: o teclado numerico ainda deixa colar texto.
          onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ''))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={color.text3}
          keyboardType="number-pad"
          maxLength={maxLength}
          style={styles.input}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  label: { marginBottom: space.sm - 2 },
  box: {
    height: 72,
    borderRadius: radius.card - 4,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focused: { borderColor: color.text2 },
  input: {
    width: '100%',
    textAlign: 'center',
    color: color.text,
    fontFamily: typeTokens.numericXL.fontFamily,
    fontSize: 32,
    letterSpacing: -0.8,
  },
});
```

Acrescente a `mobile/src/ui/index.ts`:

```ts
export { Field } from './Field';
export { PageField } from './PageField';
```

- [ ] **Passo 5: Rodar e ver passar**

```bash
npx jest __tests__/ui/Field.test.tsx
npx jest --silent && npx tsc --noEmit
```

- [ ] **Passo 6: Commit**

```bash
git add src/ui/ __tests__/ui/Field.test.tsx
git commit -m "feat(BER-77): Field e PageField, com erro dentro do campo

Os campos antigos mandavam o erro para um Alert.alert, que some e nao diz
qual campo errou. Agora a mensagem fica no campo, com accessibilityInvalid
para o leitor de tela, e o erro substitui a dica em vez de empilhar.

O PageField limita os digitos pelo total de paginas do livro e continua
descartando o que nao e digito, porque teclado numerico ainda aceita colar.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 12: `Chip` e `Segmented`

**Por quê:** os chips de hoje pintam borda e texto com seis cores de categoria, o que quebra a regra de um acento só. E o `Segmented` é o que substitui o "Troféus" da Estante e os dois modos do Explorar.

**Arquivos:**
- Cria: `mobile/src/ui/Chip.tsx`, `mobile/src/ui/Segmented.tsx`
- Cria: `mobile/__tests__/ui/Selection.test.tsx`
- Modifica: `mobile/src/ui/index.ts`

**Interfaces:**
- Consome: `Text` (Tarefa 9), tokens
- Produz:
  - `<Chip label selected onPress>`
  - `<Segmented options value onChange>`, com `options: { value: string; label: string }[]`

- [ ] **Passo 1: Escrever o teste que falha**

Crie `mobile/__tests__/ui/Selection.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Chip } from '../../src/ui/Chip';
import { Segmented } from '../../src/ui/Segmented';
import { color } from '../../src/theme/tokens';

function flat(style: any): Record<string, any> {
  if (!style) return {};
  if (Array.isArray(style)) return style.reduce((acc, s) => ({ ...acc, ...flat(s) }), {});
  return style;
}

describe('Chip', () => {
  it('avisa o leitor de tela quando esta selecionado', () => {
    const { getByRole } = render(<Chip label="Distopia" selected onPress={jest.fn()} />);
    expect(getByRole('button').props.accessibilityState.selected).toBe(true);
  });

  it('o selecionado inverte, em vez de usar mais uma cor', () => {
    const { getByRole } = render(<Chip label="Distopia" selected onPress={jest.fn()} />);
    expect(flat(getByRole('button').props.style).backgroundColor).toBe(color.text);
  });

  it('o nao selecionado fica so com borda', () => {
    const { getByRole } = render(<Chip label="Distopia" onPress={jest.fn()} />);
    expect(flat(getByRole('button').props.style).backgroundColor).toBe('transparent');
  });

  it('chama onPress no toque', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Chip label="Fantasia" onPress={onPress} />);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Segmented', () => {
  const opcoes = [
    { value: 'lendo', label: 'Lendo · 1' },
    { value: 'lidos', label: 'Lidos · 1' },
  ];

  it('marca a opcao ativa como selecionada', () => {
    const { getByLabelText } = render(
      <Segmented options={opcoes} value="lendo" onChange={jest.fn()} />,
    );
    expect(getByLabelText('Lendo · 1').props.accessibilityState.selected).toBe(true);
    expect(getByLabelText('Lidos · 1').props.accessibilityState.selected).toBe(false);
  });

  it('devolve o value da opcao tocada, nao o rotulo', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <Segmented options={opcoes} value="lendo" onChange={onChange} />,
    );
    fireEvent.press(getByLabelText('Lidos · 1'));
    expect(onChange).toHaveBeenCalledWith('lidos');
  });

  it('nao dispara onChange ao tocar na opcao que ja esta ativa', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <Segmented options={opcoes} value="lendo" onChange={onChange} />,
    );
    fireEvent.press(getByLabelText('Lendo · 1'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx jest __tests__/ui/Selection.test.tsx
```

Esperado: FALHA com módulo inexistente.

- [ ] **Passo 3: Implementar o Chip**

Crie `mobile/src/ui/Chip.tsx`:

```tsx
import { Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { color, radius, space } from '../theme/tokens';

interface Props {
  label: string;
  selected?: boolean;
  onPress: () => void;
}

// O chip antigo pintava borda e texto com a cor da categoria, o que colocava
// seis acentos na mesma tela. Aqui o selecionado inverte (tinta clara, texto
// escuro): destaca sem gastar cor nova.
export function Chip({ label, selected = false, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      style={[styles.base, selected ? styles.on : styles.off]}
    >
      <Text variant="callout" tone={selected ? 'inverse' : 'secondary'}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 34,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  on: { backgroundColor: color.text, borderColor: color.text },
  off: { backgroundColor: 'transparent', borderColor: color.line2 },
});
```

- [ ] **Passo 4: Implementar o Segmented**

Crie `mobile/src/ui/Segmented.tsx`:

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { color, radius, space } from '../theme/tokens';

export interface SegmentedOption {
  value: string;
  label: string;
}

interface Props {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
}

export function Segmented({ options, value, onChange }: Props) {
  return (
    <View accessibilityRole="tablist" style={styles.wrap}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            // Tocar no que ja esta ativo nao deve recarregar a lista.
            onPress={selected ? undefined : () => onChange(o.value)}
            style={[styles.item, selected ? styles.on : null]}
          >
            <Text variant="label" tone={selected ? 'primary' : 'secondary'}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: color.surface1,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.chip + 1,
    padding: 3,
  },
  item: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip - 2,
    paddingHorizontal: space.sm,
  },
  on: { backgroundColor: color.surface3 },
});
```

Acrescente a `mobile/src/ui/index.ts`:

```ts
export { Chip } from './Chip';
export { Segmented } from './Segmented';
export type { SegmentedOption } from './Segmented';
```

- [ ] **Passo 5: Rodar e ver passar**

```bash
npx jest __tests__/ui/Selection.test.tsx
npx jest --silent && npx tsc --noEmit
```

- [ ] **Passo 6: Commit**

```bash
git add src/ui/ __tests__/ui/Selection.test.tsx
git commit -m "feat(BER-77): Chip e Segmented, sem gastar cor nova

O chip antigo pintava borda e texto com a cor da categoria, o que colocava
seis acentos na mesma tela. Aqui o selecionado inverte: destaca sem
introduzir cor. O Segmented nao dispara onChange na opcao ja ativa, para
nao recarregar lista a toa.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 13: `coverPalette` e `Cover`, a mídia principal do app

**Por quê:** a capa passa a ser a identidade visual. Saem a espada, a coroa e o raio sobre cor saturada, que faziam o livro parecer item de RPG. Entra uma capa de coleção: cor terrosa determinística por livro, título em serifa, filete e autor em versalete. Quando houver `cover_url` (BER-72), a capa real entra por cima.

**Arquivos:**
- Cria: `mobile/src/theme/coverPalette.ts`, `mobile/src/ui/Cover.tsx`
- Cria: `mobile/__tests__/theme/coverPalette.test.ts`, `mobile/__tests__/ui/Cover.test.tsx`
- Modifica: `mobile/src/ui/index.ts`

**Interfaces:**
- Consome: `COVER_PALETTE_COLORS`, `COVER_INK` (Tarefa 2), `Text` (Tarefa 9)
- Produz:
  - `coverColorFor(bookId: string): string`
  - `<Cover book size />`, com `size: 'xs' | 'sm' | 'md' | 'lg'` (48 · 74 · 108 · 160 de largura, proporção 2:3)
  - `testID`: `cover-generated` e `cover-real`

- [ ] **Passo 1: Escrever o teste da paleta**

Crie `mobile/__tests__/theme/coverPalette.test.ts`:

```ts
import { coverColorFor } from '../../src/theme/coverPalette';
import { COVER_PALETTE_COLORS } from '../../src/theme/tokens';

describe('coverColorFor', () => {
  it('sempre devolve uma cor da paleta', () => {
    for (const id of ['a', 'b', 'c', '00000000-0000-0000-0001-000000000001']) {
      expect(COVER_PALETTE_COLORS).toContain(coverColorFor(id) as any);
    }
  });

  it('e deterministico: o mesmo livro tem sempre a mesma capa', () => {
    const id = '00000000-0000-0000-0002-000000000002';
    expect(coverColorFor(id)).toBe(coverColorFor(id));
  });

  it('os tres livros do piloto nao ficam todos com a mesma cor', () => {
    const cores = new Set([
      coverColorFor('00000000-0000-0000-0001-000000000001'),
      coverColorFor('00000000-0000-0000-0002-000000000002'),
      coverColorFor('00000000-0000-0000-0003-000000000003'),
    ]);
    expect(cores.size).toBeGreaterThan(1);
  });

  it('id vazio nao quebra', () => {
    expect(COVER_PALETTE_COLORS).toContain(coverColorFor('') as any);
  });
});
```

- [ ] **Passo 2: Escrever o teste do Cover**

Crie `mobile/__tests__/ui/Cover.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { Cover } from '../../src/ui/Cover';
import type { Book } from '../../src/types/database';

const livro: Book = {
  id: '00000000-0000-0000-0001-000000000001',
  title: 'O Guia do Mochileiro das Galáxias',
  author: 'Douglas Adams',
  cover_url: null,
  total_pages: 215,
  genre: 'Ficção Científica',
  created_at: '',
};

describe('Cover', () => {
  it('sem cover_url, desenha a capa gerada com titulo e autor', () => {
    const { getByTestId, getByText } = render(<Cover book={livro} size="md" />);
    expect(getByTestId('cover-generated')).toBeTruthy();
    expect(getByText('O Guia do Mochileiro das Galáxias')).toBeTruthy();
    expect(getByText('Douglas Adams')).toBeTruthy();
  });

  it('com cover_url, a capa real entra por cima da gerada', () => {
    const { getByTestId } = render(
      <Cover book={{ ...livro, cover_url: 'https://covers.openlibrary.org/b/id/1-L.jpg' }} size="md" />,
    );
    expect(getByTestId('cover-real')).toBeTruthy();
    // A gerada continua atras: e ela que aparece enquanto a imagem carrega.
    expect(getByTestId('cover-generated')).toBeTruthy();
  });

  it('a capa inteira e um so elemento para o leitor de tela', () => {
    const { getByLabelText } = render(<Cover book={livro} size="sm" />);
    expect(getByLabelText('O Guia do Mochileiro das Galáxias, de Douglas Adams')).toBeTruthy();
  });

  it('mantem a proporcao 2:3 em todos os tamanhos', () => {
    for (const size of ['xs', 'sm', 'md', 'lg'] as const) {
      const { getByTestId } = render(<Cover book={livro} size={size} />);
      const s = getByTestId('cover-generated').props.style;
      const flat = Array.isArray(s) ? Object.assign({}, ...s.flat(9)) : s;
      expect(flat.height / flat.width).toBeCloseTo(1.5, 1);
    }
  });

  it('no tamanho xs some o texto, porque 48px nao comporta titulo legivel', () => {
    const { queryByText } = render(<Cover book={livro} size="xs" />);
    expect(queryByText('Douglas Adams')).toBeNull();
  });
});
```

- [ ] **Passo 3: Rodar e ver falhar**

```bash
npx jest __tests__/theme/coverPalette.test.ts __tests__/ui/Cover.test.tsx
```

Esperado: FALHA com módulo inexistente nos dois.

- [ ] **Passo 4: Implementar a paleta**

Crie `mobile/src/theme/coverPalette.ts`:

```ts
import { COVER_PALETTE_COLORS } from './tokens';

// Cor da capa gerada, sorteada pelo id do livro (BER-77).
//
// Deterministico de proposito: o leitor reconhece o livro pela cor, entao ela
// nao pode mudar entre sessoes nem entre aparelhos. Mesma ideia do coverFromId
// antigo, sem o emblema de RPG.
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function coverColorFor(bookId: string): string {
  return COVER_PALETTE_COLORS[hashStr(bookId) % COVER_PALETTE_COLORS.length];
}
```

- [ ] **Passo 5: Implementar o Cover**

Crie `mobile/src/ui/Cover.tsx`:

```tsx
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './Text';
import { coverColorFor } from '../theme/coverPalette';
import { COVER_INK, space, type as typeTokens } from '../theme/tokens';
import type { Book } from '../types/database';

type Size = 'xs' | 'sm' | 'md' | 'lg';

/** Largura por tamanho. A altura sai da proporcao 2:3 de livro. */
const WIDTH: Record<Size, number> = { xs: 48, sm: 74, md: 108, lg: 160 };
const TITLE_SIZE: Record<Size, number> = { xs: 0, sm: 11, md: 15, lg: 21 };

interface Props {
  book: Pick<Book, 'id' | 'title' | 'author' | 'cover_url'>;
  size?: Size;
  style?: ViewStyle;
}

// A capa e a midia principal do app. Sem cover_url, o app desenha uma capa de
// colecao; com cover_url (BER-72), a capa real entra POR CIMA da gerada, que
// segue atras como placeholder enquanto a imagem baixa.
export function Cover({ book, size = 'md', style }: Props) {
  const width = WIDTH[size];
  const height = Math.round(width * 1.5);
  const titleSize = TITLE_SIZE[size];
  const showText = titleSize > 0;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${book.title}, de ${book.author}`}
      style={[{ width, height }, style]}
    >
      <View
        testID="cover-generated"
        style={[
          styles.generated,
          { width, height, backgroundColor: coverColorFor(book.id), padding: size === 'xs' ? space.xs : space.md - 1 },
        ]}
      >
        {/* Lombada: duas linhas finas dao a leitura de objeto sem desenhar nada. */}
        <View style={styles.spine} pointerEvents="none" />
        {showText ? (
          <>
            <Text
              numberOfLines={4}
              style={[styles.title, { fontSize: titleSize, lineHeight: titleSize * 1.08 }]}
            >
              {book.title}
            </Text>
            <Text numberOfLines={1} style={[styles.author, { fontSize: Math.max(7, titleSize * 0.52) }]}>
              {book.author}
            </Text>
          </>
        ) : null}
      </View>

      {book.cover_url ? (
        <Image
          testID="cover-real"
          source={{ uri: book.cover_url }}
          style={[styles.real, { width, height }]}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  generated: {
    borderRadius: 3,
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 26,
    elevation: 8,
  },
  spine: {
    position: 'absolute',
    left: 5,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  title: {
    fontFamily: typeTokens.heading.fontFamily,
    color: COVER_INK,
  },
  author: {
    fontFamily: typeTokens.label.fontFamily,
    color: COVER_INK,
    opacity: 0.72,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    borderTopWidth: 1,
    borderTopColor: 'rgba(246,233,212,0.35)',
    paddingTop: space.xs + 1,
  },
  real: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 3,
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
  },
});
```

**Atenção:** o `rgba` literal no `spine`, no filete do autor e na sombra é sobreposição sobre a cor da capa, não cor de marca. A guarda da Tarefa 18 tem uma exceção nominal para `Cover.tsx`, registrada lá.

Acrescente a `mobile/src/ui/index.ts`:

```ts
export { Cover } from './Cover';
```

- [ ] **Passo 6: Rodar e ver passar**

```bash
npx jest __tests__/theme/coverPalette.test.ts __tests__/ui/Cover.test.tsx
```

Esperado: PASS. Se o `expo-image` não renderizar no Jest, acrescente ao `jest.setup.ui.js`:

```js
jest.mock('expo-image', () => {
  const { Image } = require('react-native');
  return { Image };
});
```

- [ ] **Passo 7: Verificar que nada regrediu**

```bash
npx jest --silent && npx tsc --noEmit
```

- [ ] **Passo 8: Commit**

```bash
git add src/theme/coverPalette.ts src/ui/ __tests__/theme/coverPalette.test.ts __tests__/ui/Cover.test.tsx
git commit -m "feat(BER-77): Cover, a capa como midia principal

Saem espada, coroa e raio sobre cor saturada, que faziam o livro parecer
item de RPG. Entra uma capa de colecao: cor terrosa deterministica pelo id,
titulo em serifa e autor em versalete.

A capa real (cover_url, BER-72) entra por cima da gerada, que fica atras
como placeholder enquanto a imagem baixa. A capa inteira e um so elemento
para o leitor de tela, com titulo e autor no label.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 14: `Ring` e `ProgressBar`

**Por quê:** o anel de nível é o símbolo do progresso em todo o app (38 na Hoje, 84 em Você, 112 no resumo e 160 na conquista) e é o que anima quando o XP sobe. A barra substitui a de hoje, que tem lábio e brilho falso.

**Arquivos:**
- Cria: `mobile/src/ui/Ring.tsx`, `mobile/src/ui/ProgressBar.tsx`
- Cria: `mobile/__tests__/ui/Progress.test.tsx`
- Modifica: `mobile/src/ui/index.ts`

**Interfaces:**
- Consome: tokens (Tarefa 2)
- Produz:
  - `<Ring progress size thickness trackColor color children accessibilityLabel>` — `progress` de 0 a 1, com `testID="ring-progress"` no arco
  - `<ProgressBar progress accessibilityLabel>` — `testID="progress-fill"` no preenchimento

- [ ] **Passo 1: Escrever o teste que falha**

Crie `mobile/__tests__/ui/Progress.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { Ring } from '../../src/ui/Ring';
import { ProgressBar } from '../../src/ui/ProgressBar';

describe('Ring', () => {
  it('desenha o arco proporcional ao progresso', () => {
    const { getByTestId } = render(<Ring progress={0.5} size={100} accessibilityLabel="Nível 4" />);
    const arco = getByTestId('ring-progress');
    const [preenchido, total] = String(arco.props.strokeDasharray).split(' ').map(Number);
    expect(preenchido / total).toBeCloseTo(0.5, 2);
  });

  it('progresso 0 nao desenha arco', () => {
    const { getByTestId } = render(<Ring progress={0} size={100} accessibilityLabel="Nível 1" />);
    expect(Number(String(getByTestId('ring-progress').props.strokeDasharray).split(' ')[0])).toBe(0);
  });

  it('progresso acima de 1 satura, em vez de dar a volta', () => {
    const { getByTestId } = render(<Ring progress={1.4} size={100} accessibilityLabel="Topo" />);
    const [preenchido, total] = String(getByTestId('ring-progress').props.strokeDasharray).split(' ').map(Number);
    expect(preenchido).toBeCloseTo(total, 1);
  });

  it('valor invalido nao quebra: trata como zero', () => {
    const { getByTestId } = render(<Ring progress={Number.NaN} size={100} accessibilityLabel="X" />);
    expect(Number(String(getByTestId('ring-progress').props.strokeDasharray).split(' ')[0])).toBe(0);
  });

  it('anuncia o progresso para o leitor de tela', () => {
    const { getByLabelText } = render(<Ring progress={0.84} size={100} accessibilityLabel="Nível 4" />);
    const el = getByLabelText('Nível 4');
    expect(el.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 84 });
  });

  it('renderiza o conteudo central', () => {
    const { getByText } = render(
      <Ring progress={0.5} size={100} accessibilityLabel="Nível 4">
        <RNText>4</RNText>
      </Ring>,
    );
    expect(getByText('4')).toBeTruthy();
  });
});

describe('ProgressBar', () => {
  it('preenche a fracao certa', () => {
    const { getByTestId } = render(<ProgressBar progress={0.4} accessibilityLabel="40 por cento lido" />);
    expect(getByTestId('progress-fill').props.style).toEqual(
      expect.objectContaining({ width: '40%' }),
    );
  });

  it('satura em 100 por cento', () => {
    const { getByTestId } = render(<ProgressBar progress={2} accessibilityLabel="Concluído" />);
    expect(getByTestId('progress-fill').props.style).toEqual(
      expect.objectContaining({ width: '100%' }),
    );
  });

  it('nao vai abaixo de zero com valor negativo', () => {
    const { getByTestId } = render(<ProgressBar progress={-1} accessibilityLabel="Nada lido" />);
    expect(getByTestId('progress-fill').props.style).toEqual(
      expect.objectContaining({ width: '0%' }),
    );
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx jest __tests__/ui/Progress.test.tsx
```

Esperado: FALHA com módulo inexistente.

- [ ] **Passo 3: Implementar o Ring**

Crie `mobile/src/ui/Ring.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { color } from '../theme/tokens';

interface Props {
  /** De 0 a 1. Valor fora da faixa satura; NaN vira 0. */
  progress: number;
  size: number;
  thickness?: number;
  accessibilityLabel: string;
  children?: React.ReactNode;
}

// O anel e o simbolo do progresso no app inteiro: 38 na Hoje, 84 em Voce, 112
// no resumo e 160 na conquista. A animacao de contagem entra na F7; aqui ele so
// precisa desenhar certo e se anunciar.
export function Ring({ progress, size, thickness = Math.max(3, size * 0.08), accessibilityLabel, children }: Props) {
  const seguro = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const raio = (size - thickness) / 2;
  const circunferencia = 2 * Math.PI * raio;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(seguro * 100) }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2} cy={size / 2} r={raio}
          fill="none" stroke={color.surface2} strokeWidth={thickness}
        />
        <Circle
          testID="ring-progress"
          cx={size / 2} cy={size / 2} r={raio}
          fill="none" stroke={color.accent} strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={`${circunferencia * seguro} ${circunferencia}`}
        />
      </Svg>
      {children ? <View style={styles.center} pointerEvents="none">{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // O arco comeca no topo, nao na direita.
  svg: { transform: [{ rotate: '-90deg' }] },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Passo 4: Implementar a ProgressBar**

Crie `mobile/src/ui/ProgressBar.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';
import { color } from '../theme/tokens';

interface Props {
  /** De 0 a 1. */
  progress: number;
  accessibilityLabel: string;
  /** Altura da trilha. Padrao 4: fio, nao barra de jogo. */
  height?: number;
}

// Sai o labio de 2px e o brilho branco da barra antiga. A leitura do progresso
// vem do contraste entre a trilha e o preenchimento, nao de efeito.
export function ProgressBar({ progress, accessibilityLabel, height = 4 }: Props) {
  const seguro = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const pct = `${Math.round(seguro * 100)}%` as const;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(seguro * 100) }}
      style={[styles.track, { height, borderRadius: height / 2 }]}
    >
      <View testID="progress-fill" style={{ width: pct, height: '100%', backgroundColor: color.text, borderRadius: height / 2 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', backgroundColor: color.surface2, overflow: 'hidden' },
});
```

Acrescente a `mobile/src/ui/index.ts`:

```ts
export { Ring } from './Ring';
export { ProgressBar } from './ProgressBar';
```

- [ ] **Passo 5: Rodar e ver passar**

```bash
npx jest __tests__/ui/Progress.test.tsx
npx jest --silent && npx tsc --noEmit
```

- [ ] **Passo 6: Commit**

```bash
git add src/ui/ __tests__/ui/Progress.test.tsx
git commit -m "feat(BER-77): Ring e ProgressBar, com saturacao e anuncio

O anel e o simbolo do progresso no app inteiro. Os dois saturam em vez de
dar a volta com valor fora da faixa, tratam NaN como zero e se anunciam com
accessibilityValue, o que nenhum componente do app fazia.

Sai o labio e o brilho branco da barra antiga: a leitura vem do contraste.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 15: `Skeleton`, `EmptyState`, `Banner` e `ListRow`

**Por quê:** são as quatro peças de estado que faltam. Hoje o carregamento é spinner de tela cheia, o vazio é emoji com texto e o erro é `Alert.alert`. O `ListRow` é o que permite lista com divisória, para nem tudo virar card.

**Arquivos:**
- Cria: `mobile/src/ui/Skeleton.tsx`, `EmptyState.tsx`, `Banner.tsx`, `ListRow.tsx`
- Cria: `mobile/__tests__/ui/States.test.tsx`
- Modifica: `mobile/src/ui/index.ts`

**Interfaces:**
- Consome: `Text`, `Button`, tokens
- Produz:
  - `<Skeleton width height radius />`
  - `<EmptyState title description actionLabel onAction />`
  - `<Banner tone message onRetry />`, com `tone: 'error' | 'info'`
  - `<ListRow onPress accessibilityLabel leading title subtitle trailing last />`

- [ ] **Passo 1: Escrever o teste que falha**

Crie `mobile/__tests__/ui/States.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { Skeleton } from '../../src/ui/Skeleton';
import { EmptyState } from '../../src/ui/EmptyState';
import { Banner } from '../../src/ui/Banner';
import { ListRow } from '../../src/ui/ListRow';

describe('Skeleton', () => {
  it('se anuncia como carregando, para o leitor de tela nao ler caixa vazia', () => {
    const { getByLabelText } = render(<Skeleton width={100} height={12} />);
    expect(getByLabelText('Carregando')).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('mostra titulo, explicacao e acao', () => {
    const { getByText, getByRole } = render(
      <EmptyState
        title="Estante vazia, por enquanto"
        description="Escolhe o primeiro livro no Explorar."
        actionLabel="Explorar livros"
        onAction={jest.fn()}
      />,
    );
    expect(getByText('Estante vazia, por enquanto')).toBeTruthy();
    expect(getByText('Escolhe o primeiro livro no Explorar.')).toBeTruthy();
    expect(getByRole('button')).toBeTruthy();
  });

  it('dispara a acao', () => {
    const onAction = jest.fn();
    const { getByRole } = render(
      <EmptyState title="T" description="D" actionLabel="Ir" onAction={onAction} />,
    );
    fireEvent.press(getByRole('button'));
    expect(onAction).toHaveBeenCalled();
  });

  it('sem acao, nao renderiza botao', () => {
    const { queryByRole } = render(<EmptyState title="T" description="D" />);
    expect(queryByRole('button')).toBeNull();
  });
});

describe('Banner', () => {
  it('mostra a mensagem e o botao de tentar de novo', () => {
    const onRetry = jest.fn();
    const { getByText, getByRole } = render(
      <Banner tone="error" message="Caiu a internet. O que você registrou tá salvo." onRetry={onRetry} />,
    );
    expect(getByText('Caiu a internet. O que você registrou tá salvo.')).toBeTruthy();
    fireEvent.press(getByRole('button'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('se anuncia como alerta', () => {
    const { getByRole } = render(<Banner tone="error" message="Falhou" />);
    expect(getByRole('alert')).toBeTruthy();
  });

  it('sem onRetry, nao renderiza botao', () => {
    const { queryByRole } = render(<Banner tone="info" message="Só um aviso" />);
    expect(queryByRole('button')).toBeNull();
  });
});

describe('ListRow', () => {
  it('e um botao com label quando tocavel', () => {
    const { getByRole } = render(
      <ListRow title="Capítulo 4" subtitle="p. 61 a 85" accessibilityLabel="Capítulo 4, quiz feito" onPress={jest.fn()} />,
    );
    expect(getByRole('button').props.accessibilityLabel).toBe('Capítulo 4, quiz feito');
  });

  it('nao vira botao quando nao tem onPress', () => {
    const { queryByRole, getByText } = render(<ListRow title="Capítulo 4" />);
    expect(queryByRole('button')).toBeNull();
    expect(getByText('Capítulo 4')).toBeTruthy();
  });

  it('anuncia desabilitado e nao dispara quando trancado', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <ListRow title="Capítulo 6" accessibilityLabel="Capítulo 6, trancado" onPress={onPress} disabled />,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
    expect(getByRole('button').props.accessibilityState.disabled).toBe(true);
  });

  it('renderiza leading e trailing', () => {
    const { getByText } = render(
      <ListRow
        title="Capítulo 4"
        leading={<RNText>L</RNText>}
        trailing={<RNText>92</RNText>}
      />,
    );
    expect(getByText('L')).toBeTruthy();
    expect(getByText('92')).toBeTruthy();
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx jest __tests__/ui/States.test.tsx
```

Esperado: FALHA com módulo inexistente.

- [ ] **Passo 3: Implementar as quatro peças**

Crie `mobile/src/ui/Skeleton.tsx`:

```tsx
import { useEffect } from 'react';
import { StyleSheet, type DimensionValue } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, useReducedMotion } from 'react-native-reanimated';
import { color, radius } from '../theme/tokens';

interface Props {
  width: DimensionValue;
  height: number;
  borderRadius?: number;
}

// Skeleton no formato do conteudo, em vez de spinner de tela cheia: a tela ja
// mostra a forma do que vai chegar, entao nao ha salto quando chega.
export function Skeleton({ width, height, borderRadius = radius.tag }: Props) {
  const opacity = useSharedValue(0.5);
  const semMovimento = useReducedMotion();

  useEffect(() => {
    if (semMovimento) return;
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity, semMovimento]);

  const animado = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessible
      accessibilityLabel="Carregando"
      style={[styles.base, { width, height, borderRadius }, animado]}
    />
  );
}

const styles = StyleSheet.create({ base: { backgroundColor: color.surface2 } });
```

Crie `mobile/src/ui/EmptyState.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { color, space } from '../theme/tokens';
import { COVER_PALETTE_COLORS } from '../theme/tokens';

interface Props {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

// A ilustracao e feita com as pecas do proprio sistema (lombadas de livro), sem
// mascote e sem emoji: o estado vazio continua sendo do mesmo produto.
export function EmptyState({ title, description, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.spines} pointerEvents="none">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.spine,
              { backgroundColor: COVER_PALETTE_COLORS[i], height: i === 1 ? 68 : 56, opacity: 0.5 },
            ]}
          />
        ))}
      </View>
      <Text variant="heading" align="center">{title}</Text>
      <Text variant="callout" tone="secondary" align="center" style={styles.desc}>{description}</Text>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button onPress={onAction}>{actionLabel}</Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.gutter },
  spines: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs, marginBottom: space.xl },
  spine: { width: 16, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  desc: { marginTop: space.sm, maxWidth: 280 },
  action: { marginTop: space.xl, minWidth: 200 },
});
```

Crie `mobile/src/ui/Banner.tsx`:

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { color, radius, space } from '../theme/tokens';

interface Props {
  tone: 'error' | 'info';
  message: string;
  onRetry?: () => void;
}

// Erro que nao derruba a tela: o que ja carregou continua visivel e o banner
// explica o resto. Substitui o Alert.alert, que tapa a tela e some sem rastro.
export function Banner({ tone, message, onRetry }: Props) {
  return (
    <View
      accessible
      accessibilityRole="alert"
      style={[styles.wrap, tone === 'error' ? styles.error : styles.info]}
    >
      <Text variant="callout" tone={tone === 'error' ? 'danger' : 'secondary'} style={styles.msg}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Tentar de novo" onPress={onRetry} hitSlop={8}>
          <Text variant="label" tone="accent">Tentar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  error: { backgroundColor: color.dangerSoft, borderColor: color.danger },
  info: { backgroundColor: color.surface1, borderColor: color.line },
  msg: { flex: 1 },
});
```

Crie `mobile/src/ui/ListRow.tsx`:

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { color, space, MIN_TOUCH } from '../theme/tokens';

interface Props {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** Ultima linha da lista: sem divisoria embaixo. */
  last?: boolean;
}

// Lista com divisoria, nao card: nem tudo precisa virar caixa com sombra. O card
// fica para o que e tocavel E isolado.
export function ListRow({
  title, subtitle, leading, trailing, onPress, disabled = false, accessibilityLabel, last = false,
}: Props) {
  const conteudo = (
    <View style={[styles.row, last ? null : styles.divider]}>
      {leading}
      <View style={styles.texts}>
        <Text variant="subhead" tone={disabled ? 'secondary' : 'primary'} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text variant="caption" tone="tertiary" numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {trailing}
    </View>
  );

  if (!onPress) return conteudo;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      {conteudo}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: MIN_TOUCH + 8,
    paddingVertical: space.md,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: color.line },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  pressed: { backgroundColor: color.surface1 },
});
```

Acrescente a `mobile/src/ui/index.ts`:

```ts
export { Skeleton } from './Skeleton';
export { EmptyState } from './EmptyState';
export { Banner } from './Banner';
export { ListRow } from './ListRow';
```

- [ ] **Passo 4: Rodar e ver passar**

```bash
npx jest __tests__/ui/States.test.tsx
npx jest --silent && npx tsc --noEmit
```

- [ ] **Passo 5: Commit**

```bash
git add src/ui/ __tests__/ui/States.test.tsx
git commit -m "feat(BER-77): Skeleton, EmptyState, Banner e ListRow

As quatro pecas de estado que faltavam. Hoje o carregamento e spinner de
tela cheia, o vazio e emoji com texto e o erro e Alert.alert.

O skeleton para de pulsar com reduce motion e se anuncia como carregando. O
vazio usa lombadas do proprio sistema, sem mascote. O banner deixa na tela
o que ja carregou. O ListRow permite lista com divisoria, para nem tudo
virar card com sombra.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 16: `Toast` e `ToastProvider`, o fim dos 20 `Alert.alert`

**Por quê:** o app usa `Alert.alert` 20 vezes como feedback, inclusive no momento mais importante do produto. O toast confirma sem tapar a tela e sem exigir um toque para sumir.

**Arquivos:**
- Cria: `mobile/src/ui/Toast.tsx`
- Cria: `mobile/__tests__/ui/Toast.test.tsx`
- Modifica: `mobile/src/ui/index.ts`, `mobile/app/_layout.tsx`

**Interfaces:**
- Consome: `Text`, tokens
- Produz:
  - `<ToastProvider>` (envolve o app no layout raiz)
  - `useToast(): { show(opts: ToastOptions): void }`, com `ToastOptions = { message: string; detail?: string; tone?: 'success' | 'error' | 'info'; actionLabel?: string; onAction?: () => void }`

- [ ] **Passo 1: Escrever o teste que falha**

Crie `mobile/__tests__/ui/Toast.test.tsx`:

```tsx
import { render, fireEvent, act } from '@testing-library/react-native';
import { Pressable, Text as RNText } from 'react-native';
import { ToastProvider, useToast } from '../../src/ui/Toast';

function Tela({ opts }: { opts: any }) {
  const { show } = useToast();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="disparar" onPress={() => show(opts)}>
      <RNText>disparar</RNText>
    </Pressable>
  );
}

const montar = (opts: any) =>
  render(<ToastProvider><Tela opts={opts} /></ToastProvider>);

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('nao aparece antes de alguem pedir', () => {
    const { queryByText } = montar({ message: '28 páginas registradas' });
    expect(queryByText('28 páginas registradas')).toBeNull();
  });

  it('mostra a mensagem quando pedido', () => {
    const { getByLabelText, getByText } = montar({ message: '28 páginas registradas' });
    fireEvent.press(getByLabelText('disparar'));
    expect(getByText('28 páginas registradas')).toBeTruthy();
  });

  it('mostra o detalhe junto', () => {
    const { getByLabelText, getByText } = montar({
      message: '28 páginas registradas', detail: 'mais 140 XP · 5 dias seguidos',
    });
    fireEvent.press(getByLabelText('disparar'));
    expect(getByText('mais 140 XP · 5 dias seguidos')).toBeTruthy();
  });

  it('some sozinho, sem exigir toque', () => {
    const { getByLabelText, queryByText } = montar({ message: 'Salvo' });
    fireEvent.press(getByLabelText('disparar'));
    act(() => { jest.advanceTimersByTime(5000); });
    expect(queryByText('Salvo')).toBeNull();
  });

  it('dispara a acao e fecha', () => {
    const onAction = jest.fn();
    const { getByLabelText, queryByText } = montar({
      message: 'Não deu para registrar', actionLabel: 'Tentar', onAction,
    });
    fireEvent.press(getByLabelText('disparar'));
    fireEvent.press(getByLabelText('Tentar'));
    expect(onAction).toHaveBeenCalled();
    expect(queryByText('Não deu para registrar')).toBeNull();
  });

  it('o toast novo substitui o anterior, em vez de empilhar', () => {
    const { getByLabelText, queryByText, rerender } = montar({ message: 'Primeiro' });
    fireEvent.press(getByLabelText('disparar'));
    rerender(<ToastProvider><Tela opts={{ message: 'Segundo' }} /></ToastProvider>);
    fireEvent.press(getByLabelText('disparar'));
    expect(queryByText('Primeiro')).toBeNull();
    expect(queryByText('Segundo')).toBeTruthy();
  });

  it('se anuncia como alerta para o leitor de tela', () => {
    const { getByLabelText, getByRole } = montar({ message: 'Salvo' });
    fireEvent.press(getByLabelText('disparar'));
    expect(getByRole('alert')).toBeTruthy();
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx jest __tests__/ui/Toast.test.tsx
```

Esperado: FALHA com módulo inexistente.

- [ ] **Passo 3: Implementar**

Crie `mobile/src/ui/Toast.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { color, elevation, radius, space } from '../theme/tokens';

export interface ToastOptions {
  message: string;
  detail?: string;
  tone?: 'success' | 'error' | 'info';
  actionLabel?: string;
  onAction?: () => void;
}

const DURATION_MS = 4000;

const ToastContext = createContext<{ show: (o: ToastOptions) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa de um ToastProvider acima na arvore');
  return ctx;
}

// Substitui os 20 Alert.alert do app. O alerta de sistema tapa a tela, exige um
// toque para sumir e some sem deixar rastro; o toast confirma e sai sozinho.
// So confirmacao destrutiva continua em dialogo.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const limpar = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const show = useCallback((o: ToastOptions) => {
    // Toast novo substitui o anterior: empilhar esconde a tela.
    limpar();
    setToast(o);
    timer.current = setTimeout(() => setToast(null), DURATION_MS);
  }, [limpar]);

  // O timer pendente dispararia contra uma arvore ja desmontada.
  useEffect(() => limpar, [limpar]);

  const valor = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={valor}>
      {children}
      {toast ? (
        <Animated.View
          entering={FadeInDown.duration(240)}
          exiting={FadeOutDown.duration(160)}
          accessible
          accessibilityRole="alert"
          style={[styles.wrap, elevation.floating, { bottom: insets.bottom + 90 }]}
        >
          <View style={styles.texts}>
            <Text variant="callout">{toast.message}</Text>
            {toast.detail ? <Text variant="caption" tone="secondary">{toast.detail}</Text> : null}
          </View>
          {toast.actionLabel && toast.onAction ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={toast.actionLabel}
              hitSlop={8}
              onPress={() => { limpar(); setToast(null); toast.onAction?.(); }}
            >
              <Text variant="label" tone="accent">{toast.actionLabel}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.control + 2,
  },
  texts: { flex: 1, gap: 1 },
});
```

- [ ] **Passo 4: Ligar no layout raiz**

Em `mobile/app/_layout.tsx`, envolva o `<Stack>` com `<SafeAreaProvider>` e `<ToastProvider>`:

```tsx
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '../src/ui/Toast';
```

e no retorno:

```tsx
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: color.bg }} onLayout={onLayout}>
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />
        </ToastProvider>
      </View>
    </SafeAreaProvider>
  );
```

- [ ] **Passo 5: Rodar e ver passar**

```bash
npx jest __tests__/ui/Toast.test.tsx
npx jest --silent && npx tsc --noEmit
```

- [ ] **Passo 6: Commit**

```bash
git add src/ui/ __tests__/ui/Toast.test.tsx app/_layout.tsx
git commit -m "feat(BER-77): Toast e ToastProvider, no lugar dos Alert.alert

O app usa Alert.alert 20 vezes como feedback, inclusive no fechamento de
capitulo, que e o momento central do produto. O alerta de sistema tapa a
tela, exige toque e some sem rastro.

O toast novo substitui o anterior em vez de empilhar, limpa o timer no
unmount e se anuncia como alerta. So confirmacao destrutiva continua em
dialogo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Tarefa 17: Guardas — os anti-patterns viram teste

**Por quê:** regra editorial sem enforcement morre na terceira entrega (padrão `copy-rules` da Wiki, provado no `prumo-lp-clientes`). Estas guardas impedem que a F4 em diante reintroduza hex solto, `fontSize` literal, `Alert.alert`, emoji ou tocável sem label. Elas são a diferença entre "o design system existe" e "o design system é obedecido".

**Arquivos:**
- Cria: `mobile/__tests__/guards/designTokens.test.ts`
- Cria: `mobile/__tests__/guards/copy.test.ts`
- Cria: `mobile/__tests__/guards/a11y.test.ts`

**Interfaces:**
- Consome: os arquivos-fonte de `src/ui`, `src/features`, `src/assistant` e `app`
- Produz: nada em runtime. As guardas rodam junto com `npx jest`.

**Como funcionam:** leem os arquivos com `fs` e procuram padrão proibido. São lentas se varrerem `node_modules`, então varrem só as pastas listadas.

- [ ] **Passo 1: Escrever a guarda de tokens**

Crie `mobile/__tests__/guards/designTokens.test.ts`:

```ts
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Regra editorial sem enforcement morre na terceira entrega. Estas guardas sao o
 * que mantem o design system obedecido quando as telas forem migrando (F4 a F6).
 */
const RAIZ = join(__dirname, '..', '..');

/** Pastas onde o sistema novo ja vale. src/components e app/(tabs) entram conforme migram. */
const VIGIADAS = ['src/ui', 'src/features', 'src/assistant', 'src/game'];

/**
 * Excecoes nominais, com motivo. Qualquer adicao aqui precisa de justificativa
 * no PR — a lista curta e o que dá valor a guarda.
 */
const EXCECOES_COR = new Set([
  // Sobreposicao sobre a cor da capa (lombada, filete, sombra): nao e cor de
  // marca, e alpha sobre um fundo que muda por livro.
  'src/ui/Cover.tsx',
  // Sombra preta da elevacao flutuante.
  'src/ui/Banner.tsx',
]);

function arquivos(dir: string): string[] {
  const abs = join(RAIZ, dir);
  let entradas: string[];
  try {
    entradas = readdirSync(abs);
  } catch {
    return []; // pasta ainda nao existe nesta fase
  }
  return entradas.flatMap((nome) => {
    const caminho = join(abs, nome);
    if (statSync(caminho).isDirectory()) return arquivos(join(dir, nome));
    return /\.tsx?$/.test(nome) ? [join(dir, nome).replace(/\\/g, '/')] : [];
  });
}

const TODOS = VIGIADAS.flatMap(arquivos);

describe('guarda: cor', () => {
  it('varre pelo menos um arquivo (a guarda nao passa por estar vazia)', () => {
    expect(TODOS.length).toBeGreaterThan(0);
  });

  it.each(TODOS)('%s nao tem cor literal fora dos tokens', (rel) => {
    if (EXCECOES_COR.has(rel)) return;
    const conteudo = readFileSync(join(RAIZ, rel), 'utf8');
    const achados = conteudo.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? [];
    expect(achados).toEqual([]);
  });
});

describe('guarda: tipografia', () => {
  it.each(TODOS)('%s nao tem fontSize nem fontFamily literal', (rel) => {
    // Os primitivos que consomem o token diretamente sao a fronteira do sistema.
    if (['src/ui/Text.tsx', 'src/ui/Field.tsx', 'src/ui/PageField.tsx', 'src/ui/Cover.tsx'].includes(rel)) return;
    const conteudo = readFileSync(join(RAIZ, rel), 'utf8');
    expect(conteudo).not.toMatch(/fontSize:\s*\d/);
    expect(conteudo).not.toMatch(/fontFamily:\s*['"]/);
  });
});

describe('guarda: feedback', () => {
  it.each(TODOS)('%s nao usa Alert.alert', (rel) => {
    const conteudo = readFileSync(join(RAIZ, rel), 'utf8');
    expect(conteudo).not.toMatch(/Alert\.alert/);
  });
});
```

- [ ] **Passo 2: Rodar e ver passar (ou falhar, e então corrigir a fonte)**

```bash
npx jest __tests__/guards/designTokens.test.ts
```

Esperado: PASS. **Se algum arquivo falhar, corrija o arquivo, não a guarda.** Só acrescente exceção se for sobreposição sobre cor variável, e escreva o motivo no comentário.

- [ ] **Passo 3: Escrever a guarda de copy**

Crie `mobile/__tests__/guards/copy.test.ts`:

```ts
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..');
const VIGIADAS = ['src/ui', 'src/features', 'src/assistant'];

/** Emoji e travessao: proibidos em texto de interface (DESIGN.md, secao Voice). */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const TRAVESSAO = /[—–]/;

function arquivos(dir: string): string[] {
  const abs = join(RAIZ, dir);
  let entradas: string[];
  try { entradas = readdirSync(abs); } catch { return []; }
  return entradas.flatMap((nome) => {
    const caminho = join(abs, nome);
    if (statSync(caminho).isDirectory()) return arquivos(join(dir, nome));
    return /\.tsx?$/.test(nome) ? [join(dir, nome).replace(/\\/g, '/')] : [];
  });
}

const TODOS = VIGIADAS.flatMap(arquivos);

/** So o que vira texto na tela. Comentario pode ter travessao. */
function linhasDeCodigo(conteudo: string): string[] {
  return conteudo
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'));
}

describe('guarda: copy', () => {
  it('varre pelo menos um arquivo', () => {
    expect(TODOS.length).toBeGreaterThan(0);
  });

  it.each(TODOS)('%s nao tem emoji', (rel) => {
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    expect(EMOJI.test(codigo)).toBe(false);
  });

  it.each(TODOS)('%s nao tem travessao em codigo', (rel) => {
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    expect(TRAVESSAO.test(codigo)).toBe(false);
  });
});
```

- [ ] **Passo 4: Escrever a guarda de acessibilidade**

Crie `mobile/__tests__/guards/a11y.test.ts`:

```ts
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..');
const VIGIADAS = ['src/ui', 'src/features'];

function arquivos(dir: string): string[] {
  const abs = join(RAIZ, dir);
  let entradas: string[];
  try { entradas = readdirSync(abs); } catch { return []; }
  return entradas.flatMap((nome) => {
    const caminho = join(abs, nome);
    if (statSync(caminho).isDirectory()) return arquivos(join(dir, nome));
    return /\.tsx$/.test(nome) ? [join(dir, nome).replace(/\\/g, '/')] : [];
  });
}

const TODOS = VIGIADAS.flatMap(arquivos);

/**
 * Zero accessibilityLabel no app inteiro foi um dos achados da auditoria. Aqui a
 * regra e grosseira de proposito: todo arquivo que renderiza Pressable precisa
 * declarar role e label em algum lugar. O teste de componente cobre o caso a caso.
 */
describe('guarda: acessibilidade', () => {
  it('varre pelo menos um arquivo', () => {
    expect(TODOS.length).toBeGreaterThan(0);
  });

  it.each(TODOS)('%s: se tem Pressable, declara role e label', (rel) => {
    const conteudo = readFileSync(join(RAIZ, rel), 'utf8');
    if (!/<Pressable|AnimatedPressable/.test(conteudo)) return;
    expect(conteudo).toMatch(/accessibilityRole=/);
    expect(conteudo).toMatch(/accessibilityLabel[=:]/);
  });
});
```

- [ ] **Passo 5: Rodar as três e a suíte inteira**

```bash
npx jest __tests__/guards/
npx jest --silent
npx tsc --noEmit
```

Esperado: guardas verdes e nenhuma regressão.

- [ ] **Passo 6: Commit**

```bash
git add __tests__/guards/
git commit -m "test(BER-77): guardas que impedem a volta dos anti-patterns

Regra editorial sem enforcement morre na terceira entrega. Estas guardas
barram cor literal, fontSize e fontFamily soltos, Alert.alert, emoji,
travessao em codigo e Pressable sem role ou label.

Cada guarda checa primeiro que varreu algum arquivo, para nao passar por
estar vazia. As excecoes sao nominais e comentadas: hoje so Cover e Banner,
onde o rgba e sobreposicao sobre cor variavel, nao cor de marca.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Ao fim da F2

- [ ] **Verificação final**

```bash
npx jest --silent
npx tsc --noEmit
npx expo install --check
```

Esperado: todas as suítes verdes (164 originais mais as novas), 0 erro de tipo e nenhuma divergência de dependência.

- [ ] **Prova no emulador**

Suba o app e confirme que **nada visual mudou**, exceto a splash escura, e que ele não quebra:

```bash
npx expo start --port 8088
```

Com `REACT_NATIVE_PACKAGER_HOSTNAME` apontando para a Ethernet real, se houver mais de uma interface de rede na máquina. O app ainda usa as telas antigas; a F2 só entrega a fundação. Confirme que abre, navega entre as abas e registra uma leitura.

- [ ] **Atualizar o Linear**

Comentar na `BER-77` o que a F2 entregou, com a contagem de testes e as dependências alteradas. A issue continua em `In Progress`, porque as fases seguintes fazem parte da mesma entrega.

- [ ] **Próximo plano**

A F3 (Navegação) ganha plano próprio, escrito antes de executar, aproveitando o que a F2 mostrar na prática (principalmente o comportamento do `formSheet` no Android, que é o risco registrado na spec).

---

## Autorrevisão deste plano

**Cobertura da spec (F2):** §3.1 cor → T2 · §3.2 tipografia → T2 e T9 · §3.3 espaço, raio e elevação → T2 · §3.4 motion → T2 (tokens), T10 e T15 (uso) · §3.5 voz → T4 e T8 · §3.6 anti-patterns → T4 e T17 · §4.1 e §4.2 XP e nível → T5 · §4.3 sequência → T6 · §4.4 conquistas → T7 · §5 assistente → T8 · §7.11 marca (splash e tema) → T3 · §8 estrutura → T9 a T16 · §8.1 dependências → T1 · §9 testes → todas as tarefas e T17.

**Fora da F2, por desenho:** a árvore de rotas e o `TabBar` (§6) são F3; as telas (§7.1 a §7.10) são F4 a F6; a troca dos arquivos de ícone (§7.11) é F3; a query `getMyAnswers` e o `progressStore` (§8) entram na F4, junto da primeira tela que os consome; a remoção de NativeWind, `shadow-2` e Lottie (§8.1) é F9.

**Consistência de tipos:** `TypeVariant` (T2) é consumido por `Text` (T9), `Field` (T11) e `Cover` (T13); `Tone` (T9) por `Button` (T10), `Chip` (T12), `Banner`, `EmptyState`, `ListRow` (T15) e `Toast` (T16); `color`, `space`, `radius` e `MIN_TOUCH` (T2) por todos os primitivos; `todayInSaoPaulo` (T6) é usado só dentro de `streak.ts`, e `lines.ts` (T8) calcula a hora com a mesma constante de fuso, sem importação cruzada.

**Riscos assumidos, registrados aqui e não escondidos:**
1. A Tarefa 3 tira Plus Jakarta do layout raiz, então as telas ainda não migradas usam o fallback do sistema até a F6. É visível no emulador e some fase a fase.
2. A guarda de cor da Tarefa 17 varre `src/ui`, `src/features`, `src/assistant` e `src/game`. Ela **não** varre `app/` nem `src/components` nesta fase, porque as telas antigas ainda estão cheias de literal. Ampliar o alcance é passo explícito da F6.
3. O `expo-image` pode não renderizar sob o `jest-expo`. A Tarefa 13 traz o mock pronto no Passo 6, aplicado só se o teste falhar — não vale mockar por precaução.
