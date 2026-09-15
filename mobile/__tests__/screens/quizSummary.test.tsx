import { render, fireEvent, act } from '@testing-library/react-native';

// O mock oficial do Reanimated nao traz useReducedMotion, que o Ring e o Button leem.
jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return { ...real, useReducedMotion: () => false };
});

const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: () => ({ profile: { user_id: 'u1' } }),
}));

jest.mock('../../src/api/queries', () => ({
  getChaptersByIds: jest.fn(),
  loadQuizForReader: jest.fn(),
}));

import QuizSummaryScreen from '../../app/quiz/summary';
import { getChaptersByIds, loadQuizForReader } from '../../src/api/queries';
import { scoreLine } from '../../src/assistant/lines';

const mChapters = getChaptersByIds as jest.Mock;
const mLoad = loadQuizForReader as jest.Mock;

const pergunta = (id: string, question_text: string) => ({
  id, chapter_id: 'c-4', type: 'comprehension' as const, question_text, generated_at: '2026-09-15T00:00:00.000Z',
});

async function montar() {
  const tela = render(<QuizSummaryScreen />);
  await act(async () => {});
  return tela;
}

beforeEach(() => {
  jest.clearAllMocks();
  mChapters.mockResolvedValue([{ id: 'c-4', book_id: 'b1', number: 4, title: null, start_page: 85, end_page: 112 }]);
  mLoad.mockResolvedValue({
    questions: [pergunta('q1', 'Onde Winston trabalha?'), pergunta('q2', 'O que é o Grande Irmão?')],
    progress: {
      results: { 0: { score: 70, feedback: 'a' }, 1: { score: 74, feedback: 'b' } },
      answerTexts: { 0: 'x', 1: 'y' },
      startIndex: 0,
    },
  });
});

describe('Resumo do quiz (spec 7.6)', () => {
  it('titulo com o capitulo, fala da faixa da media, XP real e recap', async () => {
    mockParams = { avgScore: '72', total: '2', pending: '0', chapterId: 'c-4' };
    const tela = await montar();

    expect(tela.getByText('Capítulo 4, entendido.')).toBeTruthy();
    expect(tela.getByText(scoreLine(72))).toBeTruthy();
    // 70 / 5 + 74 / 5 = 14 + 15: soma das respostas, nao media vezes total.
    expect(tela.getByText('+29 XP')).toBeTruthy();
    expect(tela.getByText('Onde Winston trabalha?')).toBeTruthy();
    expect(tela.getByText('74')).toBeTruthy();
  });

  it('com resposta pendente (BER-42): media sem ela, "avaliando" no recap e aviso', async () => {
    mLoad.mockResolvedValue({
      questions: [pergunta('q1', 'Onde Winston trabalha?'), pergunta('q2', 'O que é o Grande Irmão?')],
      progress: {
        results: { 0: { score: 80, feedback: 'a' }, 1: { score: null, feedback: 'b' } },
        answerTexts: { 0: 'x', 1: 'y' },
        startIndex: 0,
      },
    });
    mockParams = { avgScore: '80', total: '2', pending: '1', chapterId: 'c-4' };
    const tela = await montar();

    expect(tela.getByText('+16 XP')).toBeTruthy();
    expect(tela.getByText('1 resposta ainda está sendo avaliada e não entrou na média.')).toBeTruthy();
    expect(tela.getAllByText('avaliando').length).toBeGreaterThan(0);
  });

  it('nenhuma nota ainda: fala honesta e sem media inventada', async () => {
    mockParams = { avgScore: '', total: '2', pending: '2', chapterId: 'c-4' };
    const tela = await montar();
    expect(tela.getByText(scoreLine(null))).toBeTruthy();
  });

  it('botoes: continuar lendo vai pra Hoje, rever a conversa reabre o quiz', async () => {
    mockParams = { avgScore: '72', total: '2', pending: '0', chapterId: 'c-4' };
    const tela = await montar();

    fireEvent.press(tela.getByRole('button', { name: 'Rever a conversa' }));
    expect(mockReplace).toHaveBeenCalledWith('/quiz/c-4');
    fireEvent.press(tela.getByRole('button', { name: 'Continuar lendo' }));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('sem chapterId (contrato antigo): nao busca, titulo sem numero e sem rever', async () => {
    mockParams = { avgScore: '72', total: '2', pending: '0' };
    const tela = await montar();

    expect(mChapters).not.toHaveBeenCalled();
    expect(mLoad).not.toHaveBeenCalled();
    expect(tela.getByText('Quiz fechado.')).toBeTruthy();
    expect(tela.queryByRole('button', { name: 'Rever a conversa' })).toBeNull();
  });

  it('sem a copy do sistema antigo', async () => {
    mockParams = { avgScore: '72', total: '2', pending: '0', chapterId: 'c-4' };
    const tela = await montar();
    expect(tela.queryByText(/QUEST|saga|mestre/i)).toBeNull();
  });
});
