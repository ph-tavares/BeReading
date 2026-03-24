// supabase/functions/register-reading-session/index.test.ts
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

// Lógica pura de detecção de capítulo completo
// (extraída para facilitar teste sem Supabase)

interface Chapter {
  id: string;
  start_page: number;
  end_page: number;
}

interface Session {
  start_page: number;
  end_page: number;
}

function getMaxPageReached(sessions: Session[]): number {
  if (sessions.length === 0) return 0;
  return Math.max(...sessions.map(s => s.end_page));
}

function findNewlyCompletedChapters(
  chapters: Chapter[],
  previousMaxPage: number,
  newMaxPage: number
): Chapter[] {
  return chapters.filter(
    ch => ch.end_page > previousMaxPage && ch.end_page <= newMaxPage
  );
}

function calculateNewStreak(lastReadDate: string | null, todayStr: string): number {
  if (!lastReadDate) return 1;
  const last = new Date(lastReadDate);
  const today = new Date(todayStr);
  const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 0; // já leu hoje, não incrementa
  if (diffDays === 1) return 1; // dia seguinte, incrementa
  return -1; // resetar streak
}

// --- TESTES ---

Deno.test('getMaxPageReached: retorna 0 para sessões vazias', () => {
  assertEquals(getMaxPageReached([]), 0);
});

Deno.test('getMaxPageReached: retorna o maior end_page', () => {
  const sessions = [
    { start_page: 1, end_page: 20 },
    { start_page: 15, end_page: 40 },
    { start_page: 35, end_page: 60 },
  ];
  assertEquals(getMaxPageReached(sessions), 60);
});

Deno.test('findNewlyCompletedChapters: detecta capítulo recém-completado', () => {
  const chapters: Chapter[] = [
    { id: 'ch1', start_page: 1, end_page: 30 },
    { id: 'ch2', start_page: 31, end_page: 60 },
  ];
  // Antes: max page era 20 (dentro do ch1)
  // Agora: max page é 35 (passou o end_page do ch1 = 30)
  const completed = findNewlyCompletedChapters(chapters, 20, 35);
  assertEquals(completed.length, 1);
  assertEquals(completed[0].id, 'ch1');
});

Deno.test('findNewlyCompletedChapters: não detecta capítulo já completado', () => {
  const chapters: Chapter[] = [
    { id: 'ch1', start_page: 1, end_page: 30 },
  ];
  // Já tinha lido até 30 antes — não é "recém"
  const completed = findNewlyCompletedChapters(chapters, 30, 45);
  assertEquals(completed.length, 0);
});

Deno.test('findNewlyCompletedChapters: detecta múltiplos capítulos de uma vez', () => {
  const chapters: Chapter[] = [
    { id: 'ch1', start_page: 1, end_page: 20 },
    { id: 'ch2', start_page: 21, end_page: 40 },
    { id: 'ch3', start_page: 41, end_page: 60 },
  ];
  // Leu de 1 a 50 de uma vez (completou ch1 e ch2)
  const completed = findNewlyCompletedChapters(chapters, 0, 50);
  assertEquals(completed.length, 2);
});

Deno.test('calculateNewStreak: primeiro dia retorna 1', () => {
  assertEquals(calculateNewStreak(null, '2026-03-23'), 1);
});

Deno.test('calculateNewStreak: dia consecutivo retorna 1', () => {
  assertEquals(calculateNewStreak('2026-03-22', '2026-03-23'), 1);
});

Deno.test('calculateNewStreak: mesmo dia retorna 0', () => {
  assertEquals(calculateNewStreak('2026-03-23', '2026-03-23'), 0);
});

Deno.test('calculateNewStreak: dia pulado retorna -1 (reset)', () => {
  assertEquals(calculateNewStreak('2026-03-20', '2026-03-23'), -1);
});
