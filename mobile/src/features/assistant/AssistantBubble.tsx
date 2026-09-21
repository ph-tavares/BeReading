// A bolinha do assistente de leitura (BER-100).
//
// Mora no canto inferior esquerdo, acima da barra de abas e sobre o conteudo, e
// segue o leitor pelas telas de aba. E a decisao registrada na secao
// "Desenho (20/09/2026)" da BER-100 e no artboard `B1. Hoje com a bolinha`: ela
// substitui o botao quadrado na Hoje e devolve o card do assistente para o que
// ele ja faz, avisar de quiz pendente.
//
// O contrato da TabBar em DESIGN.md mudou junto com ela: ate aqui o documento
// proibia botao flutuante. Documento que mente e pior que documento nenhum.
//
// Canto esquerdo, e nao direito, porque a direita e onde a mao que segura o
// livro passa; e do lado oposto ao CTA da tela, para nao disputar com ele.
import { useCallback } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Glyph } from '../../assistant/Glyph';
import { TAB_BAR_HEIGHT } from '../../ui/TabBar';
import { color, elevation, radius, space } from '../../theme/tokens';

const TAMANHO = 56;

interface Props {
  onPress: () => void;
  /** Some enquanto nao ha nada para perguntar (leitor sem livro em leitura). */
  visible?: boolean;
}

export function AssistantBubble({ onPress, visible = true }: Props) {
  const insets = useSafeAreaInsets();

  const acionar = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  }, [onPress]);

  if (!visible) return null;

  return (
    <View
      // A bolinha nao intercepta toque fora dela: sem isto, a faixa inteira
      // acima da barra de abas viraria uma area morta sobre o conteudo.
      pointerEvents="box-none"
      style={[styles.ancora, { bottom: TAB_BAR_HEIGHT + insets.bottom + space.md }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Perguntar sobre uma página"
        accessibilityHint="Abre a câmera para fotografar a página em que você está"
        onPress={acionar}
        style={({ pressed }) => [styles.bolinha, pressed ? styles.pressionada : null]}
      >
        <Glyph size={22} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ancora: {
    position: 'absolute',
    left: space.gutter,
    right: space.gutter,
    alignItems: 'flex-start',
  },
  bolinha: {
    ...elevation.floating,
    width: TAMANHO,
    height: TAMANHO,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressionada: { backgroundColor: color.surface3 },
});
