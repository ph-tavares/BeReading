// supabase/functions/award-badges/index.test.ts
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { evaluateBadges } from './index.ts';
import type { BadgeCriteria, StudentStats } from './index.ts';

const BADGES: BadgeCriteria[] = [
  { id: 'b1', name: 'Primeira Página', criteria_type: 'total_sessions', criteria_value: 1 },
  { id: 'b2', name: 'Leitor de 7 dias', criteria_type: 'streak_days', criteria_value: 7 },
  { id: 'b3', name: 'Leitor de 30 dias', criteria_type: 'streak_days', criteria_value: 30 },
  { id: 'b4', name: 'Capítulo Completo', criteria_type: 'quizzes_answered', criteria_value: 1 },
  { id: 'b5', name: 'Livro Finalizado', criteria_type: 'books_finished', criteria_value: 1 },
  { id: 'b6', name: 'Pensador Crítico', criteria_type: 'reflection_score_80', criteria_value: 5 },
  { id: 'b7', name: 'Devorador de Páginas', criteria_type: 'total_pages', criteria_value: 500 },
  { id: 'b8', name: 'Explorador', criteria_type: 'personal_book', criteria_value: 1 },
  { id: 'b9', name: 'Mestre da Compreensão', criteria_type: 'avg_score_90_book', criteria_value: 1 },
];

const BASE_STATS: StudentStats = {
  total_sessions: 0,
  current_streak: 0,
  quizzes_answered: 0,
  books_finished: 0,
  reflection_scores_above_80: 0,
  total_pages_read: 0,
  has_personal_book: false,
  books_with_avg_score_above_90: 0,
};

Deno.test('evaluateBadges: aluno sem atividade não ganha nenhum badge', () => {
  const result = evaluateBadges(BADGES, BASE_STATS, []);
  assertEquals(result, []);
});

Deno.test('evaluateBadges: primeira sessão concede badge Primeira Página', () => {
  const stats = { ...BASE_STATS, total_sessions: 1 };
  const result = evaluateBadges(BADGES, stats, []);
  assertEquals(result.includes('b1'), true);
});

Deno.test('evaluateBadges: streak 7 concede badge Leitor de 7 dias', () => {
  const stats = { ...BASE_STATS, current_streak: 7 };
  const result = evaluateBadges(BADGES, stats, []);
  assertEquals(result.includes('b2'), true);
});

Deno.test('evaluateBadges: streak 30 concede badge Leitor de 30 dias mas não Leitor de 7 (já ganho)', () => {
  const stats = { ...BASE_STATS, current_streak: 30 };
  const result = evaluateBadges(BADGES, stats, ['b2']);
  assertEquals(result.includes('b3'), true);
  assertEquals(result.includes('b2'), false);
});

Deno.test('evaluateBadges: badge já conquistado não é concedido novamente', () => {
  const stats = { ...BASE_STATS, total_sessions: 5 };
  const result = evaluateBadges(BADGES, stats, ['b1']);
  assertEquals(result.includes('b1'), false);
});

Deno.test('evaluateBadges: 1 quiz respondido concede badge Capítulo Completo', () => {
  const stats = { ...BASE_STATS, quizzes_answered: 1 };
  const result = evaluateBadges(BADGES, stats, []);
  assertEquals(result.includes('b4'), true);
});

Deno.test('evaluateBadges: livro finalizado concede badge Livro Finalizado', () => {
  const stats = { ...BASE_STATS, books_finished: 1 };
  const result = evaluateBadges(BADGES, stats, []);
  assertEquals(result.includes('b5'), true);
});

Deno.test('evaluateBadges: 5 reflexões acima de 80 concede Pensador Crítico', () => {
  const stats = { ...BASE_STATS, reflection_scores_above_80: 5 };
  const result = evaluateBadges(BADGES, stats, []);
  assertEquals(result.includes('b6'), true);
});

Deno.test('evaluateBadges: 4 reflexões acima de 80 não concede Pensador Crítico', () => {
  const stats = { ...BASE_STATS, reflection_scores_above_80: 4 };
  const result = evaluateBadges(BADGES, stats, []);
  assertEquals(result.includes('b6'), false);
});

Deno.test('evaluateBadges: 500 páginas concede Devorador de Páginas', () => {
  const stats = { ...BASE_STATS, total_pages_read: 500 };
  const result = evaluateBadges(BADGES, stats, []);
  assertEquals(result.includes('b7'), true);
});

Deno.test('evaluateBadges: 499 páginas não concede Devorador de Páginas', () => {
  const stats = { ...BASE_STATS, total_pages_read: 499 };
  const result = evaluateBadges(BADGES, stats, []);
  assertEquals(result.includes('b7'), false);
});

Deno.test('evaluateBadges: livro pessoal concede badge Explorador', () => {
  const stats = { ...BASE_STATS, has_personal_book: true };
  const result = evaluateBadges(BADGES, stats, []);
  assertEquals(result.includes('b8'), true);
});

Deno.test('evaluateBadges: sem livro pessoal não concede Explorador', () => {
  const stats = { ...BASE_STATS, has_personal_book: false };
  const result = evaluateBadges(BADGES, stats, []);
  assertEquals(result.includes('b8'), false);
});

Deno.test('evaluateBadges: score médio >= 90 num livro concede Mestre da Compreensão', () => {
  const stats = { ...BASE_STATS, books_with_avg_score_above_90: 1 };
  const result = evaluateBadges(BADGES, stats, []);
  assertEquals(result.includes('b9'), true);
});

Deno.test('evaluateBadges: múltiplos badges conquistados ao mesmo tempo', () => {
  const stats = {
    total_sessions: 1,
    current_streak: 7,
    quizzes_answered: 0,
    books_finished: 0,
    reflection_scores_above_80: 0,
    total_pages_read: 0,
    has_personal_book: false,
    books_with_avg_score_above_90: 0,
  };
  const result = evaluateBadges(BADGES, stats, []);
  assertEquals(result.includes('b1'), true);
  assertEquals(result.includes('b2'), true);
  assertEquals(result.length, 2);
});
