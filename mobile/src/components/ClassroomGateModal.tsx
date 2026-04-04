import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { joinClassroom } from '../api/queries';
import { validateClassroomCode } from '../utils/validation';
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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={onDismiss} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>Entrar em uma turma</Text>
          <View style={styles.accentLine} />
          <Text style={styles.subtitle}>
            Peça o código de 8 caracteres ao seu professor
          </Text>

          <TextInput
            style={[styles.codeInput, isComplete && styles.codeInputComplete]}
            value={code}
            onChangeText={handleChangeText}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={CODE_LENGTH}
            placeholder="XXXXXXXX"
            placeholderTextColor="#C8A84B"
            keyboardType="default"
            returnKeyType="done"
            onSubmitEditing={() => { if (isComplete) handleJoin(); }}
            autoFocus
          />

          <View style={styles.dotsRow}>
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i < code.length ? styles.dotFilled : styles.dotEmpty]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, !isComplete && styles.buttonDim, loading && styles.buttonLoading]}
            onPress={handleJoin}
            disabled={loading || !isComplete}
            activeOpacity={0.82}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Entrando…' : 'Entrar na turma'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  accentLine: {
    width: 32,
    height: 3,
    backgroundColor: '#F59E0B',
    borderRadius: 2,
    marginTop: 6,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  codeInput: {
    width: '100%',
    height: 64,
    backgroundColor: '#FFFBEB',
    borderWidth: 2,
    borderColor: '#FCD34D',
    borderRadius: 14,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 10,
    color: '#92400E',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    paddingHorizontal: 16,
  },
  codeInputComplete: {
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 28,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotFilled: { backgroundColor: '#F59E0B' },
  dotEmpty: { backgroundColor: '#E5E7EB' },
  button: {
    width: '100%',
    height: 52,
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 12,
  },
  buttonDim: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
  buttonLoading: { opacity: 0.65 },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 15,
    color: '#9CA3AF',
  },
});
