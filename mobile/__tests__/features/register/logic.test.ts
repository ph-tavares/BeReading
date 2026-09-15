import {
  parsePage,
  initialStartPage,
  quickEndPage,
  nextChapterEnd,
  predictCompletedChapters,
  closingChaptersLabel,
  summarizeRange,
  ctaLabel,
  repeatedPagesNote,
  successToast,
  chapterCompleteParams,
} from '../../../src/features/register/logic';
import { XP_PER_PAGE } from '../../../src/game/xp';
import { validatePageRange } from '../../../src/utils/validation';
import type { Chapter } from '../../../src/types/database';

type Cap = Pick<Chapter, 'id' | 'number' | 'end_page'>;

const cap = (number: number, end_page: number | null): Cap => ({ id: `c-${number}`, number, end_page });

// O livro do mockup 04: capitulo 4 termina na 112, o leitor parou na 84.
const CAPS: Cap[] = [cap(1, 30), cap(2, 60), cap(3, 84), cap(4, 112), cap(5, 140)];

const ids = (list: Cap[]) => list.map((c) => c.id);

describe('parsePage', () => {
  it('le numero de pagina', () => {
    expect(parsePage('85')).toBe(85);
  });

  it('vazio ou com qualquer coisa alem de digito nao e pagina', () => {
    expect(parsePage('')).toBeNull();
    expect(parsePage('8a')).toBeNull();
    expect(parsePage(' 8')).toBeNull();
  });
});

describe('initialStartPage', () => {
  it('continua da pagina seguinte a ultima registrada', () => {
    expect(initialStartPage(84)).toBe('85');
  });

  it('livro que ainda nao comecou abre na pagina 1', () => {
    expect(initialStartPage(0)).toBe('1');
  });
});

describe('quickEndPage', () => {
  it('+10 a partir do De conta 10 paginas, incluindo o proprio De', () => {
    expect(quickEndPage(85, 10, 208)).toBe(94);
    expect(quickEndPage(85, 20, 208)).toBe(104);
  });

  it('nao passa do fim do livro', () => {
    expect(quickEndPage(200, 20, 208)).toBe(208);
  });
});

describe('nextChapterEnd', () => {
  it('e o proximo capitulo com end_page maior ou igual ao De', () => {
    expect(nextChapterEnd(CAPS, 85)).toEqual({ number: 4, endPage: 112 });
  });

  it('end_page igual ao De ainda conta', () => {
    expect(nextChapterEnd(CAPS, 112)).toEqual({ number: 4, endPage: 112 });
  });

  it('pula capitulo sem paginacao em vez de parar nele', () => {
    expect(nextChapterEnd([cap(3, 84), cap(4, null), cap(5, 140)], 85)).toEqual({ number: 5, endPage: 140 });
  });

  it('sem capitulo paginado a frente, nao ha atalho', () => {
    expect(nextChapterEnd([cap(1, 30), cap(2, null)], 85)).toBeNull();
    expect(nextChapterEnd([], 85)).toBeNull();
  });

  it('nao depende da ordem em que os capitulos chegam do banco', () => {
    expect(nextChapterEnd([cap(5, 140), cap(1, 30), cap(4, 112)], 85)).toEqual({ number: 4, endPage: 112 });
  });

  it('De que nao e numero nao inventa atalho', () => {
    expect(nextChapterEnd(CAPS, Number.NaN)).toBeNull();
  });
});

// Espelho de findNewlyCompletedChapters (supabase/functions/register-reading-session/reading.ts):
// end_page > previousMaxPage && end_page <= max(previousMaxPage, Ate).
describe('predictCompletedChapters', () => {
  it('fecha o capitulo cujo end_page o Ate alcanca', () => {
    expect(ids(predictCompletedChapters(CAPS, 84, 112))).toEqual(['c-4']);
  });

  it('uma pagina antes do end_page nao fecha', () => {
    expect(ids(predictCompletedChapters(CAPS, 84, 111))).toEqual([]);
  });

  it('capitulo que terminava na pagina maxima anterior ja estava fechado', () => {
    expect(ids(predictCompletedChapters(CAPS, 84, 100))).toEqual([]);
  });

  it('fecha varios de uma vez, em ordem de numero', () => {
    expect(ids(predictCompletedChapters([cap(5, 140), cap(4, 112)], 84, 140))).toEqual(['c-4', 'c-5']);
  });

  it('reler trecho antigo nao fecha de novo o que ja estava fechado', () => {
    expect(ids(predictCompletedChapters(CAPS, 84, 50))).toEqual([]);
  });

  it('ignora capitulo sem end_page', () => {
    expect(ids(predictCompletedChapters([cap(4, null), cap(5, 140)], 84, 140))).toEqual(['c-5']);
  });
});

describe('closingChaptersLabel', () => {
  it('nenhum capitulo, nenhum aviso', () => {
    expect(closingChaptersLabel([])).toBeNull();
  });

  it('um capitulo', () => {
    expect(closingChaptersLabel([4])).toBe('fecha o capítulo 4');
  });

  it('dois capitulos: nomeia os dois', () => {
    expect(closingChaptersLabel([4, 5])).toBe('fecha os capítulos 4 e 5');
  });

  it('tres ou mais: nomeia todos', () => {
    expect(closingChaptersLabel([3, 4, 5])).toBe('fecha os capítulos 3, 4 e 5');
  });
});

describe('summarizeRange', () => {
  const base = { startText: '85', endText: '112', totalPages: 208, currentPage: 84, chapters: CAPS };

  it('intervalo valido: paginas, XP previsto e o que fecha', () => {
    const r = summarizeRange(base);
    if (!r.valid) throw new Error(`esperava valido, veio: ${r.reason}`);
    expect(r.start).toBe(85);
    expect(r.end).toBe(112);
    expect(r.pages).toBe(28);
    expect(r.xp).toBe(28 * XP_PER_PAGE);
    expect(r.repeatedPages).toBe(0);
    expect(ids(r.closing)).toEqual(['c-4']);
  });

  it('sem o Ate, o motivo pede o Ate', () => {
    expect(summarizeRange({ ...base, endText: '' })).toEqual({ valid: false, reason: 'Diz até onde você foi.' });
  });

  it('sem o De, o motivo pede o De', () => {
    expect(summarizeRange({ ...base, startText: '' })).toEqual({ valid: false, reason: 'Diz de onde você começou.' });
  });

  it.each([
    ['85', '300', 85, 300],
    ['85', '50', 85, 50],
    ['0', '10', 0, 10],
  ] as const)('De %s e Ate %s: o motivo e o de validatePageRange', (startText, endText, s, e) => {
    const esperado = validatePageRange(s, e, 208);
    expect(esperado).not.toBeNull();
    expect(summarizeRange({ ...base, startText, endText })).toEqual({ valid: false, reason: esperado });
  });

  it('conta as paginas repetidas antes do envio', () => {
    const r = summarizeRange({ ...base, startText: '80', endText: '90' });
    if (!r.valid) throw new Error(r.reason);
    expect(r.repeatedPages).toBe(5);
  });

  it('BER-68: XP previsto so das paginas novas, a mesma conta de computeNewPagesRead no servidor', () => {
    // Parou na 84 e registrou 80 a 90: 11 paginas, 5 relidas (80 a 84), 6 novas.
    const r = summarizeRange({ ...base, startText: '80', endText: '90' });
    if (!r.valid) throw new Error(r.reason);
    expect(r.pages).toBe(11);
    expect(r.newPages).toBe(6);
    expect(r.xp).toBe(6 * XP_PER_PAGE);
  });

  it('BER-68: releitura inteira de trecho ja registrado nao preve XP nenhum', () => {
    const r = summarizeRange({ ...base, startText: '10', endText: '40' });
    if (!r.valid) throw new Error(r.reason);
    expect(r.newPages).toBe(0);
    expect(r.xp).toBe(0);
  });

  it('a previsao usa current_page como pagina maxima anterior', () => {
    const r = summarizeRange({ ...base, currentPage: 112, startText: '100', endText: '140' });
    if (!r.valid) throw new Error(r.reason);
    expect(ids(r.closing)).toEqual(['c-5']);
  });

  it('sem capitulos carregados, nao preve fechamento', () => {
    const r = summarizeRange({ ...base, chapters: null });
    if (!r.valid) throw new Error(r.reason);
    expect(r.closing).toEqual([]);
  });
});

describe('ctaLabel', () => {
  it('plural', () => {
    expect(ctaLabel(28)).toBe('Registrar 28 páginas');
  });

  it('singular', () => {
    expect(ctaLabel(1)).toBe('Registrar 1 página');
  });
});

describe('repeatedPagesNote', () => {
  it('plural: avisa que as relidas nao contam XP de novo (BER-68)', () => {
    expect(repeatedPagesNote(5, 84)).toBe(
      '5 páginas desse trecho você já tinha registrado, e elas não contam XP de novo. Seu progresso tá na pág. 84.',
    );
  });

  it('singular', () => {
    expect(repeatedPagesNote(1, 84)).toBe(
      'Uma página desse trecho você já tinha registrado, e ela não conta XP de novo. Seu progresso tá na pág. 84.',
    );
  });
});

describe('successToast', () => {
  it('paginas, XP e sequencia', () => {
    expect(successToast(12, 5)).toEqual({
      message: '12 páginas registradas',
      detail: `+${12 * XP_PER_PAGE} XP · 5 dias seguidos`,
    });
  });

  it('singular nas duas contagens', () => {
    expect(successToast(1, 1)).toEqual({
      message: '1 página registrada',
      detail: `+${XP_PER_PAGE} XP · 1 dia seguido`,
    });
  });

  it('XP com separador de milhar', () => {
    // 250 x 5: sem Intl de proposito, mesmo motivo de formatXp (src/game/xp.ts).
    expect(successToast(250, 3).detail).toBe('+1.250 XP · 3 dias seguidos');
  });

  it('BER-68: a mensagem conta o intervalo, o XP conta so as paginas novas', () => {
    expect(successToast(11, 5, 6)).toEqual({
      message: '11 páginas registradas',
      detail: `+${6 * XP_PER_PAGE} XP · 5 dias seguidos`,
    });
  });
});

describe('chapterCompleteParams (contrato F4-7)', () => {
  const base = { completedChapterIds: ['c-5', 'c-4'], bookId: 'b1', newPages: 56, streak: 5 };

  it('ids na ordem da resposta, unidos por virgula, e o resto como string', () => {
    expect(chapterCompleteParams({ ...base, xpBefore: 1840 })).toEqual({
      chapterIds: 'c-5,c-4',
      bookId: 'b1',
      pagesRead: '56',
      streak: '5',
      xpBefore: '1840',
    });
  });

  it('sem xpBefore (store nao carregado), o param nao existe', () => {
    const params = chapterCompleteParams({ ...base, xpBefore: null });
    expect(params).not.toHaveProperty('xpBefore');
    expect(params).toEqual({ chapterIds: 'c-5,c-4', bookId: 'b1', pagesRead: '56', streak: '5' });
  });

  it('XP zero com store carregado e dado real, nao ausencia', () => {
    expect(chapterCompleteParams({ ...base, xpBefore: 0 }).xpBefore).toBe('0');
  });
});
