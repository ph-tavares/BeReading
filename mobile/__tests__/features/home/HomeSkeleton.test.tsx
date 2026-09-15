import { render } from '@testing-library/react-native';
import { HomeSkeleton } from '../../../src/features/home/HomeSkeleton';

// O mock oficial de react-native-reanimated (jest.setup.ui.js) nao inclui
// useReducedMotion (o proprio pacote comenta "ADD ME IF NEEDED"). Mesma
// sobrescrita local de __tests__/ui/States.test.tsx, sem tocar no setup global.
jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return { ...real, useReducedMotion: () => false };
});

describe('HomeSkeleton', () => {
  // Nunca spinner de tela cheia: o formato de carregamento e' skeleton.
  it('nao usa ActivityIndicator', () => {
    const { queryByTestId, UNSAFE_queryAllByType } = render(<HomeSkeleton />);
    expect(queryByTestId('activity-indicator')).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_queryAllByType(ActivityIndicator).length).toBe(0);
  });

  it('desenha mais de um bloco de skeleton, no formato da tela', () => {
    const { getAllByLabelText } = render(<HomeSkeleton />);
    expect(getAllByLabelText('Carregando').length).toBeGreaterThan(3);
  });
});
