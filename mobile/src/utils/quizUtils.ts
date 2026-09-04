export interface QuestionResult {
  /** `null` = a IA ainda não avaliou. Não é zero — ver BER-42. */
  score: number | null;
  feedback: string;
}

function hasScore(r: QuestionResult): r is QuestionResult & { score: number } {
  return typeof r.score === 'number';
}

/**
 * Média das respostas **já avaliadas**.
 *
 * BER-42: antes, `score: null` entrava na conta como 0 e uma única falha da IA
 * derrubava a média em ~25 pontos num quiz de 4 perguntas. Nota que não existe não
 * é nota zero: a resposta pendente fica de fora do cálculo até ser avaliada.
 *
 * @returns `null` quando nenhuma resposta tem nota ainda.
 */
export function calcAverageScore(results: QuestionResult[]): number | null {
  const scored = results.filter(hasScore);
  if (scored.length === 0) return null;
  const total = scored.reduce((sum, r) => sum + r.score, 0);
  return Math.round(total / scored.length);
}

/** Quantas respostas ainda aguardam avaliação da IA. */
export function countPendingEvaluations(results: QuestionResult[]): number {
  return results.filter((r) => !hasScore(r)).length;
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
