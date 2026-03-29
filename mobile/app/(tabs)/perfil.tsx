import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import {
  getStreak,
  getStudentBadges,
  getAllBadges,
  getStudentBooks,
  getReadingSessions,
} from '../../src/api/queries';
import { BadgeGrid } from '../../src/components/BadgeGrid';
import { PagesChart } from '../../src/components/PagesChart';
import { supabase } from '../../src/lib/supabase';
import type { Streak, Badge, StudentBadge, StudentBook, ReadingSession } from '../../src/types/database';

export default function PerfilScreen() {
  const { student, clear } = useAuthStore();
  const [streak, setStreak] = useState<Streak | null>(null);
  const [studentBadges, setStudentBadges] = useState<(StudentBadge & { badge: Badge })[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [studentBooks, setStudentBooks] = useState<StudentBook[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!student) return;
    let cancelled = false;

    (async () => {
      try {
        await loadData(student.id, (fn) => { if (!cancelled) fn(); });
      } catch (e: unknown) {
        // Mantém estado vazio em caso de erro de rede no load inicial
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [student]);

  async function loadData(
    studentId: string,
    guard: (fn: () => void) => void = (fn) => fn(),
  ) {
    const [s, sb, ab, books, sess] = await Promise.all([
      getStreak(studentId),
      getStudentBadges(studentId),
      getAllBadges(),
      getStudentBooks(studentId),
      getReadingSessions(studentId),
    ]);
    guard(() => {
      setStreak(s);
      setStudentBadges(sb);
      setAllBadges(ab);
      setStudentBooks(books as StudentBook[]);
      setSessions(sess);
    });
  }

  async function handleRefresh() {
    if (!student) return;
    setRefreshing(true);
    try {
      await loadData(student.id);
    } catch (e: unknown) {
      // Mantém dados atuais em caso de erro de rede
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    clear();
  }

  const totalPages = sessions.reduce((sum, s) => sum + s.pages_read, 0);
  const booksFinished = studentBooks.filter(b => b.status === 'finished').length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header índigo */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerName}>{student?.display_name}</Text>
          <Text style={styles.headerSub}>Leitor BeReading</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4F46E5" />
        }
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statValue}>{streak?.current_streak ?? 0}</Text>
            <Text style={styles.statLabel}>dias streak</Text>
            {(streak?.longest_streak ?? 0) > 0 && (
              <Text style={styles.statSub}>máx {streak?.longest_streak}</Text>
            )}
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>📄</Text>
            <Text style={styles.statValue}>{totalPages}</Text>
            <Text style={styles.statLabel}>páginas lidas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>📚</Text>
            <Text style={styles.statValue}>{booksFinished}</Text>
            <Text style={styles.statLabel}>finalizados</Text>
          </View>
        </View>

        {/* Gráfico de leitura */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Últimos 14 dias</Text>
          <PagesChart sessions={sessions} />
        </View>

        {/* Conquistas */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Conquistas</Text>
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>
                {studentBadges.length}/{allBadges.length}
              </Text>
            </View>
          </View>
          {allBadges.length === 0 ? (
            <Text style={styles.emptyBadges}>Nenhuma conquista disponível ainda</Text>
          ) : (
            <BadgeGrid allBadges={allBadges} earnedBadges={studentBadges} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#4F46E5',
  },
  centered: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    gap: 2,
  },
  headerName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },

  // Scroll body
  scroll: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -2,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#4F46E5',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statSub: {
    fontSize: 10,
    color: '#C4B5FD',
    fontWeight: '500',
  },

  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
    gap: 14,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  badgeCount: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  emptyBadges: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
