import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpen, Trophy, Award } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { ClassroomGateModal } from '../../src/components/ClassroomGateModal';
import { BadgeGrid } from '../../src/components/BadgeGrid';
import { PagesChart } from '../../src/components/PagesChart';
import { Card } from '../../src/components/Card';
import { Press3DButton } from '../../src/components/Press3DButton';
import { SectionLabel } from '../../src/components/SectionLabel';
import { LottieSlot } from '../../src/components/LottieSlot';
import { Flame } from 'lucide-react-native';
import {
  getStreak,
  getStudentBadges,
  getAllBadges,
  getStudentBooks,
  getReadingSessions,
} from '../../src/api/queries';
import { supabase } from '../../src/lib/supabase';
import { colors, fonts, radii } from '../../src/theme/tokens';
import type { Streak, Badge, StudentBadge, StudentBook, ReadingSession } from '../../src/types/database';

export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const { profile, clear } = useAuthStore();
  const [streak, setStreak] = useState<Streak | null>(null);
  const [studentBadges, setStudentBadges] = useState<(StudentBadge & { badge: Badge })[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [studentBooks, setStudentBooks] = useState<StudentBook[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showGateModal, setShowGateModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;

      (async () => {
        try {
          await loadData(profile.user_id, (fn) => { if (!cancelled) fn(); });
        } catch {
          // mantém estado vazio em erro de rede
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => { cancelled = true; };
    }, [profile]),
  );

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
    if (!profile) return;
    setRefreshing(true);
    try {
      await loadData(profile.user_id);
    } catch {
      // mantém dados atuais
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    clear();
  }

  const totalPages = sessions.reduce((sum, s) => sum + s.pages_read, 0);
  const booksFinished = studentBooks.filter((b) => b.status === 'finished').length;
  const earnedCount = studentBadges.length;
  const totalSession = sessions.reduce((s, v) => s + v.pages_read, 0);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  const initial = profile?.display_name?.charAt(0).toUpperCase() ?? '?';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.green} />
        }
      >
        {/* Header com avatar + stats */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            marginBottom: 18,
          }}>
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 22,
              backgroundColor: colors.purple,
              borderBottomWidth: 6,
              borderBottomColor: colors.purpleDeep,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{
                fontFamily: fonts.black,
                fontSize: 26,
                color: '#fff',
              }}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{
                fontFamily: fonts.black,
                fontSize: 22,
                color: colors.text,
                letterSpacing: -0.3,
              }}>{profile?.display_name ?? 'Leitor'}</Text>
              <Text style={{
                fontFamily: fonts.semi,
                fontSize: 12,
                color: colors.textMute,
                marginTop: 2,
              }}>Leitor BeReading</Text>
            </View>
            <Pressable
              onPress={handleLogout}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.hairline,
              }}
            >
              <Text style={{
                fontFamily: fonts.bold,
                fontSize: 13,
                color: colors.textSoft,
              }}>Sair</Text>
            </Pressable>
          </View>

          {/* Streak banner */}
          <Card style={{
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}>
            <LottieSlot
              name="flame-streak"
              size={48}
              fallback={<Flame size={48} color={colors.flame} fill={colors.flame} strokeWidth={2} />}
            />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={{
                  fontFamily: fonts.black,
                  fontSize: 32,
                  color: colors.flame,
                  letterSpacing: -1,
                }}>{streak?.current_streak ?? 0}</Text>
                <Text style={{
                  fontFamily: fonts.bold,
                  fontSize: 14,
                  color: colors.text,
                }}>dias em chama</Text>
              </View>
              {(streak?.longest_streak ?? 0) > 0 && (
                <Text style={{
                  fontFamily: fonts.semi,
                  fontSize: 11,
                  color: colors.textMute,
                  marginTop: 2,
                }}>recorde pessoal: {streak?.longest_streak} dias</Text>
              )}
            </View>
          </Card>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 20 }}>
          {/* Heroic stats */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <HeroicStat value={totalPages} label="páginas" Icon={BookOpen} color={colors.green} />
            <HeroicStat value={booksFinished} label="livros" Icon={Trophy} color={colors.gold} />
            <HeroicStat value={earnedCount} label="badges" Icon={Award} color={colors.purple} />
          </View>

          {/* Reading chart */}
          <Card style={{ padding: 16 }}>
            <SectionLabel
              right={
                <Text style={{
                  fontFamily: fonts.black,
                  fontSize: 11,
                  color: colors.green,
                }}>{totalSession} pág.</Text>
              }
            >
              Últimos 14 dias
            </SectionLabel>
            <PagesChart sessions={sessions} />
          </Card>

          {/* Badges */}
          <Card style={{ padding: 16 }}>
            <SectionLabel
              right={
                <Text style={{
                  fontFamily: fonts.black,
                  fontSize: 11,
                  color: colors.textMute,
                }}>{earnedCount}/{allBadges.length}</Text>
              }
            >
              Conquistas
            </SectionLabel>
            {allBadges.length === 0 ? (
              <Text style={{
                fontFamily: fonts.medium,
                fontSize: 13,
                color: colors.textMute,
                textAlign: 'center',
                paddingVertical: 12,
              }}>Nenhuma conquista disponível ainda</Text>
            ) : (
              <BadgeGrid allBadges={allBadges} earnedBadges={studentBadges} />
            )}
          </Card>

          {!profile?.classroom_id && (
            <Press3DButton onPress={() => setShowGateModal(true)} color="gold">
              Entrar em uma turma
            </Press3DButton>
          )}

          <ClassroomGateModal
            visible={showGateModal}
            onDismiss={() => setShowGateModal(false)}
            onSuccess={() => setShowGateModal(false)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function HeroicStat({
  value,
  label,
  Icon,
  color,
}: {
  value: number;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  color: string;
}) {
  return (
    <View style={{
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 8,
      backgroundColor: colors.bgRaise,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.hairline,
      alignItems: 'center',
      gap: 4,
    }}>
      <Icon size={18} color={color} strokeWidth={2.2} />
      <Text style={{
        fontFamily: fonts.black,
        fontSize: 22,
        color: colors.text,
        letterSpacing: -0.5,
      }}>{value}</Text>
      <Text style={{
        fontFamily: fonts.bold,
        fontSize: 10,
        color: colors.textMute,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}>{label}</Text>
    </View>
  );
}
