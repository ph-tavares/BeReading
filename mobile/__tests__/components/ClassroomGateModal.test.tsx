jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));
jest.mock('../../src/api/queries', () => ({
  joinClassroom: jest.fn(),
}));
jest.mock('../../src/utils/validation', () => ({
  validateClassroomCode: jest.fn(() => null), // null = sem erro
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ClassroomGateModal } from '../../src/components/ClassroomGateModal';
import { useAuthStore } from '../../src/stores/authStore';
import { joinClassroom } from '../../src/api/queries';
import type { Profile } from '../../src/types/database';

const mockProfile: Profile = {
  user_id: 'u1',
  classroom_id: null,
  display_name: 'Ana',
  created_at: '2026-01-01',
};

const mockProfileWithClassroom: Profile = {
  ...mockProfile,
  classroom_id: 'c1',
};

const mockSetProfile = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAuthStore as jest.Mock).mockReturnValue({
    session: { user: { id: 'u1' } },
    setProfile: mockSetProfile,
  });
});

describe('ClassroomGateModal', () => {
  it('renderiza quando visible=true', () => {
    const { getByText } = render(
      <ClassroomGateModal visible onDismiss={jest.fn()} onSuccess={jest.fn()} />
    );
    expect(getByText('Entrar em uma turma')).toBeTruthy();
  });

  it('chama onSuccess e setProfile ao entrar em turma com sucesso', async () => {
    (joinClassroom as jest.Mock).mockResolvedValue(mockProfileWithClassroom);
    const onSuccess = jest.fn();

    const { getByPlaceholderText, getByText } = render(
      <ClassroomGateModal visible onDismiss={jest.fn()} onSuccess={onSuccess} />
    );

    fireEvent.changeText(getByPlaceholderText('XXXXXXXX'), 'ABCD1234');
    fireEvent.press(getByText('Entrar na turma'));

    await waitFor(() => {
      expect(joinClassroom).toHaveBeenCalledWith('u1', 'ABCD1234');
      expect(mockSetProfile).toHaveBeenCalledWith(mockProfileWithClassroom);
      expect(onSuccess).toHaveBeenCalledWith(mockProfileWithClassroom);
    });
  });
});
