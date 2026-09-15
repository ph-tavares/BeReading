// O CTA da tela de capitulo fechado (BER-58): quiz, convite ao Premium quando a
// cota do mes acabou, ou nada. A regra de cota e a do time (`quizQuotaFor`); o
// teste prova a troca que o Alert.alert antigo fazia.
import { quizCta } from '../../../src/features/chapter-complete/quizCta';
import type { Entitlement } from '../../../src/utils/billing';

function plano(over: Partial<Entitlement> = {}): Entitlement {
  return {
    plan: 'free',
    premium_plan: { id: 'premium_monthly', name: 'Premium', price_cents: 2490, currency: 'BRL', interval: 'month' },
    subscription: null,
    limits: { max_active_books: 2, monthly_quiz_chapters: 4 },
    free_limits: { max_active_books: 2, monthly_quiz_chapters: 4 },
    usage: { active_books: 1, quiz_chapters_this_month: 1 },
    usage_resets_at: '2026-10-01T03:00:00.000Z',
    started_chapter_ids: [],
    ...over,
  };
}

const ESGOTADO = { usage: { active_books: 1, quiz_chapters_this_month: 4 } };

describe('quizCta (BER-58)', () => {
  it('sem capitulo pra abrir, nao oferece nada', () => {
    expect(quizCta(null, plano())).toEqual({ kind: 'none' });
  });

  it('com cota sobrando, abre o quiz', () => {
    expect(quizCta('c-4', plano())).toEqual({ kind: 'quiz', chapterId: 'c-4' });
  });

  it('cota do mes esgotada: convite ao Premium, com quando os quizzes voltam', () => {
    const cta = quizCta('c-4', plano(ESGOTADO));
    expect(cta).toEqual({
      kind: 'premium',
      line: 'Você usou seus 4 quizzes do mês. Seus quizzes voltam em 01/10/2026.',
    });
  });

  it('capitulo ja comecado nunca trava no meio, mesmo com a cota esgotada', () => {
    expect(quizCta('c-4', plano({ ...ESGOTADO, started_chapter_ids: ['c-4'] })))
      .toEqual({ kind: 'quiz', chapterId: 'c-4' });
  });

  it('Premium nao tem cota', () => {
    const premium = plano({ ...ESGOTADO, plan: 'premium', limits: { max_active_books: null, monthly_quiz_chapters: null } });
    expect(quizCta('c-4', premium)).toEqual({ kind: 'quiz', chapterId: 'c-4' });
  });

  it('sem plano carregado (falha de rede), o quiz abre: a tela do quiz tem o estado de cota como rede', () => {
    expect(quizCta('c-4', null)).toEqual({ kind: 'quiz', chapterId: 'c-4' });
  });

  it('a fala nao tem travessao nem exclamacao (voz do DESIGN.md)', () => {
    const cta = quizCta('c-4', plano(ESGOTADO));
    if (cta.kind !== 'premium') throw new Error('esperava premium');
    expect(cta.line).not.toMatch(/[—–!]/);
  });
});
