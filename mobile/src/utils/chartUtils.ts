import type { ReadingSession } from '../types/database';

export interface DayData {
  label: string;
  pages: number;
  dateStr: string;
}

export function groupSessionsByDay(
  sessions: ReadingSession[],
  numDays: number = 14,
  today: Date = new Date(),
): DayData[] {
  const days: DayData[] = [];

  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    let label: string;
    if (i === 0) {
      label = 'Hoje';
    } else if (i === 1) {
      label = 'Ontem';
    } else {
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      label = `${day}/${month}`;
    }

    const pages = sessions
      .filter(s => s.read_at.startsWith(dateStr))
      .reduce((sum, s) => sum + s.pages_read, 0);

    days.push({ label, pages, dateStr });
  }

  return days;
}
