import { render, fireEvent } from '@testing-library/react-native';
import { HomeEmptyState } from '../../../src/features/home/HomeEmptyState';
import { ASSISTANT_NAME, ASSISTANT_INTRO } from '../../../src/assistant/persona';

describe('HomeEmptyState', () => {
  it('a Orelha se apresenta, com o texto canonico de persona.ts', () => {
    const { getByText } = render(<HomeEmptyState onExplore={jest.fn()} />);
    expect(getByText(ASSISTANT_NAME)).toBeTruthy();
    expect(getByText(ASSISTANT_INTRO)).toBeTruthy();
  });

  it('o cta leva para o catalogo', () => {
    const onExplore = jest.fn();
    const { getByText } = render(<HomeEmptyState onExplore={onExplore} />);
    fireEvent.press(getByText('Ver catálogo'));
    expect(onExplore).toHaveBeenCalledTimes(1);
  });
});
