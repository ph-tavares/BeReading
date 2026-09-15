// Logica pura da conversa do quiz (spec 7.5, F5 Tarefa 2). A lista de
// mensagens e derivada da mesma entrada que a rota do time ja mantem
// (questions + results + answerTexts + currentIndex + evaluating): a maquina de
// estados nao muda, muda so quem conta o que aconteceu.
import type { Question } from '../../types/database';
import type { QuestionResult } from '../../utils/quizUtils';
import { quizTransitionLine, scoreLine } from '../../assistant/lines';

export type ChatMessage =
  | { id: string; kind: 'assistant'; text: string; label?: string; serif?: boolean }
  | { id: string; kind: 'reader'; text: string }
  | { id: string; kind: 'typing' }
  | { id: string; kind: 'feedback'; text: string; tag: string | null };

export interface ConversationInput {
  questions: Pick<Question, 'type' | 'question_text'>[];
  results: Record<number, QuestionResult>;
  answerTexts: Record<number, string>;
  currentIndex: number;
  evaluating: boolean;
  /** O que o leitor acabou de enviar e a IA ainda avalia. */
  pendingAnswer: string;
}

const ROTULO: Record<Question['type'], string> = {
  comprehension: 'Compreensão',
  reflection: 'Reflexão',
};

/** "72 · +14 XP": a mesma parcela (nota / 5) que src/game/xp.ts soma. */
export function scoreTagLabel(score: number): string {
  return `${score} · +${Math.round(score / 5)} XP`;
}

/** XP real das respostas: so as avaliadas contam. Sem nota nao e zero (BER-42). */
export function answeredXp(results: QuestionResult[]): number {
  return results.reduce((soma, r) => (typeof r.score === 'number' ? soma + Math.round(r.score / 5) : soma), 0);
}

export function buildConversation({
  questions, results, answerTexts, currentIndex, evaluating, pendingAnswer,
}: ConversationInput): ChatMessage[] {
  // Quiz reaberto com tudo respondido chega com currentIndex 0 (BER-48): o
  // historico vai ate a ultima respondida, nao so ate a atual.
  const respondidas = questions.map((_, i) => i).filter((i) => i in results);
  const ate = Math.min(questions.length - 1, Math.max(currentIndex, ...respondidas, 0));

  const mensagens: ChatMessage[] = [];
  for (let i = 0; i <= ate; i++) {
    const pergunta = questions[i];
    if (i > 0) {
      mensagens.push({
        id: `transicao-${i}`,
        kind: 'assistant',
        text: quizTransitionLine(pergunta.type, i === questions.length - 1),
      });
    }
    mensagens.push({
      id: `pergunta-${i}`, kind: 'assistant', text: pergunta.question_text, serif: true, label: ROTULO[pergunta.type],
    });

    const resultado = results[i];
    if (resultado) {
      mensagens.push({ id: `resposta-${i}`, kind: 'reader', text: answerTexts[i] ?? '' });
      mensagens.push(
        resultado.score === null
          ? { id: `devolutiva-${i}`, kind: 'feedback', text: scoreLine(null), tag: null }
          : { id: `devolutiva-${i}`, kind: 'feedback', text: resultado.feedback, tag: scoreTagLabel(resultado.score) },
      );
    } else if (i === currentIndex && evaluating) {
      mensagens.push({ id: `resposta-${i}`, kind: 'reader', text: pendingAnswer });
      mensagens.push({ id: `digitando-${i}`, kind: 'typing' });
    }
  }
  return mensagens;
}
