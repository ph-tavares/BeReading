import { render } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { Circle } from 'react-native-svg';
import { Ring } from '../../src/ui/Ring';
import { ProgressBar } from '../../src/ui/ProgressBar';

// O arco anda por strokeDashoffset num Circle animado (F4-24): o dasharray fica
// fixo na circunferencia, e o offset diz quanto falta desenhar. No Jest, o
// createAnimatedComponent do mock devolve o proprio Circle, e o valor que a UI
// thread aplicaria chega em `animatedProps`. Isto le dali a fracao desenhada.
function arcoDesenhado(tela: ReturnType<typeof render>): number {
  const circulo = tela.UNSAFE_getAllByType(Circle).find((c) => c.props.testID === 'ring-progress');
  if (!circulo) throw new Error('arco nao encontrado');
  const total = Number(circulo.props.strokeDasharray[0]);
  return 1 - Number(circulo.props.animatedProps.strokeDashoffset) / total;
}

describe('Ring', () => {
  it('desenha o arco proporcional ao progresso', () => {
    const tela = render(<Ring progress={0.5} size={100} accessibilityLabel="Nível 4" />);
    expect(arcoDesenhado(tela)).toBeCloseTo(0.5, 2);
  });

  it('progresso 0 nao desenha arco', () => {
    const tela = render(<Ring progress={0} size={100} accessibilityLabel="Nível 1" />);
    expect(arcoDesenhado(tela)).toBeCloseTo(0, 5);
  });

  it('progresso acima de 1 satura, em vez de dar a volta', () => {
    const tela = render(<Ring progress={1.4} size={100} accessibilityLabel="Topo" />);
    expect(arcoDesenhado(tela)).toBeCloseTo(1, 5);
  });

  it('valor invalido nao quebra: trata como zero', () => {
    const tela = render(<Ring progress={Number.NaN} size={100} accessibilityLabel="X" />);
    expect(arcoDesenhado(tela)).toBeCloseTo(0, 5);
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

  // thickness padrao e Math.max(3, size * 0.08): sem teste, e a conta que
  // erra justamente nos tamanhos reais (38, 84, 112, 160 do app).
  it('a espessura padrao e proporcional ao tamanho (8% do diametro)', () => {
    const { getByTestId } = render(<Ring progress={0.5} size={100} accessibilityLabel="A" />);
    expect(getByTestId('ring-progress').props.strokeWidth).toBe(8);
  });

  it('a espessura padrao respeita o piso de 3 em tamanhos pequenos', () => {
    const { getByTestId } = render(<Ring progress={0.5} size={20} accessibilityLabel="B" />);
    expect(getByTestId('ring-progress').props.strokeWidth).toBe(3);
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

  it('valor invalido nao quebra: trata como zero', () => {
    const { getByTestId } = render(<ProgressBar progress={Number.NaN} accessibilityLabel="Invalido" />);
    expect(getByTestId('progress-fill').props.style).toEqual(
      expect.objectContaining({ width: '0%' }),
    );
  });
});
