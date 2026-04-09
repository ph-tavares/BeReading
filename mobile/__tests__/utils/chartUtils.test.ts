import { groupSessionsByDay } from '../../src/utils/chartUtils';
import type { ReadingSession } from '../../src/types/database';

const TODAY = new Date('2026-03-28T12:00:00Z');

function session(dateStr: string, pages: number): ReadingSession {
  return {
    id: Math.random().toString(),
    user_id: 'u1',
    book_id: 'b1',
    start_page: 1,
    end_page: pages,
    pages_read: pages,
    read_at: `${dateStr}T10:00:00Z`,
  };
}

describe('groupSessionsByDay', () => {
  it('retorna exatamente N dias', () => {
    expect(groupSessionsByDay([], 14, TODAY)).toHaveLength(14);
    expect(groupSessionsByDay([], 7, TODAY)).toHaveLength(7);
  });

  it('último item é Hoje', () => {
    const result = groupSessionsByDay([], 14, TODAY);
    expect(result[13].label).toBe('Hoje');
  });

  it('penúltimo item é Ontem', () => {
    const result = groupSessionsByDay([], 14, TODAY);
    expect(result[12].label).toBe('Ontem');
  });

  it('demais itens têm label DD/MM', () => {
    const result = groupSessionsByDay([], 14, TODAY);
    // 12 dias atrás de 2026-03-28 = 2026-03-16
    expect(result[1].label).toBe('16/03');
  });

  it('soma páginas do mesmo dia', () => {
    const sessions = [
      session('2026-03-28', 20),
      session('2026-03-28', 15),
    ];
    const result = groupSessionsByDay(sessions, 14, TODAY);
    expect(result[13].pages).toBe(35);
  });

  it('separa sessões em dias distintos', () => {
    const sessions = [
      session('2026-03-28', 10),
      session('2026-03-27', 5),
    ];
    const result = groupSessionsByDay(sessions, 14, TODAY);
    expect(result[13].pages).toBe(10);
    expect(result[12].pages).toBe(5);
  });

  it('ignora sessões anteriores ao período', () => {
    const sessions = [session('2026-03-01', 100)];
    const result = groupSessionsByDay(sessions, 14, TODAY);
    const total = result.reduce((sum, d) => sum + d.pages, 0);
    expect(total).toBe(0);
  });

  it('dia sem sessões tem pages = 0', () => {
    const result = groupSessionsByDay([], 14, TODAY);
    result.forEach(d => expect(d.pages).toBe(0));
  });
});
