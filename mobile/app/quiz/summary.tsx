import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getScoreConfig } from '../../src/utils/quizUtils';

export default function QuizSummaryScreen() {
  const { avgScore, total } = useLocalSearchParams<{ avgScore: string; total: string }>();
  const router = useRouter();

  const score = parseInt(avgScore ?? '0', 10);
  const totalN = parseInt(total ?? '1', 10);
  const config = getScoreConfig(score);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Score principal */}
        <View style={styles.scoreCard}>
          <Text style={styles.emoji}>{config.emoji}</Text>
          <Text style={[styles.scoreNumber, { color: config.color }]}>{score}</Text>
          <Text style={styles.scoreMax}>pontos / 100</Text>
          <View style={[styles.labelPill, { backgroundColor: config.color + '1A' }]}>
            <Text style={[styles.labelText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{totalN}</Text>
            <Text style={styles.statLabel}>
              {totalN === 1 ? 'pergunta' : 'perguntas'}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{score}</Text>
            <Text style={styles.statLabel}>média</Text>
          </View>
        </View>

        {/* Mensagem — estilo nota do professor */}
        <View style={styles.messageCard}>
          <View style={styles.messageAccent} />
          <Text style={styles.messageText}>{config.message}</Text>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.replace('/')}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>Voltar ao início</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 20,
  },

  // Score card
  scoreCard: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  emoji: {
    fontSize: 52,
    marginBottom: 8,
  },
  scoreNumber: {
    fontSize: 72,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    lineHeight: 76,
    letterSpacing: -2,
  },
  scoreMax: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 2,
  },
  labelPill: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 10,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    alignSelf: 'stretch',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },

  // Mensagem
  messageCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 18,
    paddingLeft: 22,
    alignSelf: 'stretch',
  },
  messageAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#F59E0B',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  messageText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
  },

  // CTA
  ctaButton: {
    height: 56,
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    marginTop: 4,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
