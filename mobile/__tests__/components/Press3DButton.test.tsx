import { render, fireEvent } from '@testing-library/react-native';
import { Press3DButton } from '../../src/components/Press3DButton';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

// react-native-shadow-2 exporta { Shadow }. Mockado como passthrough para preservar children.
jest.mock('react-native-shadow-2', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Shadow: ({ children, ...rest }: any) =>
      React.createElement(View, { testID: 'shadow-wrapper', ...rest }, children),
  };
});

import * as Haptics from 'expo-haptics';

describe('Press3DButton', () => {
  beforeEach(() => {
    (Haptics.impactAsync as jest.Mock).mockClear();
  });

  it('calls onPress when pressed and not disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Press3DButton onPress={onPress}>Tap me</Press3DButton>,
    );
    fireEvent.press(getByText('Tap me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Press3DButton onPress={onPress} disabled>Tap me</Press3DButton>,
    );
    fireEvent.press(getByText('Tap me'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders with given children text', () => {
    const { getByText } = render(
      <Press3DButton onPress={() => {}}>Registrar</Press3DButton>,
    );
    expect(getByText('Registrar')).toBeTruthy();
  });

  it('triggers haptic impact on pressIn when not disabled', () => {
    const { getByText } = render(
      <Press3DButton onPress={() => {}} hapticStyle="heavy">Tap</Press3DButton>,
    );
    fireEvent(getByText('Tap'), 'pressIn');
    expect(Haptics.impactAsync).toHaveBeenCalledWith('heavy');
  });

  it('does NOT trigger haptic impact when disabled', () => {
    const { getByText } = render(
      <Press3DButton onPress={() => {}} disabled>Tap</Press3DButton>,
    );
    fireEvent(getByText('Tap'), 'pressIn');
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('wraps content in <Shadow> for cross-platform glow', () => {
    const { getByTestId } = render(
      <Press3DButton onPress={() => {}}>Tap</Press3DButton>,
    );
    expect(getByTestId('shadow-wrapper')).toBeTruthy();
  });
});
