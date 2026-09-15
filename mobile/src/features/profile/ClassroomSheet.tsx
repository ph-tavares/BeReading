// Entrar em uma turma (spec 7.9): o ClassroomGateModal virou Sheet do sistema,
// com a mesma funcionalidade (codigo de 8, joinClassroom, setProfile). O erro
// aparece no campo, no lugar do Alert.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { joinClassroom } from '../../api/queries';
import { validateClassroomCode } from '../../utils/validation';
import { Button, Field, Sheet, Text } from '../../ui';
import { space } from '../../theme/tokens';
import type { Profile } from '../../types/database';

const CODE_LENGTH = 8;

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: (profile: Profile) => void;
}

export function ClassroomSheet({ visible, onDismiss, onSuccess }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { session, setProfile } = useAuthStore();

  const completo = code.length === CODE_LENGTH;

  function fechar() {
    if (loading) return;
    setErro(null);
    onDismiss();
  }

  async function handleJoin() {
    if (!session || loading) return;
    const invalido = validateClassroomCode(code);
    if (invalido) {
      setErro(invalido);
      return;
    }
    setLoading(true);
    try {
      const atualizado = await joinClassroom(session.user.id, code);
      setProfile(atualizado);
      setCode('');
      setErro(null);
      onSuccess(atualizado);
    } catch (e: unknown) {
      setErro(e instanceof Error && e.message ? e.message : 'Não deu pra entrar na turma. Tenta de novo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet visible={visible} onDismiss={fechar} accessibilityLabel="Entrar em uma turma">
      <View style={styles.corpo}>
        <Text variant="heading">Entrar em uma turma</Text>
        <Text variant="callout" tone="secondary">Peça o código de 8 caracteres pro seu professor.</Text>
        <Field
          label="Código da turma"
          value={code}
          onChangeText={(t) => { setCode(t.toUpperCase().slice(0, CODE_LENGTH)); setErro(null); }}
          placeholder="XXXXXXXX"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={CODE_LENGTH}
          returnKeyType="done"
          onSubmitEditing={() => { if (completo) handleJoin(); }}
          error={erro ?? undefined}
          hint={`${code.length} de ${CODE_LENGTH}`}
        />
        <Button onPress={handleJoin} loading={loading} disabled={!completo}>Entrar na turma</Button>
        <Button variant="ghost" onPress={fechar}>Cancelar</Button>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  corpo: { gap: space.sm },
});
