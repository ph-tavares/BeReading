import { badgeProgress, decorateBadges, iconForCriteria, BADGE_ICONS } from '../../src/game/badges';
import type { Badge, StudentBadge } from '../../src/types/database';

// Este teste roda no projeto "node" do Jest (é .ts, não .tsx — ver package.json),
// sem o preset jest-expo e sem transformIgnorePatterns para react-native. O
// lucide-react-native real importa react-native-svg, que importa react-native, cujo
// index.js usa sintaxe ESM que o babel-jest desse projeto não transforma. O teste só
// precisa que os ícones existam e sejam distinguíveis — não precisa renderizar nada
// —, então o mock evita a cadeia de import inteira. Mesmo problema, mesma solução já
// usada em __tests__/components/CustomTabBar.test.tsx para a mesma biblioteca.
jest.mock('lucide-react-native', () => {
  const icon = (name: string) => ({ displayName: name });
  return {
    BookOpen: icon('BookOpen'),
    Flame: icon('Flame'),
    MessageSquare: icon('MessageSquare'),
    Trophy: icon('Trophy'),
    Brain: icon('Brain'),
    Library: icon('Library'),
    Compass: icon('Compass'),
    Target: icon('Target'),
    Award: icon('Award'),
  };
});

const badge = (over: Partial<Badge>): Badge => ({
  id: 'b1', name: 'Medalha', description: 'desc', icon_url: null,
  criteria_type: 'total_pages', criteria_value: 500, ...over,
});

const stats = {
  totalSessions: 12, currentStreak: 5, quizzesAnswered: 3,
  booksFinished: 1, totalPages: 312,
};

describe('iconForCriteria', () => {
  it.each([
    'total_sessions', 'streak_days', 'quizzes_answered', 'books_finished',
    'reflection_score_80', 'total_pages', 'personal_book', 'avg_score_90_book',
  ])('tem ícone próprio para o criteria_type real %s', (tipo) => {
    expect(BADGE_ICONS[tipo]).toBeDefined();
  });

  it('tipo desconhecido cai num ícone genérico em vez de quebrar', () => {
    expect(iconForCriteria('tipo_que_nao_existe')).toBeDefined();
  });
});

describe('badgeProgress', () => {
  it('mostra progresso de páginas com o alvo do banco', () => {
    expect(badgeProgress(badge({ criteria_type: 'total_pages', criteria_value: 500 }), stats))
      .toEqual({ current: 312, target: 500 });
  });

  it('usa a sequência atual para streak_days', () => {
    expect(badgeProgress(badge({ criteria_type: 'streak_days', criteria_value: 7 }), stats))
      .toEqual({ current: 5, target: 7 });
  });

  it('não passa do alvo quando o leitor já ultrapassou', () => {
    expect(badgeProgress(badge({ criteria_type: 'total_sessions', criteria_value: 1 }), stats))
      .toEqual({ current: 1, target: 1 });
  });

  it('devolve null onde o app não sabe calcular, em vez de inventar', () => {
    expect(badgeProgress(badge({ criteria_type: 'avg_score_90_book' }), stats)).toBeNull();
    expect(badgeProgress(badge({ criteria_type: 'personal_book' }), stats)).toBeNull();
    expect(badgeProgress(badge({ criteria_type: 'reflection_score_80' }), stats)).toBeNull();
  });
});

describe('decorateBadges', () => {
  const todos = [
    badge({ id: 'ganha', criteria_type: 'total_sessions', criteria_value: 1 }),
    badge({ id: 'falta', criteria_type: 'streak_days', criteria_value: 7 }),
  ];
  const ganhas: StudentBadge[] = [
    { id: 'sb1', user_id: 'u1', badge_id: 'ganha', earned_at: '2026-09-02T10:00:00Z' },
  ];

  it('marca o que já foi conquistado, com a data', () => {
    const r = decorateBadges(todos, ganhas, stats);
    expect(r[0]).toMatchObject({ id: 'ganha', earned: true, earnedAt: '2026-09-02T10:00:00Z' });
  });

  it('conquista já ganha não mostra barra de progresso', () => {
    expect(decorateBadges(todos, ganhas, stats)[0].progress).toBeNull();
  });

  it('conquista que falta mostra quanto falta', () => {
    const r = decorateBadges(todos, ganhas, stats)[1];
    expect(r.earned).toBe(false);
    expect(r.progress).toEqual({ current: 5, target: 7 });
  });

  it('ordena as conquistadas primeiro', () => {
    const invertido = [todos[1], todos[0]];
    expect(decorateBadges(invertido, ganhas, stats).map((b) => b.id)).toEqual(['ganha', 'falta']);
  });
});
