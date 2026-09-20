import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Mascote, MASCOTE_SIZES } from '../../src/assistant/Mascote';

/**
 * O mascote e' ilustracao, nao icone. A licao que o projeto ja pagou uma vez
 * (assets/brand/icon-mark.svg nasceu porque os olhos do glyph paravam de ler
 * em 1024px) vale ao contrario aqui: abaixo de ~80pt o desenho vira borrao.
 *
 * Por isso `size` e' um conjunto nomeado e nao um numero: nao existe API que
 * permita alguem escrever <Mascote size={20} /> e descobrir no aparelho. Quem
 * precisa de marca pequena usa o Glyph, que continua existindo para isso.
 */
// Mesmo motivo do Glyph.test: o mascote se marca como escondido do leitor de
// tela, e a testing-library exclui subarvore assim por padrao — corretamente,
// porque nenhum componente devia "achar" uma ilustracao decorativa por acaso.
const HIDDEN = { includeHiddenElements: true };

describe('Mascote', () => {
  it('todo tamanho nomeado fica acima do piso em que a ilustração ainda lê', () => {
    for (const valor of Object.values(MASCOTE_SIZES)) {
      expect(valor).toBeGreaterThanOrEqual(80);
    }
  });

  it('renderiza a imagem do mascote', () => {
    const { getByTestId } = render(<Mascote size="md" />);
    expect(getByTestId('mascote', HIDDEN)).toBeTruthy();
  });

  it('é decorativo para leitor de tela: quem carrega o sentido é a fala ao lado', () => {
    const { getByTestId } = render(<Mascote size="md" />);
    const img = getByTestId('mascote', HIDDEN);
    expect(img.props.accessibilityElementsHidden).toBe(true);
    expect(img.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('o tamanho nomeado vira largura e altura iguais: o arquivo é quadrado', () => {
    const { getByTestId } = render(<Mascote size="lg" />);
    const { width, height } = StyleSheet.flatten(getByTestId('mascote', HIDDEN).props.style);
    expect(width).toBe(MASCOTE_SIZES.lg);
    expect(height).toBe(MASCOTE_SIZES.lg);
  });
});
