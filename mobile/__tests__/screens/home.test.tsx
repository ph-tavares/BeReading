import { render, fireEvent, act } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

// O mock oficial de react-native-reanimated (jest.setup.ui.js) nao inclui
// useReducedMotion (usado pelo Skeleton do estado de carregamento). Mesma
// sobrescrita local de __tests__/ui/States.test.tsx, sem tocar no setup global.
jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return { ...real, useReducedMotion: () => false };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    // A real useFocusEffect so dispara de novo em foco de navegacao, nunca em
    // re-render por causa do proprio estado que ela mesma populou. O mock
    // ingenuo "(cb) => cb()" (usado em reading-success, que nao tem esse
    // risco) causaria busca infinita aqui: cada fetch chama setState, que
    // re-renderiza, que chamaria useFocusEffect nesta tela de novo. Rodar
    // dentro de um useEffect com deps fixas reproduz "foco disparou uma vez",
    // sem o loop.
    useFocusEffect: (cb: () => void | (() => void)) => {
      react.useEffect(() => cb(), []); // eslint-disable-line react-hooks/exhaustive-deps
    },
  };
});
// Divida de cobertura conhecida (MENOR da revisao da Tarefa 4): com deps
// fixas, este mock nunca re-executa dentro de uma MESMA instancia montada —
// "voltar pra aba sem desmontar" nao tem teste direto. A suite "uma nova
// visita a aba busca de novo (remount)", mais abaixo, cobre o equivalente
// disponivel (nova montagem = novo ciclo de foco), mas nao o caso exato de
// foco->blur->foco na mesma instancia. Verificado a parte que isso nao gera
// loop em producao: ver task-4-fix-report.md.

let mockProfile: any = {
  user_id: 'u1', display_name: 'Guilherme', classroom_id: null, created_at: '2026-01-01T00:00:00.000Z',
};
let mockProfileStatus: 'loading' | 'ready' | 'error' = 'ready';
jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: () => ({ profile: mockProfile, profileStatus: mockProfileStatus }),
}));

const mockSetCurrentBook = jest.fn();
jest.mock('../../src/stores/readingStore', () => ({
  useReadingStore: () => ({ setCurrentBook: mockSetCurrentBook }),
}));

jest.mock('../../src/api/queries', () => ({
  getStudentBooks: jest.fn(),
  loadPendingQuizzes: jest.fn(),
  getBookWithChapters: jest.fn(),
  getQuestionsForChapter: jest.fn(),
  getReadingSessions: jest.fn(),
  getMyAnswers: jest.fn(),
  getStudentBadges: jest.fn(),
  getStreak: jest.fn(),
}));

import HomeScreen from '../../app/(tabs)/index';
import { useProgressStore } from '../../src/stores/progressStore';
import {
  getStudentBooks, loadPendingQuizzes, getBookWithChapters, getQuestionsForChapter,
  getReadingSessions, getMyAnswers, getStudentBadges, getStreak,
} from '../../src/api/queries';
import { levelFor } from '../../src/game/xp';
import type { Book, StudentBook, Chapter, Streak, ReadingSession } from '../../src/types/database';

const mGetStudentBooks = getStudentBooks as jest.Mock;
const mLoadPendingQuizzes = loadPendingQuizzes as jest.Mock;
const mGetBookWithChapters = getBookWithChapters as jest.Mock;
const mGetQuestionsForChapter = getQuestionsForChapter as jest.Mock;
const mGetReadingSessions = getReadingSessions as jest.Mock;
const mGetStreak = getStreak as jest.Mock;

const book = (over: Partial<Book> = {}): Book => ({
  id: 'b1', title: 'O Guia do Mochileiro das Galáxias', author: 'Douglas Adams',
  cover_url: null, total_pages: 208, genre: null, created_at: '2026-01-01T00:00:00.000Z', ...over,
});

const entry = (over: Partial<StudentBook> = {}, b: Book = book()) => ({
  id: 'sb1', user_id: 'u1', book_id: b.id, status: 'reading' as const, current_page: 84,
  started_at: '2026-01-01T00:00:00.000Z', finished_at: null, book: b, ...over,
});

const chapter = (over: Partial<Chapter>): Chapter => ({
  id: `c-${over.number}`, book_id: 'b1', number: 1, title: null, start_page: 1, end_page: 30, ...over,
});

const streak = (over: Partial<Streak> = {}): Streak => ({
  id: 'st1', user_id: 'u1', current_streak: 4, longest_streak: 5, last_read_date: '2026-09-12', ...over,
});

const sessao = (over: Partial<ReadingSession> = {}): ReadingSession => ({
  id: 's1', user_id: 'u1', book_id: 'b1', start_page: 1, end_page: 2, pages_read: 1,
  read_at: '2026-09-12T12:00:00.000Z', ...over,
});

// A tela le o relogio (livro parado conta dias ate hoje; risco de sequencia
// olha a hora em SP), entao as datas fixas dos mocks so valem com ele parado.
// Sem isso, a partir de 16/09 a leitura de 13/09 virou "livro parado" e o card
// da Orelha apareceu onde o teste espera silencio.
function congelarEm13De09PelaManha() {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-09-13T14:00:00.000Z')); // 11h em Sao Paulo
}

/** Estado "quieto": sem quiz, sem risco de sequencia, sem livro parado. */
function semAssunto() {
  congelarEm13De09PelaManha();
  mLoadPendingQuizzes.mockResolvedValue([]);
  mGetStreak.mockResolvedValue(streak({ last_read_date: '2026-09-13' }));
  mGetReadingSessions.mockResolvedValue([sessao({ read_at: '2026-09-13T12:00:00.000Z' })]);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile = {
    user_id: 'u1', display_name: 'Guilherme', classroom_id: null, created_at: '2026-01-01T00:00:00.000Z',
  };
  mockProfileStatus = 'ready';
  useProgressStore.setState({
    sessions: [], answers: [], badges: [], streak: null, xp: 0, level: levelFor(0),
    previous: null, carregado: false,
  });

  mGetBookWithChapters.mockResolvedValue(null);
  mLoadPendingQuizzes.mockResolvedValue([]);
  mGetQuestionsForChapter.mockResolvedValue([]);
  mGetReadingSessions.mockResolvedValue([]);
  (getMyAnswers as jest.Mock).mockResolvedValue([]);
  (getStudentBadges as jest.Mock).mockResolvedValue([]);
  mGetStreak.mockResolvedValue(null);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Hoje: guarda de perfil (BER-45)', () => {
  it('profileStatus de erro mostra a tela de retry, sem buscar dados', async () => {
    // Invariante real do authStore: profileStatus so vira 'error' explicitamente
    // enquanto profile ainda e' null (setProfile sempre move o status para
    // 'ready' junto). Um profile presente com status 'error' nao acontece no
    // app de verdade.
    mockProfile = null;
    mockProfileStatus = 'error';
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Não conseguimos carregar seu perfil')).toBeTruthy();
    expect(mGetStudentBooks).not.toHaveBeenCalled();
  });
});

describe('Hoje: os quatro estados', () => {
  it('carregando: mostra skeleton, nunca spinner', async () => {
    let resolver: (v: unknown[]) => void = () => {};
    mGetStudentBooks.mockReturnValue(new Promise((res) => { resolver = res; }));

    const { getAllByLabelText, queryByTestId } = render(<HomeScreen />);
    expect(getAllByLabelText('Carregando').length).toBeGreaterThan(0);
    expect(queryByTestId('activity-indicator')).toBeNull();

    await act(async () => {
      resolver([]);
      await Promise.resolve();
    });
  });

  it('vazio (primeiro acesso): a Orelha se apresenta e o cta leva ao catalogo', async () => {
    mGetStudentBooks.mockResolvedValue([]);
    const { findByText } = render(<HomeScreen />);

    const cta = await findByText('Ver catálogo');
    fireEvent.press(cta);
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/catalogo');
  });

  it('normal: mostra o livro em leitura e a acao primaria registra leitura', async () => {
    const b = book();
    mGetStudentBooks.mockResolvedValue([entry({ current_page: 84 }, b)]);
    mGetBookWithChapters.mockResolvedValue({
      ...b,
      chapters: [
        chapter({ number: 1, end_page: 30 }), chapter({ number: 2, end_page: 60 }),
        chapter({ number: 3, end_page: 84 }), chapter({ number: 4, end_page: 112 }),
      ],
    });
    semAssunto();

    const { findByText, getByText } = render(<HomeScreen />);
    await findByText('Lendo agora');

    const registrar = getByText('Registrar leitura');
    fireEvent.press(registrar);
    expect(mockPush).toHaveBeenCalledWith('/register-reading');
  });

  it('erro: mostra banner e mantem o que ja tinha carregado', async () => {
    const b = book();
    mGetStudentBooks.mockResolvedValueOnce([entry({ current_page: 84 }, b)]);
    semAssunto();

    const { findByText, getByText, getAllByText, UNSAFE_getByType } = render(<HomeScreen />);
    await findByText('Lendo agora');

    mGetStudentBooks.mockRejectedValueOnce(new Error('rede caiu'));
    const { onRefresh } = UNSAFE_getByType(ScrollView).props.refreshControl.props;
    await act(async () => {
      await onRefresh();
    });

    expect(getByText('Não foi possível carregar seus dados. Puxe para atualizar.')).toBeTruthy();
    // O titulo do livro, carregado antes, continua na tela.
    expect(getAllByText(b.title).length).toBeGreaterThan(0);
  });

  it('erro na primeira carga: mostra o banner sem hero nenhum, mas a saudacao continua', async () => {
    mGetStudentBooks.mockRejectedValue(new Error('rede caiu'));
    const { findByText, getByText, queryByText } = render(<HomeScreen />);

    await findByText('Não foi possível carregar seus dados. Puxe para atualizar.');
    expect(getByText('Guilherme')).toBeTruthy();
    expect(queryByText('Ver catálogo')).toBeNull();
  });
});

describe('Hoje: a meta de capitulo (BER-72)', () => {
  it('some quando o livro nao tem capitulo com paginacao', async () => {
    const b = book();
    mGetStudentBooks.mockResolvedValue([entry({ current_page: 84 }, b)]);
    mGetBookWithChapters.mockResolvedValue({
      ...b,
      chapters: [
        chapter({ number: 1, end_page: null, start_page: null }),
      ],
    });
    semAssunto();

    const { findByText, queryByText } = render(<HomeScreen />);
    await findByText('Lendo agora');
    expect(queryByText(/faltam/)).toBeNull();
    expect(queryByText(/^cap\./)).toBeNull();
  });

  it('aparece com o numero certo quando ha capitulo paginado cobrindo a pagina atual', async () => {
    const b = book();
    mGetStudentBooks.mockResolvedValue([entry({ current_page: 84 }, b)]);
    mGetBookWithChapters.mockResolvedValue({
      ...b,
      chapters: [
        chapter({ number: 1, end_page: 30 }), chapter({ number: 2, end_page: 60 }),
        chapter({ number: 3, end_page: 84 }), chapter({ number: 4, end_page: 112 }),
      ],
    });
    semAssunto();

    const { findByText } = render(<HomeScreen />);
    expect(await findByText('cap. 4 de 4 · faltam 28 pág. pra fechar')).toBeTruthy();
  });
});

describe('Hoje: o anel de nivel leva para Voce', () => {
  it('tocar no anel navega para a aba Voce', async () => {
    const b = book();
    mGetStudentBooks.mockResolvedValue([entry({ current_page: 84 }, b)]);
    semAssunto();

    const { findByText, getByRole } = render(<HomeScreen />);
    await findByText('Lendo agora');

    const anel = getByRole('button', { name: /Nível/ });
    fireEvent.press(anel);
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/perfil');
  });
});

describe('Hoje: card do assistente', () => {
  it('aparece por quiz pendente, com o texto e a acao certos', async () => {
    const b = book();
    mGetStudentBooks.mockResolvedValue([entry({ current_page: 84 }, b)]);
    mLoadPendingQuizzes.mockResolvedValue([chapter({ id: 'ch3', number: 3, end_page: 84 })]);
    mGetQuestionsForChapter.mockResolvedValue([{}, {}, {}, {}]);
    mGetStreak.mockResolvedValue(streak({ last_read_date: '2026-09-13' }));
    mGetReadingSessions.mockResolvedValue([sessao({ read_at: '2026-09-13T12:00:00.000Z' })]);

    const { findByText, getByText } = render(<HomeScreen />);
    await findByText('Você fechou o capítulo 3 e deixou 4 perguntas pra trás.');

    fireEvent.press(getByText('Responder agora'));
    expect(mockPush).toHaveBeenCalledWith('/quiz/ch3');
  });

  // CRITICO da revisao da Tarefa 4: pendingChapters e pendingQuestionCount
  // eram dois estados lidos como um fato so. Falha na contagem zerava o
  // numero sem limpar o capitulo, e a tela escrevia "deixou 0 perguntas pra
  // tras" com CTA do lado - zero de fallback com cara de contagem real.
  it('falha ao contar as perguntas do quiz pendente: o card some, nao anuncia zero', async () => {
    const b = book();
    mGetStudentBooks.mockResolvedValue([entry({ current_page: 84 }, b)]);
    mLoadPendingQuizzes.mockResolvedValue([chapter({ id: 'ch3', number: 3, end_page: 84 })]);
    mGetQuestionsForChapter.mockRejectedValue(new Error('rede caiu'));
    congelarEm13De09PelaManha();
    mGetStreak.mockResolvedValue(streak({ last_read_date: '2026-09-13' }));
    mGetReadingSessions.mockResolvedValue([sessao({ read_at: '2026-09-13T12:00:00.000Z' })]);

    const { findByText, queryByText } = render(<HomeScreen />);
    await findByText('Lendo agora');

    expect(queryByText('Orelha')).toBeNull();
    expect(queryByText(/perguntas pra trás/)).toBeNull();
    expect(queryByText(/0 pergunta/)).toBeNull();
  });

  it('some quando nao ha quiz pendente, sequencia em risco nem livro parado', async () => {
    const b = book();
    mGetStudentBooks.mockResolvedValue([entry({ current_page: 84 }, b)]);
    semAssunto();

    const { findByText, queryByText } = render(<HomeScreen />);
    await findByText('Lendo agora');
    expect(queryByText('Orelha')).toBeNull();
  });

  it('aparece por sequencia em risco quando ainda nao leu hoje, depois das 18h em SP', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-13T22:00:00.000Z')); // 19h em Sao Paulo

    const b = book();
    mGetStudentBooks.mockResolvedValue([entry({ current_page: 84 }, b)]);
    mLoadPendingQuizzes.mockResolvedValue([]);
    mGetStreak.mockResolvedValue(streak({ current_streak: 4, last_read_date: '2026-09-12' }));
    mGetReadingSessions.mockResolvedValue([]); // nao leu hoje

    const { findByText } = render(<HomeScreen />);
    expect(await findByText('Faltam 5h pra sua sequência zerar. Uma página já conta.')).toBeTruthy();
  });

  it('aparece quando o livro esta parado ha 3 dias ou mais', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-13T14:00:00.000Z')); // manha em SP: sem risco de sequencia

    const b = book();
    mGetStudentBooks.mockResolvedValue([entry({ current_page: 84 }, b)]);
    mLoadPendingQuizzes.mockResolvedValue([]);
    mGetStreak.mockResolvedValue(streak({ current_streak: 0, last_read_date: null }));
    mGetReadingSessions.mockResolvedValue([sessao({ book_id: b.id, read_at: '2026-09-10T12:00:00.000Z' })]);

    const { findByText } = render(<HomeScreen />);
    expect(await findByText('Faz 3 dias que você não abre o livro. Uma página já reata.')).toBeTruthy();
  });
});

// Visto no emulador em 15/09 (R2): depois de registrar a leitura do dia, a Hoje
// ainda dizia "Lê hoje e vira 2", mandando ler quem ja tinha lido.
describe('Hoje: fala da sequencia', () => {
  it('ja leu hoje: nao manda ler de novo, e o numero novo e de amanha', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-13T14:00:00.000Z')); // 11h em Sao Paulo

    const b = book();
    mGetStudentBooks.mockResolvedValue([entry({ current_page: 84 }, b)]);
    mLoadPendingQuizzes.mockResolvedValue([]);
    mGetStreak.mockResolvedValue(streak({ current_streak: 4, last_read_date: '2026-09-13' }));
    mGetReadingSessions.mockResolvedValue([sessao({ read_at: '2026-09-13T12:00:00.000Z' })]);

    const { findByText, queryByText } = render(<HomeScreen />);
    expect(await findByText('4 dias seguidos. Hoje já conta, amanhã vira 5.')).toBeTruthy();
    expect(queryByText(/Lê hoje/)).toBeNull();
  });

  it('ainda nao leu hoje: convida a ler hoje', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-13T14:00:00.000Z')); // 11h em Sao Paulo: sem risco de sequencia

    const b = book();
    mGetStudentBooks.mockResolvedValue([entry({ current_page: 84 }, b)]);
    mLoadPendingQuizzes.mockResolvedValue([]);
    mGetStreak.mockResolvedValue(streak({ current_streak: 4, last_read_date: '2026-09-12' }));
    mGetReadingSessions.mockResolvedValue([sessao({ read_at: '2026-09-12T12:00:00.000Z' })]);

    const { findByText } = render(<HomeScreen />);
    expect(await findByText('4 dias seguidos. Lê hoje e vira 5.')).toBeTruthy();
  });
});

describe('Hoje: fileira "Também lendo"', () => {
  it('aparece com dois livros ou mais em leitura', async () => {
    const b1 = book({ id: 'b1', title: 'Livro Um' });
    const b2 = book({ id: 'b2', title: 'Livro Dois', author: 'Outra Autora' });
    mGetStudentBooks.mockResolvedValue([
      entry({ current_page: 84 }, b1),
      entry({ id: 'sb2', current_page: 10 }, b2),
    ]);
    semAssunto();

    const { findByText, getByLabelText } = render(<HomeScreen />);
    await findByText('Também lendo');

    fireEvent.press(getByLabelText(`Abrir ${b2.title}, de ${b2.author}`));
    expect(mockPush).toHaveBeenCalledWith(`/book/${b2.id}`);
  });

  it('nao aparece com um livro so', async () => {
    const b = book();
    mGetStudentBooks.mockResolvedValue([entry({ current_page: 84 }, b)]);
    semAssunto();

    const { findByText, queryByText } = render(<HomeScreen />);
    await findByText('Lendo agora');
    expect(queryByText('Também lendo')).toBeNull();
  });
});

// MENOR da revisao da Tarefa 4: o mock de useFocusEffect (deps fixas, ver
// comentario no topo do arquivo) nunca re-executa dentro de uma MESMA
// instancia montada, entao nenhum teste cobria "voltar pra aba busca de
// novo". Uma nova montagem e' o equivalente disponivel dentro dessa
// limitacao do mock: cada `render()` roda seu proprio efeito de foco uma
// vez, com o profile e os mocks vigentes NAQUELE momento — o que prova que a
// busca nao fica presa a dados de uma instancia anterior.
describe('Hoje: uma nova visita a aba busca de novo (remount)', () => {
  it('a segunda montagem busca com o profile e os dados vigentes, nao com os da primeira', async () => {
    const b1 = book({ id: 'b1', title: 'Livro Um' });
    mGetStudentBooks.mockResolvedValueOnce([entry({ current_page: 10 }, b1)]);
    semAssunto();

    // O titulo aparece duas vezes na tela (a capa tipografica gerada e o
    // cabecalho do hero, ver CurrentBookHero.test.tsx): a busca por texto
    // simples daria "multiplos elementos". O accessibilityLabel do hero e'
    // unico e ja inclui o titulo, entao serve de marcador sem ambiguidade.
    const primeira = render(<HomeScreen />);
    await primeira.findByLabelText(/Abrir Livro Um,/);
    expect(mGetStudentBooks).toHaveBeenNthCalledWith(1, 'u1');
    primeira.unmount();

    // Simula voltar pra aba depois de uma troca de conta: profile novo,
    // livro novo.
    mockProfile = { ...mockProfile, user_id: 'u2' };
    const b2 = book({ id: 'b2', title: 'Livro Dois' });
    mGetStudentBooks.mockResolvedValueOnce([entry({ current_page: 20 }, b2)]);

    const segunda = render(<HomeScreen />);
    await segunda.findByLabelText(/Abrir Livro Dois,/);
    expect(mGetStudentBooks).toHaveBeenNthCalledWith(2, 'u2');
  });
});
