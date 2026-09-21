// A barra de navegação: quatro abas e um botão central que começa a leitura.
//
// O botão saiu na F3 (decisão D5 da spec, "a ação vai para o contexto de cada
// tela") e isso deixou `app/register-reading.tsx` sem NENHUM caminho no app
// inteiro, com a suíte verde — o defeito que `__tests__/guards/rotas.test.ts`
// documenta em detalhe. Na BER-120 ele volta, mas SOMANDO: o botão dentro do
// bloco do livro na Hoje continua existindo. Dois caminhos para a ação central
// do produto, não um frágil.
//
// O destino do botão central chega por prop, e NÃO de um `useRouter` aqui
// dentro. Importar `expo-router` em `src/ui` arrastava a árvore ESM do router
// para dentro de qualquer teste que tocasse `src/ui/index.ts`, e sete suítes
// quebravam com "Cannot use import statement outside a module" — invisível na
// minha máquina, vermelho no `npm ci` limpo do CI. A regra que fica é mais
// simples que o sintoma: o design system não conhece rotas; quem conhece é a
// tela que o monta. Os nomes de rota (index, livros,
// catalogo, perfil) não mudam, para não quebrar deep link — ver
// src/components/CustomTabBar.tsx, a barra legada que esta substitui aos
// poucos, tela por tela, até a F6.
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
// SDK 57 (BER-117): o `Tabs` do expo-router deixou de depender do pacote
// público @react-navigation/bottom-tabs e passou a vender seu próprio fork;
// o tipo que o `tabBar` de fato recebe é este, não o do pacote npm (que nem
// está mais instalado).
import type { BottomTabBarProps, BottomTabNavigationOptions } from 'expo-router/build/react-navigation/bottom-tabs';
import Svg, { Circle, Path } from 'react-native-svg';
import { Text, TONE_COLOR, type Tone } from './Text';
import { color, hitSlop, radius, space, type as typeTokens, MIN_TOUCH } from '../theme/tokens';

type IconProps = { size: number; color: string };

// Peso de traço único para as quatro abas: a barra é o elemento mais visto
// do app, então o traço precisa casar com o do Glyph (src/assistant/Glyph.tsx).
const STROKE_WIDTH = 1.75;

function HomeIcon({ size, color: c }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 11.5 12 4l8 7.5M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9"
        stroke={c}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ShelfIcon({ size, color: c }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 3.5V20M9 5V20M14 6.5V20M19 4.5V20M4 20h15"
        stroke={c}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CompassIcon({ size, color: c }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.5} stroke={c} strokeWidth={STROKE_WIDTH} />
      <Path
        d="m14.7 9.3-1.9 4.9a1 1 0 0 1-.6.6l-4.9 1.9 1.9-4.9a1 1 0 0 1 .6-.6z"
        stroke={c}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PersonIcon({ size, color: c }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.5} stroke={c} strokeWidth={STROKE_WIDTH} />
      <Path
        d="M5 20c0-3.6 3.13-6.5 7-6.5s7 2.9 7 6.5"
        stroke={c}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      />
    </Svg>
  );
}

interface TabDef {
  /** Nome do arquivo de rota em app/(tabs), estável por causa do deep link. */
  name: string;
  /**
   * Rótulo usado só quando a rota não declara `title`/`tabBarLabel` em
   * `options` (ver `resolveLabel`). A Tarefa 4 já define `title` em cada
   * `Tabs.Screen`; sem este fallback ele nunca teria efeito e a tela e a
   * barra teriam duas fontes de verdade divergindo em silêncio.
   */
  fallbackLabel: string;
  Icon: React.ComponentType<IconProps>;
}

// O ícone continua fixo por route.name: é ativo de marca, não configuração
// de tela (decisão da rodada de correção 1). O rótulo, ao contrário, lê de
// `options` — ver resolveLabel abaixo.
const TABS: TabDef[] = [
  { name: 'index', fallbackLabel: 'Hoje', Icon: HomeIcon },
  { name: 'livros', fallbackLabel: 'Estante', Icon: ShelfIcon },
  { name: 'catalogo', fallbackLabel: 'Explorar', Icon: CompassIcon },
  { name: 'perfil', fallbackLabel: 'Você', Icon: PersonIcon },
];

// tabBarLabel pode ser string ou uma função de render (tipo da lib); só o
// primeiro caso interessa aqui, porque o rótulo da barra é sempre texto
// simples. title é sempre string quando presente.
function resolveLabel(options: BottomTabNavigationOptions | undefined, fallback: string): string {
  if (typeof options?.tabBarLabel === 'string') return options.tabBarLabel;
  if (options?.title) return options.title;
  return fallback;
}

const ICON_SIZE = 22;

/**
 * Lado do botão central. Maior que MIN_TOUCH de propósito: ele é a ação mais
 * usada do app e compete com quatro abas do mesmo tamanho ao redor.
 */
const FAB_SIZE = 56;

function PlusIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color.brandInk}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Altura do conteúdo da barra, sem a faixa de safe area: ícone + respiro +
// rótulo + respiro vertical acima e abaixo, tudo a partir de tokens. A F2
// tinha 28px de faixa fixa (bug que esta barra resolve com insets reais no
// próprio componente, ver uso de insets.bottom abaixo). O Screen (Tarefa 2) e
// o Toast consomem esta constante para não deixar conteúdo atrás da barra.
export const TAB_BAR_HEIGHT =
  space.sm * 2 + ICON_SIZE + space.xs + typeTokens.caption.lineHeight;

interface Props extends BottomTabBarProps {
  /**
   * O que o botão central faz. `session/start` é rota de stack, não aba,
   * então quem monta a barra resolve o destino — ver app/(tabs)/_layout.tsx.
   */
  onPressSessao: () => void;
}

export function TabBar({ state, navigation, descriptors, onPressSessao }: Props) {
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;

  const aoComecarSessao = () => {
    // Haptic médio, o da ação primária, contra o leve das abas.
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onPressSessao();
  };

  return (
    <View
      testID="tab-bar"
      accessibilityRole="tablist"
      style={[
        styles.wrap,
        { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
      {TABS.map((tab, indice) => {
        const route = state.routes.find((r) => r.name === tab.name);
        const selected = tab.name === activeName;
        // Ícone e rótulo saem do MESMO tom. Antes eram duas fontes paralelas —
        // `color.text`/`color.text3` no ícone e `'primary'`/`'tertiary'` no
        // Text — que hoje calham de casar. Mudar TONE_COLOR faria a barra ficar
        // com o ícone de uma cor e a palavra embaixo de outra, sem nada
        // acusando. Aqui só existe `tone`; a cor do ícone é consequência.
        // BER-120: a aba ativa e' acao, entao vai no jade. Antes era
        // 'primary' (a cor do texto comum), que na base nova deixava o
        // selecionado indistinguivel do rotulo ao lado.
        const tone: Tone = selected ? 'brand' : 'tertiary';
        const label = resolveLabel(route ? descriptors[route.key]?.options : undefined, tab.fallbackLabel);

        const onPress = () => {
          // Critério de aceite: nenhum haptic nem navegação ao tocar na aba
          // que já está ativa.
          if (selected) return;
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
          navigation.navigate(tab.name as never);
        };

        // O botão nasce entre a segunda e a terceira aba. Ele não é uma aba:
        // `accessibilityRole="button"` mantém o leitor de tela ouvindo quatro
        // abas, não cinco, e o teste trava isso.
        const central = indice === 2 ? (
          <Pressable
            key="fab"
            testID="fab-sessao"
            accessibilityRole="button"
            accessibilityLabel="Ler agora"
            onPress={aoComecarSessao}
            style={styles.fab}
          >
            <PlusIcon />
          </Pressable>
        ) : null;

        const aba = (
          <Pressable
            key={tab.name}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            hitSlop={hitSlop}
            onPress={onPress}
            style={styles.item}
          >
            <tab.Icon size={ICON_SIZE} color={TONE_COLOR[tone]} />
            <Text variant="caption" tone={tone}>
              {label}
            </Text>
          </Pressable>
        );

        return central ? [central, aba] : aba;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: color.surface1,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  item: {
    flex: 1,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    marginHorizontal: space.sm,
    // Sobe metade para fora da barra: é o que o distingue das abas sem
    // precisar de entalhe em SVG, que a F3 removeu de propósito.
    marginTop: -space.xl,
    borderRadius: radius.card,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
    // Borda na cor da barra: separa o botão do fundo sem sombra falsa.
    borderWidth: 3,
    borderColor: color.surface1,
  },
});
