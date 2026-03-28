import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';

interface Props {
  questionText: string;
  questionType: 'comprehension' | 'reflection';
  questionNumber: number;
  totalQuestions: number;
  onSubmit: (answer: string) => Promise<void>;
  score: number | null;
  feedback: string | null;
}

export function QuizQuestion({
  questionText,
  questionType,
  questionNumber,
  totalQuestions,
  onSubmit,
  score,
  feedback,
}: Props) {
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const submitted = score !== null || feedback !== null;

  async function handleSubmit() {
    if (!answer.trim() || loading) return;
    setLoading(true);
    try {
      await onSubmit(answer.trim());
    } finally {
      setLoading(false);
    }
  }

  const typeLabel = questionType === 'comprehension' ? 'Compreensão' : 'Reflexão';
  const typeColor = questionType === 'comprehension' ? '#4F46E5' : '#F59E0B';

  return (
    <View style={styles.container}>
      {/* Cabeçalho: tipo + dots de progresso */}
      <View style={styles.header}>
        <View style={[styles.typePill, { borderColor: typeColor }]}>
          <Text style={[styles.typeText, { color: typeColor }]}>{typeLabel}</Text>
        </View>
        <View style={styles.dots}>
          {Array.from({ length: totalQuestions }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < questionNumber
                  ? styles.dotFilled
                  : styles.dotEmpty,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Pergunta */}
      <Text style={styles.question}>{questionText}</Text>

      {!submitted ? (
        <>
          {/* Campo de resposta */}
          <View style={[styles.answerWrap, focused && styles.answerWrapFocused]}>
            <TextInput
              style={styles.answerInput}
              value={answer}
              onChangeText={setAnswer}
              placeholder="Escreva sua resposta aqui…"
              placeholderTextColor="#C4C9D4"
              multiline
              textAlignVertical="top"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </View>

          {/* Botão responder */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!answer.trim() || loading) && styles.submitDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!answer.trim() || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitText}>Responder</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        /* Resultado */
        <View style={styles.resultWrap}>
          {score !== null && (
            <View style={styles.scoreRow}>
              <Text style={styles.scoreNumber}>{score}</Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>
          )}
          {feedback && (
            <View style={styles.feedbackCard}>
              <View style={styles.feedbackAccent} />
              <Text style={styles.feedbackText}>{feedback}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 28,
  },

  // Cabeçalho
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  typePill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotFilled: {
    backgroundColor: '#4F46E5',
  },
  dotEmpty: {
    backgroundColor: '#E5E7EB',
  },

  // Pergunta
  question: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    lineHeight: 32,
    marginBottom: 28,
  },

  // Campo resposta
  answerWrap: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    minHeight: 148,
    backgroundColor: '#FAFAFA',
  },
  answerWrapFocused: {
    borderColor: '#4F46E5',
    backgroundColor: '#FFFFFF',
  },
  answerInput: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 24,
    minHeight: 116,
  },

  // Botão
  submitButton: {
    height: 56,
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  submitDisabled: {
    backgroundColor: '#C7D2FE',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Resultado
  resultWrap: {
    gap: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  scoreNumber: {
    fontSize: 56,
    fontWeight: '800',
    color: '#4F46E5',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    lineHeight: 60,
  },
  scoreMax: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  feedbackCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 18,
    paddingLeft: 22,
    overflow: 'hidden',
  },
  feedbackAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#F59E0B',
  },
  feedbackText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
  },
});
