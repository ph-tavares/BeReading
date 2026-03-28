import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { getClassroomByCode, createStudent } from '../../src/api/queries';
import { validateClassroomCode } from '../../src/utils/validation';

const CODE_LENGTH = 8;

export default function ClassroomCodeScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { session, setStudent, setClassroom } = useAuthStore();

  const isComplete = code.length === CODE_LENGTH;

  function handleChangeText(text: string) {
    setCode(text.toUpperCase().slice(0, CODE_LENGTH));
  }

  async function handleJoin() {
    const validationError = validateClassroomCode(code);
    if (validationError) {
      Alert.alert('Código inválido', validationError);
      return;
    }

    setLoading(true);
    try {
      const classroom = await getClassroomByCode(code);
      if (!classroom) {
        Alert.alert('Turma não encontrada', 'Verifique o código com seu professor e tente novamente.');
        return;
      }

      const displayName = session!.user.user_metadata?.display_name ?? 'Aluno';
      const student = await createStudent(session!.user.id, classroom.id, displayName);

      setClassroom(classroom);
      setStudent(student);
      // Root layout detecta student != null e navega automaticamente para (tabs)
    } catch (e: any) {
      Alert.alert('Erro ao entrar na turma', e.message ?? 'Tente novamente');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Ícone decorativo */}
        <View style={styles.iconWrap}>
          <View style={styles.iconOuter}>
            <View style={styles.iconInner} />
          </View>
        </View>

        {/* Cabeçalho */}
        <Text style={styles.title}>Código da turma</Text>
        <View style={styles.accentLine} />
        <Text style={styles.subtitle}>
          Peça o código de 8 caracteres ao seu professor para entrar na turma
        </Text>

        {/* Campo de código */}
        <View style={styles.inputWrap}>
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
            onSubmitEditing={handleJoin}
            autoFocus
          />

          {/* Indicadores de progresso */}
          <View style={styles.dotsRow}>
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < code.length ? styles.dotFilled : styles.dotEmpty,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Botão */}
        <TouchableOpacity
          style={[styles.button, !isComplete && styles.buttonDim, loading && styles.buttonLoading]}
          onPress={handleJoin}
          disabled={loading || !isComplete}
          activeOpacity={0.82}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Entrando na turma…' : 'Entrar na turma'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },

  // Ícone decorativo (livro estilizado)
  iconWrap: {
    marginBottom: 32,
  },
  iconOuter: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  iconInner: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
  },

  // Cabeçalho
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  accentLine: {
    width: 40,
    height: 3,
    backgroundColor: '#F59E0B',
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },

  // Input de código
  inputWrap: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 36,
  },
  codeInput: {
    width: '100%',
    height: 72,
    backgroundColor: '#FFFBEB',
    borderWidth: 2,
    borderColor: '#FCD34D',
    borderRadius: 16,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 10,
    color: '#92400E',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    paddingHorizontal: 16,
  },
  codeInputComplete: {
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotFilled: {
    backgroundColor: '#F59E0B',
  },
  dotEmpty: {
    backgroundColor: '#E5E7EB',
  },

  // Botão
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonDim: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonLoading: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
