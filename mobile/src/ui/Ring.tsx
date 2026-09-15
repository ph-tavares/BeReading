import { createContext, useContext, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle } from 'react-native-svg';
import { color, motion } from '../theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Estado counting (DESIGN.md secao 5): um trecho do arco andando em `motion.count`. */
export interface RingCount {
  /**
   * Identidade do trecho (F4-25). Trocar o id recomeca a contagem mesmo com os
   * mesmos valores: do piso do nivel 7 ao topo, os dois trechos vao de 0 a 1.
   */
  id: string | number;
  /** De onde o arco sai, de 0 a 1. */
  from: number;
  /** Onde o arco para neste trecho, de 0 a 1. Padrao: `progress`. */
  to?: number;
  /** Uma vez, quando o trecho termina. Com reduce motion, logo ao montar. */
  onEnd?: () => void;
}

interface Props {
  /**
   * De 0 a 1. Valor fora da faixa satura; NaN vira 0. E o valor final: o que o
   * leitor de tela ouve, sempre, mesmo durante a contagem.
   */
  progress: number;
  size: number;
  thickness?: number;
  accessibilityLabel: string;
  /** Sem ele, o anel e estatico (estado default). */
  count?: RingCount;
  /** Conteudo central. Para contar junto, le a fracao com `useRingCount()`. */
  children?: React.ReactNode;
}

function saturar(valor: number): number {
  return Number.isFinite(valor) ? Math.min(1, Math.max(0, valor)) : 0;
}

/** Onde o arco esta numa fracao da contagem (0 a 1, curva ja aplicada). */
export function ringProgressAt(from: number, to: number, fraction: number): number {
  'worklet';
  return from + (to - from) * fraction;
}

const ContagemDoAnel = createContext<SharedValue<number> | null>(null);

/**
 * A fracao da contagem do Ring em volta, de 0 a 1 com a curva de `motion.count`,
 * como shared value: o conteudo central conta na UI thread, junto com o arco,
 * sem render do JS por quadro. Fora de contagem (sem `count` ou com reduce
 * motion), vale 1.
 */
export function useRingCount(): SharedValue<number> {
  const fracao = useContext(ContagemDoAnel);
  if (!fracao) throw new Error('useRingCount so funciona dentro do conteudo de um Ring.');
  return fracao;
}

// O anel e o simbolo do progresso no app inteiro: 38 na Hoje, 84 em Voce, 112
// no resumo e 160 na conquista.
//
// Estados do DESIGN.md secao 5. Default: sem `count`, desenha o valor. Counting:
// com `count`, o arco anda de `from` ate `to` em `motion.count`. Reduced motion:
// com `count` e o sistema pedindo menos movimento, aparece direto em `progress`.
//
// Motion na thread de UI (spec secao 10): um shared value animado por
// withTiming desenha o arco por strokeDashoffset, sem render por quadro. A
// arvore e a mesma nos tres estados: trocar de componente quando a contagem
// acaba remontaria o no do progressbar, e o foco do leitor de tela se perderia.
//
// Um trecho por vez. A subida de nivel (completa, zera, continua) e sequencia
// de quem usa, trecho a trecho, pelo `onEnd`.
export function Ring({
  progress, size, thickness = Math.max(3, size * 0.08), accessibilityLabel, count, children,
}: Props) {
  const semMovimento = useReducedMotion();
  const final = saturar(progress);
  const contando = count !== undefined && !semMovimento;
  const de = count ? saturar(count.from) : final;
  const ate = count ? saturar(count.to ?? progress) : final;
  const chave = count ? `${count.id}:${de}:${ate}` : '';

  const fracao = useSharedValue(0);
  // O trecho a que `fracao` pertence. Enquanto o efeito de um trecho novo nao
  // roda, `fracao` ainda guarda o fim do anterior, e o arco desenharia esse fim
  // por um quadro: com a chave diferente, a fracao do trecho vale 0.
  const chaveAnimada = useSharedValue(chave);

  // O onEnd mais recente, fora das dependencias: quem usa passa funcao nova a
  // cada render, e isso nao pode reiniciar a contagem.
  const aoTerminar = useRef(count?.onEnd);
  aoTerminar.current = count?.onEnd;

  useEffect(() => {
    if (chave === '') return undefined;
    if (semMovimento) {
      aoTerminar.current?.();
      return undefined;
    }
    const avisarFim = () => aoTerminar.current?.();
    chaveAnimada.value = chave;
    fracao.value = 0;
    fracao.value = withTiming(
      1,
      { duration: motion.count.duration, easing: Easing.bezier(...motion.count.easing) },
      (acabou) => {
        'worklet';
        if (acabou) scheduleOnRN(avisarFim);
      },
    );
    return () => cancelAnimation(fracao);
  }, [chave, semMovimento, fracao, chaveAnimada]);

  const fracaoDoTrecho = useDerivedValue(() => {
    if (!contando) return 1;
    return chaveAnimada.value === chave ? fracao.value : 0;
  });

  const raio = (size - thickness) / 2;
  const circunferencia = 2 * Math.PI * raio;

  const arco = useAnimatedProps(() => {
    const desenhado = contando ? ringProgressAt(de, ate, fracaoDoTrecho.value) : final;
    return { strokeDashoffset: circunferencia * (1 - desenhado) };
  });

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(final * 100) }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2} cy={size / 2} r={raio}
          fill="none" stroke={color.surface2} strokeWidth={thickness}
        />
        <AnimatedCircle
          testID="ring-progress"
          cx={size / 2} cy={size / 2} r={raio}
          fill="none" stroke={color.accent} strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={[circunferencia, circunferencia]}
          animatedProps={arco}
        />
      </Svg>
      {children ? (
        <ContagemDoAnel.Provider value={fracaoDoTrecho}>
          <View style={styles.center} pointerEvents="none">{children}</View>
        </ContagemDoAnel.Provider>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // O arco comeca no topo, nao na direita.
  svg: { transform: [{ rotate: '-90deg' }] },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
