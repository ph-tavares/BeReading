import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { FullWindowOverlay } from 'react-native-screens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, type Status } from './Text';
import { TAB_BAR_HEIGHT } from './TabBar';
import { color, elevation, motion, radius, space } from '../theme/tokens';

export interface ToastOptions {
  message: string;
  detail?: string;
  tone?: Status;
  actionLabel?: string;
  onAction?: () => void;
}

const DURATION_MS = 4000;

// Ponto indicador a esquerda do texto: sem ele, toast de erro e de sucesso sao
// visualmente identicos, e quem le rapido nao distingue os dois.
const TONE_INDICATOR: Record<Status, { dot: string; halo: string }> = {
  positive: { dot: color.positive, halo: color.positiveSoft },
  danger: { dot: color.danger, halo: color.dangerSoft },
  info: { dot: color.text2, halo: color.surface2 },
};

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
  // F4-11: chave da montagem do FullWindowOverlay no iOS, `null` sem camada.
  // Muda a cada toast, e o motivo esta no render, abaixo.
  const [camada, setCamada] = useState<number | null>(null);
  const contador = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerCamada = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const limpar = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (timerCamada.current) clearTimeout(timerCamada.current);
    timer.current = null;
    timerCamada.current = null;
  }, []);

  // O toast sai na hora; a camada, so depois da animacao de saida. Desmontar os
  // dois juntos cortaria o motion.exit, que acontece dentro da camada.
  const esconder = useCallback(() => {
    setToast(null);
    timerCamada.current = setTimeout(() => setCamada(null), motion.exit.duration);
  }, []);

  const show = useCallback((o: ToastOptions) => {
    // Toast novo substitui o anterior: empilhar esconde a tela.
    limpar();
    contador.current += 1;
    setCamada(contador.current);
    setToast(o);
    timer.current = setTimeout(esconder, DURATION_MS);
  }, [limpar, esconder]);

  // O timer pendente dispararia contra uma arvore ja desmontada.
  useEffect(() => limpar, [limpar]);

  const valor = useMemo(() => ({ show }), [show]);

  const conteudo = toast ? (
    <Animated.View
      // Duracao de tokens.ts, nao literal: eram os mesmos valores de
      // motion.enter/motion.exit escritos a mao, sem ler o token.
      entering={FadeInDown.duration(motion.enter.duration)}
      exiting={FadeOutDown.duration(motion.exit.duration)}
      accessible
      accessibilityRole="alert"
      // accessibilityRole="alert" sozinho nao dispara anuncio no TalkBack
      // (Android): so funciona junto de accessibilityLiveRegion="polite",
      // que e o que de fato aciona a regiao viva. Sem isso, o toast (que
      // substitui os Alert.alert nativos, esses sim anunciados) fica mudo
      // para quem usa leitor de tela.
      accessibilityLiveRegion="polite"
      // TAB_BAR_HEIGHT é a altura total da barra (ver TabBar.tsx): sem
      // um respiro a mais, o toast encostava nela. space.md dá essa
      // folga (achado 5 da rodada de correção 1).
      style={[
        styles.wrap,
        elevation.floating,
        { bottom: insets.bottom + TAB_BAR_HEIGHT + space.md },
      ]}
    >
      <View style={[styles.indicatorHalo, { backgroundColor: TONE_INDICATOR[toast.tone ?? 'info'].halo }]}>
        <View
          testID="toast-indicator"
          style={[styles.indicatorDot, { backgroundColor: TONE_INDICATOR[toast.tone ?? 'info'].dot }]}
        />
      </View>
      <View style={styles.texts}>
        <Text variant="callout">{toast.message}</Text>
        {toast.detail ? <Text variant="caption" tone="secondary">{toast.detail}</Text> : null}
      </View>
      {toast.actionLabel && toast.onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={toast.actionLabel}
          hitSlop={8}
          onPress={() => { limpar(); esconder(); toast.onAction?.(); }}
        >
          <Text variant="label" tone="accent">{toast.actionLabel}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  ) : null;

  return (
    <ToastContext.Provider value={valor}>
      {children}
      {Platform.OS === 'ios' ? (
        // F4-11: no iOS, sheet e modal nativos (o formSheet do registro, os
        // fullScreenModal do quiz) sao apresentados ACIMA da raiz, onde este
        // provider vive, e o toast ficava atras deles. O FullWindowOverlay poe a
        // camada direto na janela.
        //
        // - Monta so enquanto ha toast, e com chave nova a cada um: o container
        //   nativo entra na janela quando monta, e um montado antes de o sheet
        //   abrir ficaria atras do sheet.
        // - Toque: o container so responde onde ha subview (pointInside e
        //   hitTest em ios/RNSFullWindowOverlay.mm), entao o "Tentar" recebe o
        //   toque e o resto da tela continua tocavel.
        // - Nao modal: o padrao do nativo e accessibilityViewIsModal = YES, que
        //   prenderia o VoiceOver no toast enquanto ele existe.
        //
        // So no iOS: fora dele o componente vira View e avisa no console
        // (src/components/FullWindowOverlay.tsx do pacote).
        camada !== null ? (
          <FullWindowOverlay key={camada} unstable_accessibilityContainerViewIsModal={false}>
            {conteudo}
          </FullWindowOverlay>
        ) : null
      ) : (
        conteudo
      )}
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
  indicatorHalo: {
    width: space.lg,
    height: space.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorDot: {
    width: space.sm,
    height: space.sm,
    borderRadius: radius.pill,
  },
});
