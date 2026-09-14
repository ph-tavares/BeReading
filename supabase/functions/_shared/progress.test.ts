// supabase/functions/_shared/progress.test.ts
// Testa o módulo REAL (import de ./progress.ts), não uma cópia — ver BER-35.
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { getMaxPageReached, hasReachedChapterEnd } from './progress.ts';
import { findNewlyCompletedChapters } from '../register-reading-session/reading.ts';

Deno.test('getMaxPageReached: 0 sem sessão nenhuma', () => {
  assertEquals(getMaxPageReached([]), 0);
});

Deno.test('getMaxPageReached: a maior end_page entre as sessões', () => {
  assertEquals(getMaxPageReached([{ end_page: 12 }, { end_page: 40 }, { end_page: 25 }]), 40);
});

Deno.test('hasReachedChapterEnd: libera quando a maior página alcança o fim do capítulo', () => {
  assertEquals(hasReachedChapterEnd(40, [{ end_page: 20 }, { end_page: 40 }]), true);
  assertEquals(hasReachedChapterEnd(40, [{ end_page: 55 }]), true);
});

Deno.test('hasReachedChapterEnd: não libera uma página antes do fim (BER-48)', () => {
  assertEquals(hasReachedChapterEnd(40, [{ end_page: 39 }]), false);
});

Deno.test('hasReachedChapterEnd: não libera sem sessão nenhuma', () => {
  assertEquals(hasReachedChapterEnd(8, []), false);
});

Deno.test('mesma regra do register-reading-session: concluído = end_page <= maior página', () => {
  // A trava do quiz não pode discordar de quem dispara a geração das perguntas:
  // se o registro considera o capítulo completo, o quiz tem que estar liberado.
  const chapters = [{ end_page: 10 }, { end_page: 20 }, { end_page: 30 }];
  const sessions = [{ end_page: 20 }];
  const completedByRegister = findNewlyCompletedChapters(chapters, 0, getMaxPageReached(sessions));
  const unlockedByQuiz = chapters.filter((ch) => hasReachedChapterEnd(ch.end_page, sessions));
  assertEquals(unlockedByQuiz, completedByRegister);
});
