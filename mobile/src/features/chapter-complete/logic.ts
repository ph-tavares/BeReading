// Logica pura da tela de capitulo fechado (spec S7.3, F4 Tarefa 6). Sem React
// e sem primitivo visual: so dado e conta, para o teste checar produto e nao
// forma.
import type { Chapter } from '../../types/database';
import { XP_PER_PAGE, formatXp, levelFor, type LevelInfo } from '../../game/xp';
import { chapterClosedTitle, chapterClosedTitleWithoutNumber } from '../../assistant/lines';

// `type`, nao `interface`: o expo-router tipa params como registro com indice
// de string, e so alias de tipo literal e atribuivel a isso.
export type ChapterCompleteRawParams = {
  chapterIds?: string;
  bookId?: string;
  pagesRead?: string;
  streak?: string;
  xpBefore?: string;
};

export interface ChapterCompleteInput {
  /** Na ordem da resposta do servidor, que nao e a ordem dos capitulos. */
  chapterIds: string[];
  pagesRead: number | null;
  streak: number | null;
  /** `null` quando o store nao tinha carregado antes do envio (F4-7). */
  xpBefore: number | null;
}

function inteiro(texto: string | undefined): number | null {
  return texto !== undefined && /^\d+$/.test(texto) ? Number(texto) : null;
}

/** Contrato F4-7: tudo chega como string, e so vira numero o que e numero. */
export function parseParams(raw: ChapterCompleteRawParams): ChapterCompleteInput {
  return {
    chapterIds: (raw.chapterIds ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
    pagesRead: inteiro(raw.pagesRead),
    streak: inteiro(raw.streak),
    xpBefore: inteiro(raw.xpBefore),
  };
}

export interface ChapterTargets {
  /** Numeros em ordem crescente; `null` quando a consulta nao trouxe todos. */
  numbers: number[] | null;
  /** Onde o quiz abre: o menor numero, ou o primeiro id quando nao ha numero. */
  quizChapterId: string | null;
}

type ChapterNumber = Pick<Chapter, 'id' | 'number'>;

/**
 * F4-15. `rows` e a resposta de `getChaptersByIds`, ou `null` se ela falhou.
 * O `.in()` nao preserva ordem, entao a ordem sai do numero. Resposta que nao
 * cobre todos os ids conta como falha: um titulo com dois de tres numeros
 * erraria a contagem.
 */
export function chapterTargets(ids: string[], rows: ChapterNumber[] | null): ChapterTargets {
  const achados = ids
    .map((id) => rows?.find((r) => r.id === id))
    .filter((r): r is ChapterNumber => r !== undefined);

  if (ids.length === 0 || achados.length !== ids.length) {
    return { numbers: null, quizChapterId: ids[0] ?? null };
  }

  achados.sort((a, b) => a.number - b.number);
  return { numbers: achados.map((r) => r.number), quizChapterId: achados[0].id };
}

export function closedTitle(numbers: number[] | null, idCount: number): string {
  return numbers ? chapterClosedTitle(numbers) : chapterClosedTitleWithoutNumber(idCount);
}

/**
 * F4-14: a mesma parcela que o toast do registro mostra quando nao fecha
 * capitulo (`successToast`). O mesmo registro, o mesmo numero nos dois caminhos.
 */
export function xpGained(pagesRead: number | null): number | null {
  return pagesRead === null ? null : pagesRead * XP_PER_PAGE;
}

/** Um trecho do anel contando. */
export interface CountSegment {
  fromProgress: number;
  toProgress: number;
  /** O XP do centro do anel anda junto, na mesma fracao. */
  fromXp: number;
  toXp: number;
  /** O nivel que o centro mostra durante o trecho. */
  level: LevelInfo;
}

export interface XpPlan {
  /** Onde o anel repousa, e o que o leitor de tela ouve desde o inicio. */
  finalXp: number;
  finalLevel: LevelInfo;
  /** Vazio: anel parado. Um trecho, ou dois quando sobe de nivel. */
  segments: CountSegment[];
  leveledUp: boolean;
}

interface XpPlanInput {
  xpBefore: number | null;
  gained: number;
  storeXp: number;
  storeLevel: LevelInfo;
  /** `carregado` do progressStore: distingue XP zero de "sem dado". */
  loaded: boolean;
}

/**
 * F4-14. Conta de `xpBefore` ate `max(store, xpBefore + ganho)`. O `max` e o
 * que segura um `refresh` que falhou no registro: o store ainda teria o XP
 * antigo, e sem ele o ganho apareceria como zero.
 *
 * Sem `xpBefore` nao ha "antes": o anel fica parado no store e nao ha subida de
 * nivel, porque nao da pra provar que subiu. Sem `xpBefore` e sem carga
 * nenhuma, nao ha XP pra mostrar, e o retorno e `null` em vez de um zero
 * inventado.
 */
export function xpPlan({ xpBefore, gained, storeXp, storeLevel, loaded }: XpPlanInput): XpPlan | null {
  if (xpBefore === null) {
    return loaded ? { finalXp: storeXp, finalLevel: storeLevel, segments: [], leveledUp: false } : null;
  }

  const alvo = Math.max(storeXp, xpBefore + gained);
  const antes = levelFor(xpBefore);
  const depois = levelFor(alvo);

  if (depois.level <= antes.level || antes.next === null) {
    return {
      finalXp: alvo,
      finalLevel: depois,
      leveledUp: false,
      segments: [{
        fromProgress: antes.progress, toProgress: depois.progress, fromXp: xpBefore, toXp: alvo, level: depois,
      }],
    };
  }

  // Subiu: completa ate o limiar do nivel de antes, zera e continua ate o
  // progresso do nivel novo. Subindo dois niveis de uma vez, continua sendo uma
  // volta so (F4-25). O XP do segundo trecho sai do piso do nivel novo, e nao do
  // limiar de antes: o centro ja mostra o nivel novo, e contar do limiar poria o
  // numero abaixo do piso dele. O numero salta junto com o arco que zera.
  const primeiro: CountSegment = {
    fromProgress: antes.progress, toProgress: 1, fromXp: xpBefore, toXp: antes.next, level: antes,
  };
  // Alvo exatamente no piso do nivel novo: o segundo trecho teria comprimento
  // zero. O anel completa e a tela termina direto no nivel novo.
  if (depois.progress === 0) {
    return { finalXp: alvo, finalLevel: depois, leveledUp: true, segments: [primeiro] };
  }
  return {
    finalXp: alvo,
    finalLevel: depois,
    leveledUp: true,
    segments: [
      primeiro,
      { fromProgress: 0, toProgress: depois.progress, fromXp: depois.floor, toXp: alvo, level: depois },
    ],
  };
}

/**
 * O XP do centro numa fracao do trecho. Worklet (F4-24): o XpRing chama isto na
 * thread de UI, a cada quadro da contagem. Sem a diretiva, o aparelho quebra ao
 * contar, e o Jest nao pega, porque o plugin do Reanimated fica desligado nele.
 */
export function xpAt(segment: CountSegment, fraction: number): number {
  'worklet';
  return Math.round(segment.fromXp + (segment.toXp - segment.fromXp) * fraction);
}

export function xpTagLabel(pagesRead: number | null): string | null {
  const ganho = xpGained(pagesRead);
  return ganho === null ? null : `+${formatXp(ganho)} XP`;
}

/** Vem do `current_streak` que o registro devolveu. Zero nao vira tag. */
export function streakTagLabel(streak: number | null): string | null {
  if (streak === null || streak < 1) return null;
  return streak === 1 ? '1 dia seguido' : `${streak} dias seguidos`;
}

/** A legenda sob o numero do centro do anel. */
export function ringCaption(level: LevelInfo): string {
  return level.next === null ? 'XP' : `de ${formatXp(level.next)} XP`;
}

/** O que o leitor de tela ouve no anel: sempre o valor final. */
export function ringLabel(level: LevelInfo, xp: number): string {
  return `Nível ${level.level} · ${level.title}. ${formatXp(xp)} ${ringCaption(level)}`;
}
