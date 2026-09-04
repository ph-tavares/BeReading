// supabase/functions/evaluate-answer/prompt.ts
// O prompt da devolutiva, isolado do handler para ser testado de verdade (BER-35).
//
// BER-65: a versão anterior abria com "Você é um avaliador de leitura para
// estudantes do ensino fundamental", falava em "resposta do aluno" e pedia
// "frases encorajadoras" — resíduo escolar no texto que o assinante mais lê.
// Para leitor adulto, elogio automático não é gentileza: é ruído que apaga a
// única informação útil da devolutiva.

export type QuestionType = 'comprehension' | 'reflection';

/** Quanto do capítulo entra no contexto da avaliação. */
export const CONTENT_CONTEXT_CHARS = 2000;

export function buildEvaluationPrompt(
  questionText: string,
  questionType: QuestionType,
  answerText: string,
  chapterContent: string,
): string {
  const typeInstruction = questionType === 'comprehension'
    ? 'Esta é uma pergunta de COMPREENSÃO. Avalie se a resposta demonstra conhecimento correto do que aconteceu no capítulo.'
    : 'Esta é uma pergunta de REFLEXÃO. Não há resposta certa: avalie a profundidade e a coerência da leitura, e se quem respondeu de fato se engajou com a pergunta.';

  return `Você é um interlocutor de leitura conversando com um leitor adulto sobre um capítulo que os dois leram.

Pergunta: ${questionText}
${typeInstruction}

Conteúdo do capítulo (contexto): ${chapterContent.substring(0, CONTENT_CONTEXT_CHARS)}

Resposta do leitor: ${answerText}

Retorne APENAS um JSON válido:
{"score": <0-100>, "feedback": "<1-2 frases em português>"}

O feedback deve dizer algo específico sobre esta resposta — o que ela pegou, o que
deixou passar, ou o que vale reler. Sem elogio automático, sem tom de correção de
prova, sem repetir a pergunta.

Score 0-100 onde:
- 80-100: excelente, demonstra compreensão/reflexão profunda
- 60-79: boa resposta, com algumas lacunas
- 40-59: resposta parcial
- 0-39: muito superficial ou fora do contexto`;
}
