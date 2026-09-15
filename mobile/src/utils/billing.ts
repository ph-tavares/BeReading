// src/utils/billing.ts
// BER-58 / BER-61: tipos do plano e textos que o app mostra sobre ele.
//
// Nada aqui decide acesso — quem decide é o servidor (get-entitlement,
// evaluate-answer, reading-list). O app só antecipa a resposta do servidor para
// mostrar o convite ao Premium antes do erro, e formata o que recebeu.

export type QuotaReason = 'active_books' | 'quiz_chapters';

export interface PlanLimits {
  /** `null` = sem limite. */
  max_active_books: number | null;
  monthly_quiz_chapters: number | null;
}

/** Resposta do `get-entitlement` (e do `billing-mock`). */
export interface Entitlement {
  plan: 'free' | 'premium';
  premium_plan: {
    id: string;
    name: string;
    price_cents: number;
    currency: string;
    interval: string;
  };
  subscription: {
    plan_id: string;
    status: string;
    provider: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
  } | null;
  /** Limites que valem para este leitor agora (tudo `null` no Premium). */
  limits: PlanLimits;
  /** Limites do plano gratuito, para comparar na tela de planos. */
  free_limits: PlanLimits;
  usage: {
    active_books: number;
    quiz_chapters_this_month: number;
  };
  usage_resets_at: string;
  started_chapter_ids: string[];
}

/** Corpo do 402 `quota_exceeded` que as functions devolvem. */
export interface QuotaExceeded {
  reason: QuotaReason;
  limit: number | null;
  used: number;
  resets_at: string | null;
}

export class QuotaExceededError extends Error {
  quota: QuotaExceeded;

  constructor(quota: QuotaExceeded) {
    super(paywallCopy(quota).title);
    this.name = 'QuotaExceededError';
    this.quota = quota;
  }
}

/**
 * Guard por nome, não por `instanceof`: subclasse de `Error` transpilada pelo
 * Babel nem sempre preserva a cadeia de protótipos.
 */
export function isQuotaExceededError(err: unknown): err is QuotaExceededError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'QuotaExceededError' &&
    'quota' in err
  );
}

/** O erro HTTP é o 402 de limite do plano? Devolve os dados do limite, ou `null`. */
export function parseQuotaExceeded(status: number | undefined, body: unknown): QuotaExceeded | null {
  if (status !== 402) return null;
  const payload = (body ?? {}) as { error?: unknown; data?: Partial<QuotaExceeded> | null };
  const reason = payload.data?.reason;
  if (payload.error !== 'quota_exceeded') return null;
  if (reason !== 'active_books' && reason !== 'quiz_chapters') return null;
  return {
    reason,
    limit: typeof payload.data?.limit === 'number' ? payload.data.limit : null,
    used: typeof payload.data?.used === 'number' ? payload.data.used : 0,
    resets_at: typeof payload.data?.resets_at === 'string' ? payload.data.resets_at : null,
  };
}

/** 2490 -> "R$ 24,90". */
export function formatPrice(cents: number): string {
  const reais = Math.floor(cents / 100);
  const centavos = String(cents % 100).padStart(2, '0');
  return `R$ ${reais},${centavos}`;
}

/** Instante ISO -> "dd/mm/aaaa" no fuso de São Paulo (o mesmo da virada da cota). */
export function formatDateBR(iso: string): string {
  const sp = new Date(Date.parse(iso) - 3 * 3600000);
  const dd = String(sp.getUTCDate()).padStart(2, '0');
  const mm = String(sp.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${sp.getUTCFullYear()}`;
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/**
 * O quiz deste capítulo está fora da cota do mês? Mesma regra do evaluate-answer:
 * capítulo já começado nunca trava.
 */
export function quizQuotaFor(entitlement: Entitlement, chapterId: string): QuotaExceeded | null {
  if (entitlement.plan === 'premium') return null;
  const limit = entitlement.limits.monthly_quiz_chapters;
  if (limit === null) return null;
  if (entitlement.started_chapter_ids.includes(chapterId)) return null;
  const used = entitlement.usage.quiz_chapters_this_month;
  if (used < limit) return null;
  return { reason: 'quiz_chapters', limit, used, resets_at: entitlement.usage_resets_at };
}

export interface PaywallCopy {
  title: string;
  description: string;
  hint: string | null;
}

/** Texto do convite ao Premium para cada limite — tom de convite, não de erro. */
export function paywallCopy(quota: QuotaExceeded): PaywallCopy {
  const { limit } = quota;

  if (quota.reason === 'active_books') {
    if (limit === null) {
      return { title: 'Limite de livros atingido', description: 'Com o Premium, você lê quantos livros quiser.', hint: null };
    }
    return {
      title: `Você já está lendo ${plural(limit, 'livro', 'livros')}`,
      description: `No plano gratuito dá para acompanhar ${plural(limit, 'livro', 'livros')} ao mesmo tempo. Com o Premium, você lê quantos quiser.`,
      hint: 'Prefere trocar? Tire um livro da leitura na página dele. O progresso fica salvo.',
    };
  }

  const hint = quota.resets_at ? `Seus quizzes voltam em ${formatDateBR(quota.resets_at)}.` : null;
  if (limit === null) {
    return { title: 'Limite de quizzes atingido', description: 'Com o Premium, os quizzes não têm limite.', hint };
  }
  return {
    title: limit === 1 ? 'Você usou seu quiz do mês' : `Você usou seus ${limit} quizzes do mês`,
    description: `O plano gratuito inclui ${plural(limit, 'capítulo', 'capítulos')} com quiz por mês. Com o Premium, as perguntas e o feedback da IA não têm limite.`,
    hint,
  };
}

/** Resumo do plano para o card do perfil. */
export function planSummary(entitlement: Entitlement): { title: string; lines: string[] } {
  if (entitlement.plan === 'premium') {
    const subscription = entitlement.subscription;
    const lines: string[] = [];
    if (subscription) {
      const end = formatDateBR(subscription.current_period_end);
      lines.push(subscription.cancel_at_period_end ? `Ativo até ${end}, sem renovação` : `Renova em ${end}`);
    }
    lines.push('Livros e quizzes sem limite');
    return { title: entitlement.premium_plan.name, lines };
  }

  const books = entitlement.limits.max_active_books;
  const quizzes = entitlement.limits.monthly_quiz_chapters;
  return {
    title: 'Plano gratuito',
    lines: [
      books === null
        ? 'Livros em leitura sem limite'
        : `${entitlement.usage.active_books} de ${plural(books, 'livro', 'livros')} em leitura`,
      quizzes === null
        ? 'Quizzes sem limite'
        : `${entitlement.usage.quiz_chapters_this_month} de ${plural(quizzes, 'quiz', 'quizzes')} este mês`,
    ],
  };
}

/** Benefícios de cada plano, com os números reais do gratuito vindos do servidor. */
export function planFeatures(entitlement: Entitlement): { free: string[]; premium: string[] } {
  const books = entitlement.free_limits.max_active_books;
  const quizzes = entitlement.free_limits.monthly_quiz_chapters;
  return {
    free: [
      books === null
        ? 'Livros em leitura sem limite'
        : `Até ${plural(books, 'livro', 'livros')} em leitura ao mesmo tempo`,
      quizzes === null
        ? 'Quizzes sem limite'
        : `${plural(quizzes, 'capítulo', 'capítulos')} com quiz por mês`,
      'Registro de leitura e sequência',
      'Conquistas',
    ],
    premium: [
      'Quantos livros quiser ao mesmo tempo',
      'Quiz com IA em todos os capítulos',
      'Feedback da IA em todas as respostas',
      'Registro de leitura, sequência e conquistas',
    ],
  };
}
