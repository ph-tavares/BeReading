import { render } from '@testing-library/react-native';
import { LevelFooter } from '../../../src/features/home/LevelFooter';
import { levelFor } from '../../../src/game/xp';

describe('LevelFooter', () => {
  it('mostra nivel, titulo e a fracao de xp ate o proximo nivel', () => {
    const level = levelFor(1840); // nivel 4, Constante, proximo em 2200
    expect(level.next).toBe(2200); // confere a premissa do fixture antes de testar a tela
    const { getByText } = render(<LevelFooter level={level} xp={1840} />);
    expect(getByText('Nível 4 · Constante')).toBeTruthy();
    // Escrito por extenso (nao reimplementando o formatXp): sobrevive a uma
    // refatoracao da funcao de formatacao sem deixar de testar o produto.
    expect(getByText('1.840 / 2.200 XP')).toBeTruthy();
  });

  it('no nivel maximo (sem proximo), mostra so o xp total', () => {
    const level = levelFor(999999); // muito alem do ultimo degrau
    expect(level.next).toBeNull();
    const { getByText } = render(<LevelFooter level={level} xp={999999} />);
    expect(getByText('999.999 XP')).toBeTruthy();
  });
});
