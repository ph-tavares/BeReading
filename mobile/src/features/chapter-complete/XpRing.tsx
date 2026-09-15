// O anel grande da conquista (spec S7.3, F4-14, F4-24 e F4-25): conta de
// xpBefore ate o XP final e, na subida de nivel, completa, zera e continua. A
// contagem e estado do Ring (src/ui), na thread de UI; aqui ficam so a
// sequencia dos trechos, o centro e a fala de nivel.
import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import Animated, { useAnimatedProps, useDerivedValue, useReducedMotion } from 'react-native-reanimated';
import { Ring, Text, useRingCount } from '../../ui';
import { formatXp, type LevelInfo } from '../../game/xp';
import { levelUpLine } from '../../assistant/lines';
import { color, type as typeTokens } from '../../theme/tokens';
import { ringCaption, ringLabel, xpAt, type CountSegment, type XpPlan } from './logic';

export const RING_SIZE = 160; // Documentado em src/ui/Ring.tsx: 160 na conquista.

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// O numero usa a variante numericL, a mesma que um Text usaria. O teto de
// Dynamic Type vai como prop do TextInput, e nao dentro do estilo.
const { maxFontSizeMultiplier: TETO_DO_NUMERO, ...ESTILO_DO_NUMERO } = typeTokens.numericL;

interface Props {
  plan: XpPlan;
}

export function XpRing({ plan }: Props) {
  const semMovimento = useReducedMotion();
  const [trecho, setTrecho] = useState(0);

  // F4-14: so conta com trecho pra contar (veio xpBefore) e sem reduce motion.
  // Fora disso o anel ja nasce no valor final, sem nem pedir contagem ao Ring:
  // pedindo, ele chegaria no final sozinho, mas o centro mostraria o primeiro
  // trecho por um quadro.
  const segmento: CountSegment | undefined = semMovimento ? undefined : plan.segments[trecho];
  const terminou = segmento === undefined;

  return (
    <>
      <Ring
        progress={plan.finalLevel.progress}
        size={RING_SIZE}
        accessibilityLabel={ringLabel(plan.finalLevel, plan.finalXp)}
        // O id e o indice do trecho (F4-25): do piso do nivel 7 ao topo, os dois
        // trechos vao de 0 a 1, e so o indice diz que sao dois.
        count={segmento && {
          id: trecho,
          from: segmento.fromProgress,
          to: segmento.toProgress,
          onEnd: () => setTrecho((t) => t + 1),
        }}
      >
        <Centro
          segmento={segmento}
          level={segmento ? segmento.level : plan.finalLevel}
          finalXp={plan.finalXp}
        />
      </Ring>
      {plan.leveledUp ? (
        // O lugar da fala existe desde o inicio, invisivel e fora do leitor de
        // tela, para nada pular quando ela aparece no fim da contagem.
        <Text
          variant="subhead"
          tone="accent"
          align="center"
          style={terminou ? undefined : styles.invisivel}
          accessibilityElementsHidden={!terminou}
          importantForAccessibility={terminou ? 'auto' : 'no-hide-descendants'}
        >
          {levelUpLine(plan.finalLevel.level, plan.finalLevel.title)}
        </Text>
      ) : null}
    </>
  );
}

interface CentroProps {
  /** O trecho contando, ou `undefined` com o anel parado no final. */
  segmento: CountSegment | undefined;
  level: LevelInfo;
  finalXp: number;
}

function Centro({ segmento, level, finalXp }: CentroProps) {
  const fracao = useRingCount();

  // O XP conta na thread de UI, na mesma fracao do arco (spec secao 10): o texto
  // do TextInput muda sem render do JS.
  const texto = useDerivedValue(() => formatXp(segmento ? xpAt(segmento, fracao.value) : finalXp));
  const numero = useAnimatedProps(() => ({ text: texto.value, defaultValue: texto.value }) as TextInputProps);

  return (
    <>
      <Text variant="caption" tone="secondary">{`Nível ${level.level}`}</Text>
      <AnimatedTextInput
        testID="ring-xp"
        editable={false}
        caretHidden
        pointerEvents="none"
        underlineColorAndroid="transparent"
        // So o ponto de partida; dali em diante quem escreve e a thread de UI.
        defaultValue={formatXp(segmento ? segmento.fromXp : finalXp)}
        animatedProps={numero}
        maxFontSizeMultiplier={TETO_DO_NUMERO}
        // O progressbar do Ring ja anuncia o valor final; o numero contando fica fora.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.numero}
      />
      <Text variant="caption" tone="tertiary">{ringCaption(level)}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  invisivel: { opacity: 0 },
  numero: { ...ESTILO_DO_NUMERO, color: color.text, padding: 0, alignSelf: 'stretch', textAlign: 'center' },
});
