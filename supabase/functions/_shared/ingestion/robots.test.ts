import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { hasNoAiSignal, parseRobots } from './robots.ts';

Deno.test('parseRobots: grupo específico do BeReadingBot vence o *', () => {
  const rules = parseRobots(['User-agent: *', 'Disallow: /', '', 'User-agent: BeReadingBot', 'Disallow: /privado'].join('\n'));
  assertEquals(rules.isAllowed('/livros/1984'), true);
  assertEquals(rules.isAllowed('/privado/x'), false);
});

Deno.test('parseRobots: sem grupo específico usa o *', () => {
  const rules = parseRobots('User-agent: *\nDisallow: /busca\n');
  assertEquals(rules.isAllowed('/busca?q=1'), false);
  assertEquals(rules.isAllowed('/resumo'), true);
});

Deno.test('parseRobots: regra mais longa vence; empate favorece Allow', () => {
  const rules = parseRobots('User-agent: *\nDisallow: /livros\nAllow: /livros/resumos\nDisallow: /a\nAllow: /a\n');
  assertEquals(rules.isAllowed('/livros/resumos/1'), true);
  assertEquals(rules.isAllowed('/livros/pdf'), false);
  assertEquals(rules.isAllowed('/a'), true);
});

Deno.test('parseRobots: curinga e âncora de fim', () => {
  const rules = parseRobots('User-agent: *\nDisallow: /*.pdf$\n');
  assertEquals(rules.isAllowed('/obra/livro.pdf'), false);
  assertEquals(rules.isAllowed('/obra/livro.pdf.html'), true);
});

Deno.test('parseRobots: Disallow vazio e comentário não bloqueiam', () => {
  assertEquals(parseRobots('# oi\nUser-agent: *\nDisallow:\n').isAllowed('/qualquer'), true);
});

Deno.test('hasNoAiSignal: header X-Robots-Tag e meta robots', () => {
  assertEquals(hasNoAiSignal(new Headers({ 'x-robots-tag': 'noai, noimageai' }), null), true);
  assertEquals(hasNoAiSignal(new Headers({ 'x-robots-tag': 'noindex' }), null), true);
  assertEquals(hasNoAiSignal(new Headers(), '<meta name="robots" content="index, noai">'), true);
  assertEquals(hasNoAiSignal(new Headers(), '<meta name="robots" content="index, follow">'), false);
});
