import { render, fireEvent } from '@testing-library/react-native';
import { HomeHeader } from '../../../src/features/home/HomeHeader';
import { levelFor } from '../../../src/game/xp';
import { MIN_TOUCH } from '../../../src/theme/tokens';

const RING_SIZE = 38; // Documentado em src/ui/Ring.tsx: 38 na Hoje.

describe('HomeHeader', () => {
  it('cumprimenta pelo nome', () => {
    const { getByText } = render(
      <HomeHeader name="Guilherme" level={levelFor(1840)} onPressRing={jest.fn()} />,
    );
    expect(getByText('E aí,')).toBeTruthy();
    expect(getByText('Guilherme')).toBeTruthy();
  });

  it('mostra o nivel atual dentro do anel', () => {
    const { getByText } = render(
      <HomeHeader name="Guilherme" level={levelFor(1840)} onPressRing={jest.fn()} />,
    );
    // O Ring fica escondido da arvore de acessibilidade (accessibilityElementsHidden),
    // entao a query precisa incluir elementos ocultos pra achar o texto dentro
    // dele — mesma convencao de __tests__/ui/Glyph.test.tsx.
    expect(getByText(String(levelFor(1840).level), { includeHiddenElements: true })).toBeTruthy();
  });

  it('tocar no anel navega (chama onPressRing), com role e label de botao', () => {
    const onPressRing = jest.fn();
    const { getByRole } = render(
      <HomeHeader name="Guilherme" level={levelFor(1840)} onPressRing={onPressRing} />,
    );
    const botao = getByRole('button');
    expect(botao.props.accessibilityLabel).toBeTruthy();
    fireEvent.press(botao);
    expect(onPressRing).toHaveBeenCalledTimes(1);
  });

  // O anel (38) e' menor que o alvo minimo de toque (44): sem hitSlop
  // compensando, o alvo real fica em 38, o mesmo tipo de defeito que o brief
  // desta tarefa cita (alvo de 34 onde o minimo do projeto e' 44).
  it('o alvo de toque do anel chega a 44 com hitSlop, mesmo o anel sendo menor', () => {
    const { getByRole } = render(
      <HomeHeader name="Guilherme" level={levelFor(1840)} onPressRing={jest.fn()} />,
    );
    const botao = getByRole('button');
    const slop = botao.props.hitSlop ?? { top: 0, bottom: 0, left: 0, right: 0 };
    expect(RING_SIZE + slop.top + slop.bottom).toBeGreaterThanOrEqual(MIN_TOUCH);
    expect(RING_SIZE + slop.left + slop.right).toBeGreaterThanOrEqual(MIN_TOUCH);
  });

  // Achado MENOR da revisao da Tarefa 4: o botao e o Ring dentro dele
  // aninhavam dois nos acessiveis com o mesmo texto. So deve sobrar um
  // "button" anunciavel; o Ring escondido nao aparece como progressbar
  // separado para o leitor de tela.
  it('so ha um no acessivel (o botao); o Ring interno nao concorre pelo foco', () => {
    const { getAllByRole, queryByRole } = render(
      <HomeHeader name="Guilherme" level={levelFor(1840)} onPressRing={jest.fn()} />,
    );
    expect(getAllByRole('button').length).toBe(1);
    expect(queryByRole('progressbar')).toBeNull();
  });
});
