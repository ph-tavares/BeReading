import { useEffect } from 'react';
import { render, act } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { Circle } from 'react-native-svg';

// Estado counting do Ring (DESIGN.md secao 5, F4-21, F4-24).
//
// A contagem roda na UI thread (Reanimated), e o Jest nao anima. Por isso
// nenhum teste aqui afirma quadro intermediario: a curva no instante t e
// provada em funcao pura (__tests__/features/chapter-complete/countFrame.test.tsx).
// Aqui se prova a ligacao: o que o Ring pede ao Reanimated, quando avisa o fim,
// e o que desenha nas bordas de cada trecho.
//
// Duas sobrescritas do mock oficial, so nesta camada: o shared value persiste
// entre renders, como no aparelho (o oficial recria a cada render, e nenhum
// estado entre trechos seria observavel), e o withTiming nao conclui sozinho:
// o teste decide quando cada trecho acaba.
let mockReducedMotion = false;
type MockAnimacao = { para: number; config: unknown; aoAcabar?: (acabou: boolean) => void };
const mockAnimacoes: MockAnimacao[] = [];
const mockCurva = { curva: 'montada dos pontos do token' };
const mockBezier = jest.fn((..._pontos: number[]) => mockCurva);
const mockCancelar = jest.fn();

jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  const { useRef } = jest.requireActual('react');
  return {
    ...real,
    useReducedMotion: () => mockReducedMotion,
    useSharedValue: (inicial: unknown) => useRef({ value: inicial }).current,
    withTiming: (para: number, config: unknown, aoAcabar?: (acabou: boolean) => void) => {
      mockAnimacoes.push({ para, config, aoAcabar });
      return para;
    },
    cancelAnimation: (...args: unknown[]) => mockCancelar(...args),
    Easing: { ...real.Easing, bezier: (...pontos: number[]) => mockBezier(...pontos) },
  };
});

import { Ring, useRingCount } from '../../src/ui/Ring';
import { motion } from '../../src/theme/tokens';

type Tela = ReturnType<typeof render>;

/** A fracao desenhada: dasharray fixo na circunferencia, offset e o que falta. */
function arco(tela: Tela): number {
  const circulo = tela.UNSAFE_getAllByType(Circle).find((c) => c.props.testID === 'ring-progress');
  if (!circulo) throw new Error('arco nao encontrado');
  const total = Number(circulo.props.strokeDasharray[0]);
  return 1 - Number(circulo.props.animatedProps.strokeDashoffset) / total;
}

const montagens = jest.fn();

/** Conteudo central de mentira: le a fracao da contagem e conta as montagens. */
function Sonda() {
  const fracao = useRingCount();
  useEffect(() => {
    montagens();
  }, []);
  return <RNText>{`fração ${fracao.value}`}</RNText>;
}

async function concluir(indice: number, acabou = true) {
  await act(async () => {
    mockAnimacoes[indice].aoAcabar?.(acabou);
  });
}

describe('Ring: estado counting na UI thread (DESIGN.md secao 5, F4-24)', () => {
  beforeEach(() => {
    mockReducedMotion = false;
    mockAnimacoes.length = 0;
    mockBezier.mockClear();
    mockCancelar.mockClear();
    montagens.mockClear();
  });

  it('sem count: estatico no valor, sem withTiming, e o centro le a fracao cheia', () => {
    const tela = render(
      <Ring progress={0.5} size={100} accessibilityLabel="Nível 4"><Sonda /></Ring>,
    );
    expect(arco(tela)).toBeCloseTo(0.5, 5);
    expect(mockAnimacoes).toHaveLength(0);
    expect(tela.getByText('fração 1')).toBeTruthy();
  });

  it('com count: pede withTiming ate 1 com a duracao e a curva do token, e sai do from', () => {
    const tela = render(
      <Ring progress={0.8} size={100} accessibilityLabel="Nível 4" count={{ id: 0, from: 0.2 }}>
        <Sonda />
      </Ring>,
    );
    expect(mockAnimacoes).toHaveLength(1);
    expect(mockAnimacoes[0].para).toBe(1);
    expect(mockAnimacoes[0].config).toEqual({ duration: motion.count.duration, easing: mockCurva });
    expect((mockAnimacoes[0].config as { easing: unknown }).easing).toBe(mockCurva);
    expect(mockBezier).toHaveBeenCalledWith(...motion.count.easing);
    expect(arco(tela)).toBeCloseTo(0.2, 5);
    expect(tela.getByText('fração 0')).toBeTruthy();
  });

  it('avisa o fim quando a animacao conclui, uma vez, e nao antes', async () => {
    const onEnd = jest.fn();
    render(<Ring progress={0.8} size={100} accessibilityLabel="X" count={{ id: 0, from: 0.2, onEnd }} />);
    await act(async () => {});
    expect(onEnd).not.toHaveBeenCalled();

    await concluir(0);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('o leitor de tela ouve o valor final, mesmo com `to` diferente de `progress`', async () => {
    const tela = render(
      <Ring progress={0.3} size={100} accessibilityLabel="Nível 5" count={{ id: 0, from: 0.9, to: 1 }} />,
    );
    expect(arco(tela)).toBeCloseTo(0.9, 5);
    expect(tela.getByLabelText('Nível 5').props.accessibilityValue).toEqual({ min: 0, max: 100, now: 30 });

    await concluir(0);
    expect(tela.getByLabelText('Nível 5').props.accessibilityValue.now).toBe(30);
  });

  it('mesma arvore com e sem contagem: nada remonta quando a contagem acaba ou recomeca', () => {
    const tela = render(
      <Ring progress={0.8} size={100} accessibilityLabel="Nível 4" count={{ id: 0, from: 0.2 }}>
        <Sonda />
      </Ring>,
    );
    const no = tela.getByRole('progressbar');

    tela.rerender(<Ring progress={0.8} size={100} accessibilityLabel="Nível 4"><Sonda /></Ring>);
    expect(montagens).toHaveBeenCalledTimes(1);
    expect(tela.getByRole('progressbar')).toBe(no);
    expect(arco(tela)).toBeCloseTo(0.8, 5);

    tela.rerender(
      <Ring progress={0.8} size={100} accessibilityLabel="Nível 4" count={{ id: 1, from: 0 }}>
        <Sonda />
      </Ring>,
    );
    expect(montagens).toHaveBeenCalledTimes(1);
    expect(tela.getByRole('progressbar')).toBe(no);
  });

  it('dois trechos seguidos com os mesmos valores e outro id: o segundo tambem conta e avisa o fim (F4-25)', async () => {
    const primeiro = jest.fn();
    const segundo = jest.fn();
    const tela = render(
      <Ring progress={1} size={100} accessibilityLabel="X" count={{ id: 0, from: 0, to: 1, onEnd: primeiro }} />,
    );
    await concluir(0);
    expect(primeiro).toHaveBeenCalledTimes(1);

    tela.rerender(
      <Ring progress={1} size={100} accessibilityLabel="X" count={{ id: 1, from: 0, to: 1, onEnd: segundo }} />,
    );
    expect(mockAnimacoes).toHaveLength(2);

    await concluir(1);
    expect(segundo).toHaveBeenCalledTimes(1);
    expect(primeiro).toHaveBeenCalledTimes(1);
  });

  it('trecho novo comeca no from dele, e nao no fim do trecho anterior', async () => {
    const tela = render(
      <Ring progress={0.3} size={100} accessibilityLabel="X" count={{ id: 0, from: 0.9, to: 1 }}>
        <Sonda />
      </Ring>,
    );
    await concluir(0);

    // Neste render o shared value ainda esta no fim do trecho anterior.
    tela.rerender(
      <Ring progress={0.3} size={100} accessibilityLabel="X" count={{ id: 1, from: 0 }}>
        <Sonda />
      </Ring>,
    );
    expect(arco(tela)).toBeCloseTo(0, 5);
    expect(tela.getByText('fração 0')).toBeTruthy();
  });

  it('trocar so o onEnd no meio nao reinicia a contagem, e o fim chama o onEnd mais novo', async () => {
    const velho = jest.fn();
    const novo = jest.fn();
    const tela = render(
      <Ring progress={0.8} size={100} accessibilityLabel="X" count={{ id: 0, from: 0.2, onEnd: velho }} />,
    );
    tela.rerender(
      <Ring progress={0.8} size={100} accessibilityLabel="X" count={{ id: 0, from: 0.2, onEnd: novo }} />,
    );
    expect(mockAnimacoes).toHaveLength(1);

    await concluir(0);
    expect(novo).toHaveBeenCalledTimes(1);
    expect(velho).not.toHaveBeenCalled();
  });

  it('com reduce motion: nenhum withTiming, valor final direto, e o fim avisado', async () => {
    mockReducedMotion = true;
    const onEnd = jest.fn();
    const tela = render(
      <Ring progress={0.8} size={100} accessibilityLabel="Nível 4" count={{ id: 0, from: 0.2, onEnd }}>
        <Sonda />
      </Ring>,
    );
    await act(async () => {});
    expect(mockAnimacoes).toHaveLength(0);
    expect(arco(tela)).toBeCloseTo(0.8, 5);
    expect(tela.getByText('fração 1')).toBeTruthy();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('desmontar no meio cancela a animacao, e a conclusao cancelada nao avisa fim', async () => {
    const onEnd = jest.fn();
    const tela = render(
      <Ring progress={0.8} size={100} accessibilityLabel="X" count={{ id: 0, from: 0.2, onEnd }} />,
    );
    tela.unmount();
    expect(mockCancelar).toHaveBeenCalledTimes(1);

    await concluir(0, false);
    expect(onEnd).not.toHaveBeenCalled();
  });
});
