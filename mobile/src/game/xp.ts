// XP e nível derivados do que está no banco (BER-77).
//
// Não existe coluna de XP: a tela antiga calculava "páginas × 5" e "nota ÷ 5" na
// hora e jogava fora. A fórmula é a mesma; o que muda é a fonte — agora soma o
// que está persistido, então o mesmo leitor vê o mesmo número em qualquer
// aparelho. Persistir XP no banco é decisão de backend, fora desta branch.
//
// Desde a BER-68, `pages_read` guarda só as páginas novas de cada sessão, e
// página relida não soma XP de novo. O histórico anterior não foi recalculado
// (decisão da BER-68), então sessões antigas ainda podem trazer relidas.

export const XP_PER_PAGE = 5;
export const XP_PER_BADGE = 100;

export interface ScoredAnswer {
  comprehension_score: number | null;
  evaluation_status: string;
}

export function xpFromPages(sessions: { pages_read: number }[]): number {
  return sessions.reduce((sum, s) => sum + s.pages_read * XP_PER_PAGE, 0);
}

/** Só resposta avaliada conta. Nota ausente não é nota zero (BER-42). */
export function xpFromScores(answers: ScoredAnswer[]): number {
  return answers.reduce((sum, a) => {
    if (a.evaluation_status !== 'completed' || a.comprehension_score === null) return sum;
    return sum + Math.round(a.comprehension_score / 5);
  }, 0);
}

export interface XpInput {
  sessions: { pages_read: number }[];
  answers: ScoredAnswer[];
  badgeCount: number;
}

export function totalXp({ sessions, answers, badgeCount }: XpInput): number {
  return xpFromPages(sessions) + xpFromScores(answers) + badgeCount * XP_PER_BADGE;
}

export const LEVEL_TITLES = [
  'Primeira página', 'Curioso', 'Engatado', 'Constante',
  'Maratonista', 'Devorador', 'Rato de biblioteca', 'Lenda da estante',
] as const;

const MAX_LEVEL = LEVEL_TITLES.length; // 8: daí em diante o título se repete

/**
 * XP necessário para ALCANÇAR o nível n. Quadrática suave: cada nível custa um
 * pouco mais que o anterior, sem virar parede. Ajustar o ritmo é mudar só o 110.
 */
function threshold(level: number): number {
  return 110 * level * (level - 1);
}

export interface LevelInfo {
  level: number;
  title: string;
  /** XP em que este nível começou. */
  floor: number;
  /** XP do próximo nível; `null` no topo. */
  next: number | null;
  /** Fração de 0 a 1 entre `floor` e `next`. */
  progress: number;
}

export function levelFor(xp: number): LevelInfo {
  const safe = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;

  let level = 1;
  while (level < MAX_LEVEL && safe >= threshold(level + 1)) level++;

  const floor = threshold(level);
  const next = level < MAX_LEVEL ? threshold(level + 1) : null;
  const progress = next === null ? 1 : (safe - floor) / (next - floor);

  return { level, title: LEVEL_TITLES[level - 1], floor, next, progress };
}

/**
 * XP no padrao pt-BR (ponto como separador de milhar). Sem `Intl`: o
 * ambiente do Hermes varia por build, e uma conta de string simples e
 * determinada em qualquer um deles.
 *
 * Mora aqui, e nao numa feature (F4-22): Hoje, registro e capitulo fechado
 * mostram XP, e tres telas importando de uma delas era import entre features.
 *
 * Worklet (F4-24): o XpRing formata o numero na thread de UI, a cada quadro da
 * contagem. Por isso o agrupamento e um laco simples, e nao regex: roda igual
 * no JS e no runtime do worklet.
 */
export function formatXp(n: number): string {
  'worklet';
  const digitos = String(Math.round(Math.abs(n)));
  let agrupado = '';
  for (let i = 0; i < digitos.length; i++) {
    if (i > 0 && (digitos.length - i) % 3 === 0) agrupado += '.';
    agrupado += digitos[i];
  }
  return n < 0 ? `-${agrupado}` : agrupado;
}
