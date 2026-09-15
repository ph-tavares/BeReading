// Quiz em conversa (spec 7.5, F5 Tarefa 3). Substitui o QuizQuestionScreen na
// rota com as mesmas entradas: a rota do time continua dona do estado (cota,
// resposta imutavel, polling), e esta tela so conta a conversa.
import { useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { Button, Screen } from '../../ui';
import { space } from '../../theme/tokens';
import type { Question } from '../../types/database';
import type { QuestionResult } from '../../utils/quizUtils';
import { ChatBubble } from './ChatBubble';
import { Composer } from './Composer';
import { buildConversation } from './logic';

interface Props {
  questions: Pick<Question, 'type' | 'question_text'>[];
  currentIndex: number;
  results: Record<number, QuestionResult>;
  answerTexts: Record<number, string>;
  answer: string;
  onChangeAnswer: (text: string) => void;
  evaluating: boolean;
  onSubmit: () => void;
  onNext: () => void;
  onBack: () => void;
}

export function QuizConversation({
  questions, currentIndex, results, answerTexts, answer, onChangeAnswer, evaluating, onSubmit, onNext, onBack,
}: Props) {
  const rolagem = useRef<ScrollView>(null);
  const mensagens = buildConversation({
    questions, results, answerTexts, currentIndex, evaluating, pendingAnswer: answer,
  });
  const respondida = currentIndex in results;
  const ultima = currentIndex === questions.length - 1;

  return (
    <Screen
      scroll={false}
      edges={['top', 'bottom']}
      onBack={onBack}
      title="Quiz"
      subtitle={`Pergunta ${currentIndex + 1} de ${questions.length}`}
      contentStyle={styles.flex}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={rolagem}
          style={styles.flex}
          contentContainerStyle={styles.lista}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          // A mensagem nova entra embaixo: a conversa acompanha, e o teclado
          // nunca cobre o que acabou de chegar.
          onContentSizeChange={() => rolagem.current?.scrollToEnd({ animated: true })}
        >
          {mensagens.map((m) => (
            <ChatBubble key={m.id} message={m} />
          ))}
        </ScrollView>
        <View style={styles.rodape}>
          {respondida ? (
            <Button icon={ArrowRight} onPress={onNext}>{ultima ? 'Ver resumo' : 'Próxima'}</Button>
          ) : (
            <Composer value={answer} onChangeText={onChangeAnswer} onSend={onSubmit} sending={evaluating} />
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lista: { gap: space.md, paddingVertical: space.lg },
  rodape: { paddingTop: space.md, paddingBottom: space.md },
});
