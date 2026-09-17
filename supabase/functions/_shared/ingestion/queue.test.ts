import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  afterFailure,
  HttpStatusError,
  isStaleLock,
  isTransientError,
  nextUtcDay,
  PermanentStepError,
  startOfUtcDay,
} from './queue.ts';

const NOW = Date.parse('2026-09-16T10:00:00.000Z');

Deno.test('isTransientError: 429, 5xx, rede e timeout são transitórios', () => {
  assertEquals(isTransientError(new HttpStatusError(429, 'x')), true);
  assertEquals(isTransientError(new HttpStatusError(503, 'x')), true);
  assertEquals(isTransientError(Object.assign(new Error('ai'), { status: 500 })), true);
  assertEquals(isTransientError(new TypeError('error sending request')), true);
  assertEquals(isTransientError(new DOMException('t', 'TimeoutError')), true);
});

Deno.test('isTransientError: 404, erro permanente e erro comum não são', () => {
  assertEquals(isTransientError(new HttpStatusError(404, 'x')), false);
  assertEquals(isTransientError(new PermanentStepError('política')), false);
  assertEquals(isTransientError(new Error('JSON inválido')), false);
});

Deno.test('afterFailure: espera 1 min, 5 min e 30 min; depois falha', () => {
  assertEquals(afterFailure(1, true, NOW), { status: 'pending', nextAttemptAt: '2026-09-16T10:01:00.000Z' });
  assertEquals(afterFailure(2, true, NOW), { status: 'pending', nextAttemptAt: '2026-09-16T10:05:00.000Z' });
  assertEquals(afterFailure(3, true, NOW), { status: 'pending', nextAttemptAt: '2026-09-16T10:30:00.000Z' });
  assertEquals(afterFailure(4, true, NOW), { status: 'failed', nextAttemptAt: null });
});

Deno.test('afterFailure: erro permanente falha na hora', () => {
  assertEquals(afterFailure(1, false, NOW), { status: 'failed', nextAttemptAt: null });
});

Deno.test('isStaleLock e dias UTC', () => {
  assertEquals(isStaleLock('2026-09-16T09:54:00.000Z', NOW), true);
  assertEquals(isStaleLock('2026-09-16T09:56:00.000Z', NOW), false);
  assertEquals(isStaleLock(null, NOW), false);
  assertEquals(startOfUtcDay(NOW), '2026-09-16T00:00:00.000Z');
  assertEquals(nextUtcDay(NOW), '2026-09-17T00:05:00.000Z');
});
