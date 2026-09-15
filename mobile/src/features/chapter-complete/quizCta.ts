// O que a tela de capitulo fechado oferece depois da conquista (BER-58). Logica
// pura, sem React: o quiz, o convite ao Premium quando a cota do mes acabou, ou
// nada quando nao ha capitulo pra abrir.
//
// Antes, o Alert.alert do registro de leitura fazia essa troca ("Responder
// agora" virava "Conhecer o Premium"). O Alert saiu na F4, e a regra veio pra ca.
import { paywallCopy, quizQuotaFor, type Entitlement } from '../../utils/billing';

export type QuizCta =
  | { kind: 'quiz'; chapterId: string }
  | { kind: 'premium'; line: string }
  | { kind: 'none' };

/**
 * Quem decide a cota e o servidor (`evaluate-answer` responde 402); aqui so se
 * antecipa a resposta dele com `quizQuotaFor`, a mesma regra que o time usa no
 * resto do app. Sem plano carregado, o quiz abre: a tela do quiz tem o estado
 * de cota como rede, e travar o leitor por falha de rede seria pior.
 */
export function quizCta(chapterId: string | null, entitlement: Entitlement | null): QuizCta {
  if (!chapterId) return { kind: 'none' };
  const bloqueio = entitlement ? quizQuotaFor(entitlement, chapterId) : null;
  if (!bloqueio) return { kind: 'quiz', chapterId };
  const convite = paywallCopy(bloqueio);
  return { kind: 'premium', line: convite.hint ? `${convite.title}. ${convite.hint}` : `${convite.title}.` };
}
