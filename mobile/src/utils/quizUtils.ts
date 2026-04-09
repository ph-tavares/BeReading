export interface QuestionResult {
  score: number | null;
  feedback: string;
}

export function calcAverageScore(results: QuestionResult[]): number {
  if (results.length === 0) return 0;
  const total = results.reduce((sum, r) => sum + (r.score ?? 0), 0);
  return Math.round(total / results.length);
}

export interface ScoreConfig {
  emoji: string;
  label: string;
  message: string;
  color: string;
}

export function getScoreConfig(score: number): ScoreConfig {
  if (score >= 80) {
    return {
      emoji: '🏆',
      label: 'Excelente!',
      message: 'Você demonstrou ótima compreensão do capítulo. Continue assim!',
      color: '#10B981',
    };
  }
  if (score >= 60) {
    return {
      emoji: '✅',
      label: 'Bom trabalho!',
      message: 'Você entendeu bem o capítulo. A leitura atenta faz toda a diferença.',
      color: '#4F46E5',
    };
  }
  return {
    emoji: '📚',
    label: 'Continue lendo!',
    message: 'Cada capítulo lido é um passo a mais na sua jornada. Continue praticando!',
    color: '#F59E0B',
  };
}
