jest.mock('../../../src/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));
jest.mock('../../../src/api/queries', () => ({
  joinClassroom: jest.fn(),
}));

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ClassroomSheet } from '../../../src/features/profile/ClassroomSheet';
import { useAuthStore } from '../../../src/stores/authStore';
import { joinClassroom } from '../../../src/api/queries';

const mockSetProfile = jest.fn();
const comTurma = { user_id: 'u1', classroom_id: 'c1', display_name: 'Ana', created_at: '2026-01-01' };

beforeEach(() => {
  jest.clearAllMocks();
  (useAuthStore as unknown as jest.Mock).mockReturnValue({
    session: { user: { id: 'u1' } },
    setProfile: mockSetProfile,
  });
});

describe('ClassroomSheet (antigo ClassroomGateModal)', () => {
  it('entra na turma com o codigo e atualiza o perfil', async () => {
    (joinClassroom as jest.Mock).mockResolvedValue(comTurma);
    const onSuccess = jest.fn();
    const tela = render(<ClassroomSheet visible onDismiss={jest.fn()} onSuccess={onSuccess} />);

    fireEvent.changeText(tela.getByLabelText('Código da turma'), 'abcd1234');
    fireEvent.press(tela.getByRole('button', { name: 'Entrar na turma' }));

    await waitFor(() => {
      expect(joinClassroom).toHaveBeenCalledWith('u1', 'ABCD1234');
      expect(mockSetProfile).toHaveBeenCalledWith(comTurma);
      expect(onSuccess).toHaveBeenCalledWith(comTurma);
    });
  });

  it('botao so libera com os 8 caracteres', () => {
    const tela = render(<ClassroomSheet visible onDismiss={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.changeText(tela.getByLabelText('Código da turma'), 'ABC');
    fireEvent.press(tela.getByRole('button', { name: 'Entrar na turma' }));
    expect(joinClassroom).not.toHaveBeenCalled();
    expect(tela.getByText('3 de 8')).toBeTruthy();
  });

  it('erro de entrada aparece no campo, sem Alert', async () => {
    (joinClassroom as jest.Mock).mockRejectedValue(new Error('Turma não encontrada'));
    const tela = render(<ClassroomSheet visible onDismiss={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.changeText(tela.getByLabelText('Código da turma'), 'ZZZZ9999');
    fireEvent.press(tela.getByRole('button', { name: 'Entrar na turma' }));
    await waitFor(() => expect(tela.getByText('Turma não encontrada')).toBeTruthy());
  });
});
