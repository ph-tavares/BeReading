import { render, fireEvent, act } from '@testing-library/react-native';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { Circle } from 'react-native-svg';

// Capitulo fechado (spec S7.3, F4 Tarefa 6).
//
// A contagem roda na UI thread (F4-24), e o Jest nao anima. Por isso nenhum
// teste aqui afirma quadro intermediario: a curva no instante t e provada em
// funcao pura (__tests__/features/chapter-complete/countFrame.test.tsx).
//
// Aqui o withTiming nao conclui sozinho: cada teste conclui os trechos, um a
// um, e confere o estado nas bordas (largada, troca de trecho, fim), que e onde
// a sequencia de subida de nivel pode errar. O shared value persiste entre
// renders, como no aparelho. As duas sobrescritas ficam so nesta camada.
let mockReducedMotion = false;
type MockAnimacao = { config: unknown; aoAcabar?: (acabou: boolean) => void };
const mockAnimacoes: MockAnimacao[] = [];
jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  const { useRef } = jest.requireActual('react');
  return {
    ...real,
    useReducedMotion: () => mockReducedMotion,
    useSharedValue: (inicial: unknown) => useRef({ value: inicial }).current,
    withTiming: (para: number, config: unknown, aoAcabar?: (acabou: boolean) => void) => {
      mockAnimacoes.push({ config, aoAcabar });
      return para;
    },
  };
});

const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockCanGoBack = true;
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn(), canGoBack: () => mockCanGoBack }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('../../src/api/queries', () => ({
  getChaptersByIds: jest.fn(),
}));

// BER-58: a tela busca o plano junto dos capitulos. O store real iria a rede
// (get-entitlement); aqui `refresh` devolve o plano que o teste escolher, e
// null (falha de rede) por padrao.
const mockRefreshPlano = jest.fn();
jest.mock('../../src/stores/entitlementStore', () => ({
  useEntitlementStore: { getState: () => ({ refresh: mockRefreshPlano }) },
}));

import ChapterCompleteScreen from '../../app/chapter-complete';
import * as RingModule from '../../src/ui/Ring';
import { useProgressStore } from '../../src/stores/progressStore';
import { getChaptersByIds } from '../../src/api/queries';
import { levelFor } from '../../src/game/xp';
import { motion } from '../../src/theme/tokens';
import type { Chapter } from '../../src/types/database';
import type { Entitlement } from '../../src/utils/billing';

const mGetChapters = getChaptersByIds as jest.Mock;

type Tela = ReturnType<typeof render>;

const capitulo = (id: string, number: number): Chapter => ({
  id, book_id: 'b1', number, title: null, start_page: null, end_page: null,
});

/** Params como o sheet de registrar leitura manda (contrato F4-7). */
function registro(over: Record<string, string> = {}) {
  mockParams = { chapterIds: 'c-4', bookId: 'b1', pagesRead: '28', streak: '5', xpBefore: '1840', ...over };
}

function storeCom(xp: number) {
  useProgressStore.setState({ xp, level: levelFor(xp), carregado: true });
}

async function montar(): Promise<Tela> {
  const tela = render(<ChapterCompleteScreen />);
  await act(async () => {});
  return tela;
}

/** So as contagens do anel: o pulso do Skeleton tambem passa por withTiming. */
function contagens(): MockAnimacao[] {
  return mockAnimacoes.filter(
    (a) => (a.config as { duration?: number } | undefined)?.duration === motion.count.duration,
  );
}

/** Conclui o trecho que esta contando agora. */
async function concluirTrecho() {
  const pedidas = contagens();
  const atual = pedidas[pedidas.length - 1];
  if (!atual) throw new Error('nenhuma contagem pedida');
  await act(async () => {
    atual.aoAcabar?.(true);
  });
}

/** O numero do centro do anel: o texto que a UI thread poe no TextInput. */
function xpNoAnel(tela: Tela): number {
  const numero = tela.getByTestId('ring-xp', { includeHiddenElements: true });
  return Number(String(numero.props.animatedProps.text).replace(/\./g, ''));
}

/** A fracao desenhada do arco: dasharray fixo, offset e o que falta. */
function arco(tela: Tela): number {
  const circulo = tela.UNSAFE_getAllByType(Circle).find((c) => c.props.testID === 'ring-progress');
  if (!circulo) throw new Error('arco nao encontrado');
  const total = Number(circulo.props.strokeDasharray[0]);
  return 1 - Number(circulo.props.animatedProps.strokeDashoffset) / total;
}

/** O que o leitor de tela ouve no anel. */
function anel(tela: Tela) {
  const el = tela.getByRole('progressbar');
  return { label: el.props.accessibilityLabel, agora: el.props.accessibilityValue?.now };
}

describe('chapter-complete (spec S7.3)', () => {
  beforeEach(() => {
    mockReducedMotion = false;
    mockAnimacoes.length = 0;
    mockReplace.mockClear();
    mockBack.mockClear();
    mGetChapters.mockReset();
  });

  describe('conteudo, capitulos e navegacao (F4-15, F4-26)', () => {
    it('um capitulo: Orelha, titulo com o numero, convite pro quiz e as tags de XP e sequencia', async () => {
      registro();
      storeCom(1980);
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      const tela = await montar();

      expect(mGetChapters).toHaveBeenCalledWith(['c-4']);
      expect(tela.getByText('Orelha')).toBeTruthy();
      expect(tela.getByText('Capítulo 4, fechado.')).toBeTruthy();
      expect(tela.getByText('Bora ver o que ficou?')).toBeTruthy();
      expect(tela.getByText('+140 XP')).toBeTruthy();
      expect(tela.getByText('5 dias seguidos')).toBeTruthy();
      expect(tela.getByRole('button', { name: 'Bora pro quiz' })).toBeTruthy();
      expect(tela.getByRole('button', { name: 'Depois' })).toBeTruthy();
    });

    it('carregando os capitulos: skeleton no formato da tela, e "Depois" ja funciona (F4-26)', () => {
      registro();
      storeCom(1980);
      // Consulta pendurada: getChaptersByIds nao tem timeout.
      mGetChapters.mockReturnValue(new Promise(() => {}));
      const tela = render(<ChapterCompleteScreen />);

      expect(tela.getAllByLabelText('Carregando').length).toBeGreaterThan(3);
      expect(tela.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
      expect(tela.queryByText(/fechado/)).toBeNull();
      expect(tela.queryByRole('progressbar')).toBeNull();
      expect(tela.queryByRole('button', { name: 'Bora pro quiz' })).toBeNull();

      fireEvent.press(tela.getByRole('button', { name: 'Depois' }));
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('varios capitulos, fora de ordem na resposta: o titulo conta e o quiz abre pelo menor numero, com replace', async () => {
      registro({ chapterIds: 'c-6,c-4,c-5' });
      storeCom(1980);
      // .in() nao preserva ordem: nem os ids (c-6 primeiro) nem a resposta
      // (c-5 primeiro) apontam o menor numero.
      mGetChapters.mockResolvedValue([capitulo('c-5', 5), capitulo('c-6', 6), capitulo('c-4', 4)]);
      const tela = await montar();

      expect(tela.getByText('3 capítulos, fechados.')).toBeTruthy();
      fireEvent.press(tela.getByRole('button', { name: 'Bora pro quiz' }));
      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/quiz/c-4');
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('falha da consulta: nenhum numero inventado, e o quiz abre pelo primeiro id', async () => {
      registro({ chapterIds: 'c-6,c-4' });
      storeCom(1980);
      mGetChapters.mockRejectedValue(new Error('sem rede'));
      const tela = await montar();

      expect(tela.getByText('2 capítulos, fechados.')).toBeTruthy();
      expect(tela.queryByText(/Capítulo \d/)).toBeNull();
      fireEvent.press(tela.getByRole('button', { name: 'Bora pro quiz' }));
      expect(mockReplace).toHaveBeenCalledWith('/quiz/c-6');
    });

    it('falha da consulta com um capitulo so: titulo sem numero, e o convite continua', async () => {
      registro({ chapterIds: 'c-4' });
      storeCom(1980);
      mGetChapters.mockRejectedValue(new Error('sem rede'));
      const tela = await montar();

      expect(tela.getByText('Capítulo fechado.')).toBeTruthy();
      expect(tela.getByText('Bora ver o que ficou?')).toBeTruthy();
      fireEvent.press(tela.getByRole('button', { name: 'Bora pro quiz' }));
      expect(mockReplace).toHaveBeenCalledWith('/quiz/c-4');
    });

    it('"Depois" sai da conquista de volta pra onde o leitor estava, sem replace', async () => {
      registro();
      storeCom(1980);
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      const tela = await montar();

      fireEvent.press(tela.getByRole('button', { name: 'Depois' }));
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('sem chapterIds: nao consulta, nao inventa numero e nao oferece quiz', async () => {
      registro({ chapterIds: '' });
      storeCom(1980);
      const tela = await montar();

      expect(mGetChapters).not.toHaveBeenCalled();
      expect(tela.getByText('Capítulo fechado.')).toBeTruthy();
      expect(tela.queryByRole('button', { name: 'Bora pro quiz' })).toBeNull();
      expect(tela.queryByText('Bora ver o que ficou?')).toBeNull();
      expect(tela.getByRole('button', { name: 'Depois' })).toBeTruthy();
    });
  });

  describe('anel e XP (F4-14, F4-24, F4-25)', () => {
    it('sem subida de nivel: um trecho do XP de antes ao final, e o leitor de tela ouve o final o tempo todo', async () => {
      // Premissa: 1840 e 1980 ficam no mesmo nivel (4).
      expect(levelFor(1840).level).toBe(4);
      expect(levelFor(1980).level).toBe(4);
      registro({ pagesRead: '28', xpBefore: '1840' });
      storeCom(1980);
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      const tela = await montar();

      const final = { label: 'Nível 4 · Constante. 1.980 de 2.200 XP', agora: 75 };
      expect(contagens()).toHaveLength(1);
      expect(xpNoAnel(tela)).toBe(1840);
      expect(arco(tela)).toBeCloseTo(levelFor(1840).progress, 5);
      expect(anel(tela)).toEqual(final);
      expect(tela.getByText('Nível 4')).toBeTruthy();
      expect(tela.getByText('de 2.200 XP')).toBeTruthy();

      // O numero e um TextInput animado: nem editavel, nem anunciado a parte.
      const numero = tela.getByTestId('ring-xp', { includeHiddenElements: true });
      expect(numero.props.editable).toBe(false);
      expect(numero.props.accessibilityElementsHidden).toBe(true);
      expect(tela.queryByTestId('ring-xp')).toBeNull();

      await concluirTrecho();
      expect(contagens()).toHaveLength(1);
      expect(xpNoAnel(tela)).toBe(1980);
      expect(arco(tela)).toBeCloseTo(levelFor(1980).progress, 5);
      expect(anel(tela)).toEqual(final);
      expect(tela.queryByText(/Agora você é/, { includeHiddenElements: true })).toBeNull();
    });

    it('refresh falho no registro (store ainda com o XP antigo): o ganho nao some e conta ate xpBefore + ganho', async () => {
      registro({ pagesRead: '28', xpBefore: '1840' });
      storeCom(1840);
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      const tela = await montar();

      expect(tela.getByText('+140 XP')).toBeTruthy();
      expect(anel(tela).label).toBe('Nível 4 · Constante. 1.980 de 2.200 XP');
      expect(xpNoAnel(tela)).toBe(1840);
      expect(contagens()).toHaveLength(1);

      await concluirTrecho();
      expect(xpNoAnel(tela)).toBe(1980);
      expect(arco(tela)).toBeCloseTo(levelFor(1980).progress, 5);
    });

    it('subiu de nivel: o anel completa, zera, continua ate o nivel novo, e a fala aparece so no fim', async () => {
      // Premissa: 2100 e nivel 4 (proximo em 2200); 2300 e nivel 5.
      expect(levelFor(2100)).toMatchObject({ level: 4, next: 2200 });
      expect(levelFor(2300)).toMatchObject({ level: 5, title: 'Maratonista', floor: 2200, next: 3300 });
      registro({ pagesRead: '40', xpBefore: '2100' });
      storeCom(2300);
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      const espiaRing = jest.spyOn(RingModule, 'Ring');
      try {
        const tela = await montar();

        const fala = 'Nível 5. Agora você é Maratonista.';
        const final = { label: 'Nível 5 · Maratonista. 2.300 de 3.300 XP', agora: 9 };
        const opacidadeDaFala = () =>
          StyleSheet.flatten(tela.getByText(fala, { includeHiddenElements: true }).props.style).opacity;

        // Largada: primeiro trecho, que completa o anel, no nivel e XP de antes.
        expect(espiaRing.mock.calls[espiaRing.mock.calls.length - 1][0].count).toMatchObject({ to: 1 });
        expect(tela.getByText('Nível 4')).toBeTruthy();
        expect(xpNoAnel(tela)).toBe(2100);
        expect(arco(tela)).toBeCloseTo(levelFor(2100).progress, 5);
        expect(tela.queryByText(fala)).toBeNull();
        expect(opacidadeDaFala()).toBe(0);
        expect(anel(tela)).toEqual(final);

        // Zera: o segundo trecho comeca do zero, ja no nivel novo.
        await concluirTrecho();
        expect(contagens()).toHaveLength(2);
        expect(arco(tela)).toBeCloseTo(0, 5);
        expect(tela.getByText('Nível 5')).toBeTruthy();
        expect(tela.queryByText('Nível 4')).toBeNull();
        expect(xpNoAnel(tela)).toBe(2200);
        expect(tela.queryByText(fala)).toBeNull();
        expect(anel(tela)).toEqual(final);

        // Fim: progresso do nivel novo, XP final, e a fala visivel e anunciavel.
        await concluirTrecho();
        expect(contagens()).toHaveLength(2);
        expect(xpNoAnel(tela)).toBe(2300);
        expect(arco(tela)).toBeCloseTo(levelFor(2300).progress, 5);
        expect(tela.getByText(fala)).toBeTruthy();
        expect(opacidadeDaFala() ?? 1).toBe(1);
        expect(anel(tela)).toEqual(final);
      } finally {
        espiaRing.mockRestore();
      }
    });

    it('subiu mais de um nivel: o segundo trecho sai do piso do nivel final, nunca abaixo dele (F4-25)', async () => {
      // O caso da revisao: de 0 a 750 XP. Premissa: 750 e nivel 3, piso 660.
      expect(levelFor(750)).toMatchObject({ level: 3, floor: 660, next: 1320 });
      registro({ pagesRead: '150', xpBefore: '0' });
      storeCom(750);
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      const tela = await montar();

      expect(xpNoAnel(tela)).toBe(0);
      await concluirTrecho();
      expect(tela.getByText('Nível 3')).toBeTruthy();
      expect(tela.getByText('de 1.320 XP')).toBeTruthy();
      expect(xpNoAnel(tela)).toBe(660);

      await concluirTrecho();
      expect(xpNoAnel(tela)).toBe(750);
    });

    it('alvo exatamente no piso do nivel novo: nenhum trecho parado, termina direto com a fala (F4-25)', async () => {
      // 2100 + 100 = 2200, o piso do nivel 5 (progresso 0).
      expect(levelFor(2200)).toMatchObject({ level: 5, floor: 2200, progress: 0 });
      registro({ pagesRead: '20', xpBefore: '2100' });
      storeCom(2200);
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      const tela = await montar();

      await concluirTrecho();
      expect(contagens()).toHaveLength(1);
      expect(tela.getByText('Nível 5')).toBeTruthy();
      expect(xpNoAnel(tela)).toBe(2200);
      expect(arco(tela)).toBeCloseTo(0, 5);
      expect(tela.getByText('Nível 5. Agora você é Maratonista.')).toBeTruthy();
    });

    it('do piso do nivel 7 ao topo: dois trechos identicos seguidos contam os dois, e a fala aparece (F4-25)', async () => {
      // Premissa: 4620 e o piso exato do nivel 7; 6160 e o nivel 8, o topo.
      expect(levelFor(4620)).toMatchObject({ level: 7, progress: 0 });
      expect(levelFor(6160)).toMatchObject({ level: 8, next: null, progress: 1 });
      registro({ pagesRead: '308', xpBefore: '4620' });
      storeCom(6160);
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      const tela = await montar();

      const fala = 'Nível 8. Agora você é Lenda da estante.';
      expect(tela.queryByText(fala)).toBeNull();

      await concluirTrecho();
      expect(contagens()).toHaveLength(2);
      expect(tela.queryByText(fala)).toBeNull();

      await concluirTrecho();
      expect(tela.getByText(fala)).toBeTruthy();
      expect(xpNoAnel(tela)).toBe(6160);
    });

    it('reduce motion: XP, nivel e fala prontos, e o anel nao recebe pedido de contagem em render nenhum', async () => {
      mockReducedMotion = true;
      registro({ pagesRead: '40', xpBefore: '2100' });
      storeCom(2300);
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      // Espia todos os renders do Ring, e nao so o ultimo: o act esconde os do
      // meio, e se a tela pedisse contagem o centro mostraria o primeiro trecho
      // por um quadro antes de pular pro final.
      const espiaRing = jest.spyOn(RingModule, 'Ring');
      try {
        const tela = await montar();

        expect(espiaRing.mock.calls.length).toBeGreaterThan(0);
        expect(espiaRing.mock.calls.every(([props]) => props.count === undefined)).toBe(true);
        expect(contagens()).toHaveLength(0);
        expect(xpNoAnel(tela)).toBe(2300);
        expect(tela.getByText('Nível 5')).toBeTruthy();
        expect(tela.queryByText('Nível 4')).toBeNull();
        expect(arco(tela)).toBeCloseTo(levelFor(2300).progress, 5);
        expect(tela.getByText('Nível 5. Agora você é Maratonista.')).toBeTruthy();
      } finally {
        espiaRing.mockRestore();
      }
    });

    it('sem xpBefore: anel parado no XP do store, sem contagem e sem fala de nivel', async () => {
      // Quem deduzisse o "antes" do store (2300 - 200 = 2100, nivel 4) contaria
      // e anunciaria uma subida que nao da pra provar.
      mockParams = { chapterIds: 'c-4', bookId: 'b1', pagesRead: '40', streak: '5' };
      storeCom(2300);
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      const tela = await montar();

      expect(contagens()).toHaveLength(0);
      expect(xpNoAnel(tela)).toBe(2300);
      expect(arco(tela)).toBeCloseTo(levelFor(2300).progress, 5);
      expect(tela.queryByText(/Agora você é/, { includeHiddenElements: true })).toBeNull();
      expect(tela.getByText('+200 XP')).toBeTruthy();
    });

    it('sem xpBefore e store que nunca carregou: nenhum XP inventado no anel, mas o ganho do registro aparece', async () => {
      mockParams = { chapterIds: 'c-4', bookId: 'b1', pagesRead: '40', streak: '5' };
      useProgressStore.setState({ xp: 0, level: levelFor(0), carregado: false });
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      const tela = await montar();

      expect(tela.getByText('Capítulo 4, fechado.')).toBeTruthy();
      expect(tela.queryByRole('progressbar')).toBeNull();
      expect(tela.queryByTestId('ring-xp', { includeHiddenElements: true })).toBeNull();
      expect(tela.getByText('+200 XP')).toBeTruthy();
    });
  });
});

describe('capitulo fechado: cota de quiz do plano gratuito (BER-58)', () => {
  const planoGratuito = (over: Partial<Entitlement> = {}): Entitlement => ({
    plan: 'free',
    premium_plan: { id: 'premium_monthly', name: 'Premium', price_cents: 2490, currency: 'BRL', interval: 'month' },
    subscription: null,
    limits: { max_active_books: 2, monthly_quiz_chapters: 4 },
    free_limits: { max_active_books: 2, monthly_quiz_chapters: 4 },
    usage: { active_books: 1, quiz_chapters_this_month: 4 },
    usage_resets_at: '2026-10-01T03:00:00.000Z',
    started_chapter_ids: [],
    ...over,
  });

  beforeEach(() => {
    registro();
    storeCom(1840);
    mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
  });

  it('cota esgotada: o CTA vira "Conhecer o Premium", com a fala de quando os quizzes voltam', async () => {
    mockRefreshPlano.mockResolvedValue(planoGratuito());
    const tela = await montar();

    expect(tela.queryByRole('button', { name: 'Bora pro quiz' })).toBeNull();
    expect(tela.getByText('Você usou seus 4 quizzes do mês. Seus quizzes voltam em 01/10/2026.')).toBeTruthy();
    fireEvent.press(tela.getByRole('button', { name: 'Conhecer o Premium' }));
    expect(mockReplace).toHaveBeenCalledWith('/planos');
  });

  it('capitulo ja comecado nunca trava: segue "Bora pro quiz"', async () => {
    mockRefreshPlano.mockResolvedValue(planoGratuito({ started_chapter_ids: ['c-4'] }));
    const tela = await montar();

    fireEvent.press(tela.getByRole('button', { name: 'Bora pro quiz' }));
    expect(mockReplace).toHaveBeenCalledWith('/quiz/c-4');
  });

  it('o CTA espera o plano: enquanto ele nao chega, a tela segue no skeleton, com o "Depois"', async () => {
    let liberarPlano: (p: Entitlement | null) => void = () => {};
    mockRefreshPlano.mockImplementation(() => new Promise((res) => { liberarPlano = res; }));
    const tela = await montar();

    expect(tela.queryByRole('button', { name: 'Bora pro quiz' })).toBeNull();
    expect(tela.getByRole('button', { name: 'Depois' })).toBeTruthy();

    await act(async () => {
      liberarPlano(null);
    });
    expect(tela.getByRole('button', { name: 'Bora pro quiz' })).toBeTruthy();
  });
});

describe('capitulo fechado aberto como primeira tela (R2, 15/09)', () => {
  afterEach(() => {
    mockCanGoBack = true;
  });

  it('"Depois" sem tela atras vai para a Hoje, em vez de GO_BACK sem destino', async () => {
    mockCanGoBack = false;
    registro();
    storeCom(1840);
    mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
    const tela = await montar();

    fireEvent.press(tela.getByRole('button', { name: 'Depois' }));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('"Depois" com tela atras continua voltando', async () => {
    registro();
    storeCom(1840);
    mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
    const tela = await montar();

    fireEvent.press(tela.getByRole('button', { name: 'Depois' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
