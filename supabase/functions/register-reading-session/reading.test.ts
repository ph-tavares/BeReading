// supabase/functions/register-reading-session/reading.test.ts
// BER-35: importa o módulo REAL. A versão anterior deste arquivo redefinia as
// funções localmente, e a de streak testava uma assinatura que o handler nunca
// teve — mudar a regra de streak não quebrava teste nenhum.
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  findNewlyCompletedChapters,
  getMaxPageReached,
  getTodayInSaoPaulo,
  nextStreak,
  type StreakRow,
} from './reading.ts';

function streak(over: Partial<StreakRow> = {}): StreakRow {
  return { current_streak: 3, longest_streak: 7, last_read_date: '2026-03-22', ...over };
}

Deno.test('getMaxPageReached: retorna 0 para sessões vazias', () => {
  assertEquals(getMaxPageReached([]), 0);
});

Deno.test('getMaxPageReached: retorna o maior end_page', () => {
  assertEquals(getMaxPageReached([
    { end_page: 20 }, { end_page: 40 }, { end_page: 60 },
  ]), 60);
});

Deno.test('getMaxPageReached: não assume ordem das sessões', () => {
  assertEquals(getMaxPageReached([{ end_page: 60 }, { end_page: 20 }]), 60);
});

Deno.test('findNewlyCompletedChapters: detecta capítulo recém-completado', () => {
  const chapters = [
    { id: 'ch1', end_page: 30 },
    { id: 'ch2', end_page: 60 },
  ];
  const completed = findNewlyCompletedChapters(chapters, 20, 35);
  assertEquals(completed.length, 1);
  assertEquals(completed[0].id, 'ch1');
});

Deno.test('findNewlyCompletedChapters: não redetecta capítulo já completado', () => {
  const completed = findNewlyCompletedChapters([{ id: 'ch1', end_page: 30 }], 30, 45);
  assertEquals(completed.length, 0);
});

Deno.test('findNewlyCompletedChapters: detecta múltiplos capítulos de uma vez', () => {
  const chapters = [
    { id: 'ch1', end_page: 20 },
    { id: 'ch2', end_page: 40 },
    { id: 'ch3', end_page: 60 },
  ];
  assertEquals(findNewlyCompletedChapters(chapters, 0, 50).length, 2);
});

// --- streak: a regra que estava sem teste de verdade ---

Deno.test('nextStreak: primeira leitura começa em 1', () => {
  assertEquals(nextStreak(null, '2026-03-23'), { current: 1, longest: 1 });
  assertEquals(nextStreak(undefined, '2026-03-23'), { current: 1, longest: 1 });
});

Deno.test('nextStreak: leu ontem, incrementa e não mexe no recorde maior', () => {
  assertEquals(
    nextStreak(streak({ current_streak: 3, longest_streak: 7, last_read_date: '2026-03-22' }), '2026-03-23'),
    { current: 4, longest: 7 },
  );
});

Deno.test('nextStreak: ao passar do recorde, o recorde acompanha', () => {
  assertEquals(
    nextStreak(streak({ current_streak: 7, longest_streak: 7, last_read_date: '2026-03-22' }), '2026-03-23'),
    { current: 8, longest: 8 },
  );
});

Deno.test('nextStreak: registrar de novo no mesmo dia não muda nada', () => {
  assertEquals(
    nextStreak(streak({ current_streak: 3, longest_streak: 7, last_read_date: '2026-03-23' }), '2026-03-23'),
    { current: 3, longest: 7 },
  );
});

Deno.test('nextStreak: dia pulado zera a sequência, preservando o recorde', () => {
  assertEquals(
    nextStreak(streak({ current_streak: 9, longest_streak: 9, last_read_date: '2026-03-20' }), '2026-03-23'),
    { current: 1, longest: 9 },
  );
});

Deno.test('getTodayInSaoPaulo: devolve YYYY-MM-DD', () => {
  const hoje = getTodayInSaoPaulo(new Date('2026-03-23T15:00:00.000Z'));
  assertEquals(/^\d{4}-\d{2}-\d{2}$/.test(hoje), true);
});

// --- BER-78: getTodayInSaoPaulo não pode depender do fuso da máquina ---

/**
 * Roda `fn` com `Date.prototype.getTimezoneOffset` fixado em `offsetMinutes`,
 * simulando o processo rodando numa máquina naquele fuso. Restaura o método
 * original ao final, mesmo se `fn` lançar.
 */
function withMachineTimezoneOffset<T>(offsetMinutes: number, fn: () => T): T {
  const original = Date.prototype.getTimezoneOffset;
  Date.prototype.getTimezoneOffset = () => offsetMinutes;
  try {
    return fn();
  } finally {
    Date.prototype.getTimezoneOffset = original;
  }
}

Deno.test('getTodayInSaoPaulo: resultado não muda com o fuso da máquina (UTC vs São Paulo vs qualquer outro)', () => {
  const now = new Date('2026-03-23T15:00:00.000Z');

  const emUTC = withMachineTimezoneOffset(0, () => getTodayInSaoPaulo(now));
  const emSaoPaulo = withMachineTimezoneOffset(180, () => getTodayInSaoPaulo(now));
  const emTokyo = withMachineTimezoneOffset(-540, () => getTodayInSaoPaulo(now));

  assertEquals(emUTC, '2026-03-23');
  assertEquals(emSaoPaulo, emUTC);
  assertEquals(emTokyo, emUTC);
});

Deno.test('getTodayInSaoPaulo: vira o dia às 03:00 UTC (00:00 em São Paulo), não à meia-noite UTC', () => {
  // 02:59 UTC = 23:59 do dia anterior em São Paulo (UTC-3)
  assertEquals(
    getTodayInSaoPaulo(new Date('2026-03-24T02:59:00.000Z')),
    '2026-03-23',
  );
  // 03:00 UTC = 00:00 do novo dia em São Paulo
  assertEquals(
    getTodayInSaoPaulo(new Date('2026-03-24T03:00:00.000Z')),
    '2026-03-24',
  );
});
