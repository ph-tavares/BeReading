// Casca de tela: fundo, safe area e cabecalho opcional. Substitui o padrao
// repetido em cada tela (paddingTop: insets.top + 8 escrito a mao) e o
// TopBar antigo (src/components/TopBar.tsx), que usava paddingTop:58 fixo e
// quebrava em aparelho com notch de altura diferente.
import { RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { Text } from './Text';
import { IconButton } from './IconButton';
import { TAB_BAR_HEIGHT } from './TabBar';
import { color, space } from '../theme/tokens';

type Edge = 'top' | 'bottom';

interface Props {
  title?: string;
  subtitle?: string;
  /** Presente = mostra o botao de voltar. */
  onBack?: () => void;
  headerRight?: React.ReactNode;
  /** Default true: a maioria das telas rola. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  /** Bordas que recebem o inset real de safe area. Default so o topo: o
   * inferior normalmente ja tem a tab bar, que reserva o proprio espaco. */
  edges?: Edge[];
  children: React.ReactNode;
}

export function Screen({
  title,
  subtitle,
  onBack,
  headerRight,
  scroll = true,
  refreshing = false,
  onRefresh,
  contentStyle,
  edges = ['top'],
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const temCabecalho = Boolean(title || subtitle || onBack || headerRight);

  // Achado 3 da rodada de correção 1: 'bottom' em edges significa tela sem
  // tab bar (é o próprio comentário da prop, acima), e nesse caminho o
  // insets.bottom já entra uma vez no View raiz logo abaixo, sem barra
  // nenhuma para reservar espaço. Somar TAB_BAR_HEIGHT + insets.bottom de
  // novo aqui dobrava a margem inferior e reservava espaço de uma barra que
  // a tela não tem.
  const semTabBar = edges.includes('bottom');
  const reservaInferior = semTabBar ? 0 : TAB_BAR_HEIGHT + insets.bottom;

  const cabecalho = temCabecalho ? (
    <View style={styles.header}>
      {onBack ? (
        <IconButton icon={ArrowLeft} accessibilityLabel="Voltar" onPress={onBack} />
      ) : null}
      <View style={styles.headerTexts}>
        {title ? <Text variant="title">{title}</Text> : null}
        {subtitle ? (
          <Text variant="body" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {headerRight}
    </View>
  ) : null;

  // Reserva do fim do conteudo para nao ficar atras da TabBar: a constante
  // vem do proprio componente da barra (Tarefa 3), nunca de um numero solto
  // que desalinha assim que a altura da barra mudar. Achado 4 da rodada de
  // correcao 1: o caminho sem scroll usava a mesma reserva de zero do
  // caminho com scroll, armadilha viva para telas sem scroll da F4 em
  // diante — agora os dois caminhos usam a mesma `reservaInferior`.
  const conteudo = scroll ? (
    <ScrollView
      testID="screen-scroll"
      showsVerticalScrollIndicator={false}
      // Com teclado aberto (busca, login), o primeiro toque num botao tem que
      // acionar o botao, nao so fechar o teclado.
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: reservaInferior },
        contentStyle,
      ]}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.accent} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View
      testID="screen-content"
      style={[styles.content, styles.semScroll, { paddingBottom: reservaInferior }, contentStyle]}
    >
      {children}
    </View>
  );

  return (
    <View
      testID="screen-root"
      style={[
        styles.root,
        edges.includes('top') ? { paddingTop: insets.top } : null,
        edges.includes('bottom') ? { paddingBottom: insets.bottom } : null,
      ]}
    >
      {cabecalho}
      {conteudo}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.gutter,
    paddingBottom: space.md,
  },
  headerTexts: { flex: 1, gap: space.xs },
  content: { paddingHorizontal: space.gutter },
  semScroll: { flex: 1 },
});
