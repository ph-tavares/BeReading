import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { joinClassroom } from '../api/queries';
import { validateClassroomCode } from '../utils/validation';
import { Press3DButton } from './Press3DButton';
import { GhostButton } from './GhostButton';
import { colors, fonts, radii } from '../theme/tokens';
import type { Profile } from '../types/database';

const CODE_LENGTH = 8;

interface ClassroomGateModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: (profile: Profile) => void;
}

export function ClassroomGateModal({ visible, onDismiss, onSuccess }: ClassroomGateModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { session, setProfile } = useAuthStore();

  const isComplete = code.length === CODE_LENGTH;

  function handleChangeText(text: string) {
    setCode(text.toUpperCase().slice(0, CODE_LENGTH));
  }

  async function handleJoin() {
    if (!session) return;

    const validationError = validateClassroomCode(code);
    if (validationError) {
      Alert.alert('Código inválido', validationError);
      return;
    }

    setLoading(true);
    try {
      const updated = await joinClassroom(session.user.id, code);
      setProfile(updated);
      onSuccess(updated);
      setCode('');
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          onPress={onDismiss}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' }}
        />
        <View style={{
          backgroundColor: colors.bgRaise,
          borderTopLeftRadius: radii.lg,
          borderTopRightRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.hairline,
          paddingHorizontal: 24,
          paddingTop: 18,
          paddingBottom: 36,
          alignItems: 'center',
        }}>
          <View style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.surface,
            marginBottom: 20,
          }} />

          <Text style={{
            fontFamily: fonts.black,
            fontSize: 22,
            color: colors.text,
            letterSpacing: -0.3,
            textAlign: 'center',
            marginBottom: 6,
          }}>Entrar em uma turma</Text>
          <Text style={{
            fontFamily: fonts.medium,
            fontSize: 13,
            color: colors.textMute,
            textAlign: 'center',
            marginBottom: 22,
          }}>
            Peça o código de 8 caracteres ao seu professor
          </Text>

          <TextInput
            value={code}
            onChangeText={handleChangeText}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={CODE_LENGTH}
            placeholder="XXXXXXXX"
            placeholderTextColor={colors.textDim}
            returnKeyType="done"
            onSubmitEditing={() => { if (isComplete) handleJoin(); }}
            autoFocus
            style={{
              width: '100%',
              height: 64,
              backgroundColor: colors.bgSunk,
              borderWidth: 2,
              borderColor: isComplete ? colors.gold : colors.hairline,
              borderRadius: radii.md,
              textAlign: 'center',
              fontSize: 26,
              fontFamily: fonts.black,
              letterSpacing: 10,
              color: colors.gold,
              paddingHorizontal: 16,
            }}
          />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 22 }}>
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i < code.length ? colors.gold : colors.surface,
                }}
              />
            ))}
          </View>

          <Press3DButton
            onPress={handleJoin}
            disabled={loading || !isComplete}
            size="md"
            color="gold"
          >
            {loading ? 'Entrando…' : 'Entrar na turma'}
          </Press3DButton>

          <View style={{ marginTop: 12, width: '100%' }}>
            <GhostButton onPress={onDismiss}>Cancelar</GhostButton>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
