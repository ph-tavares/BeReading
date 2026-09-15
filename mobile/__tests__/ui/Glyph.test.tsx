import { render } from '@testing-library/react-native';
import { processColor } from 'react-native';
import { Glyph } from '../../src/assistant/Glyph';
import { color } from '../../src/theme/tokens';

// O proprio Glyph se marca como escondido do leitor de tela
// (accessibilityElementsHidden + importantForAccessibility). A
// testing-library exclui por padrao qualquer subarvore assim das queries
// (e o motivo certo: nenhum outro componente devia "achar" um glyph
// decorativo por acidente) — por isso todo getByTestId aqui pede
// includeHiddenElements explicitamente.
const HIDDEN = { includeHiddenElements: true };

// A cor processada tanto pode vir como numero puro quanto como o objeto
// { payload, type } da nova arquitetura, dependendo de como o valor passou
// pelo pipeline nativo. Le os dois formatos para a comparacao nao depender
// disso, so da cor em si.
function lerCorProcessada(valor: unknown): number {
  return typeof valor === 'object' && valor !== null ? (valor as { payload: number }).payload : (valor as number);
}

describe('Glyph', () => {
  it('mantem a proporcao 3:4 no tamanho padrao', () => {
    const { getByTestId } = render(<Glyph />);
    const el = getByTestId('glyph', HIDDEN);
    expect(el.props.width).toBe(20);
    expect(el.props.height / el.props.width).toBeCloseTo(4 / 3, 5);
  });

  it('mantem a proporcao 3:4 em outro tamanho', () => {
    const { getByTestId } = render(<Glyph size={60} />);
    const el = getByTestId('glyph', HIDDEN);
    expect(el.props.width).toBe(60);
    expect(el.props.height / el.props.width).toBeCloseTo(4 / 3, 5);
  });

  it('e escondido do leitor de tela, por ser decorativo', () => {
    const { getByTestId } = render(<Glyph />);
    const el = getByTestId('glyph', HIDDEN);
    expect(el.props.accessibilityElementsHidden).toBe(true);
    expect(el.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('usa cor de tokens, nunca literal', () => {
    const { getByTestId } = render(<Glyph />);
    // Confere que o path do marcador (o retangulo em si, nao os olhos) esta
    // pintado com color.accent, o unico acento do produto (DESIGN.md secao 1).
    // O react-native-svg devolve a cor ja processada (processColor), nao a
    // string original: compara os dois lados pela mesma funcao.
    const path = getByTestId('glyph-shape', HIDDEN);
    expect(lerCorProcessada(path.props.fill)).toBe(lerCorProcessada(processColor(color.accent)));
  });
});
