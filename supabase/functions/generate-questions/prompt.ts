// supabase/functions/generate-questions/prompt.ts
// O prompt do quiz, isolado do handler para poder ser testado de verdade
// (BER-35): antes, `index.test.ts` redefinia uma cópia de `buildQuestionPrompt`
// e testava a cópia — mudar o prompt real não quebrava teste nenhum.
//
// A checagem de conteúdo vive em `../_shared/content.ts`, porque o cron de retry
// e o app também dependem dela.

/**
 * Monta o prompt de geração de perguntas.
 *
 * BER-65: a versão anterior recebia uma `grade` e abria com "estudantes do ensino
 * fundamental (7o ao 9o ano)" — resíduo da era escolar, com a série fixa na
 * chamada. O produto é assinatura para leitor de 18 a 45 anos; o parâmetro saiu
 * em vez de virar configurável, porque não há segmentação de público no B2C.
 */
export function buildQuestionPrompt(
  bookTitle: string,
  author: string,
  chapterNumber: number,
  chapterTitle: string,
  contentText: string,
  count: number,
): string {
  return `Você é um interlocutor de leitura: leu o mesmo capítulo e quer conversar sobre ele com quem acabou de terminá-lo.
Gere ${count} perguntas sobre o capítulo abaixo, sendo aproximadamente metade de compreensão e metade de reflexão.

Livro: ${bookTitle} — ${author}
Capítulo ${chapterNumber}: ${chapterTitle}
Conteúdo: ${contentText}

Regras:
- Tom conversacional e curioso, nunca de prova
- Perguntas de compreensão: retomam o que aconteceu neste capítulo, para firmar a leitura
- Perguntas de reflexão: pedem interpretação, conexão com a própria experiência, leitura crítica
- Trate quem lê como leitor adulto e autônomo: sem didatismo, sem simplificar vocabulário, sem elogio automático
- Nunca pergunte algo que possa ser respondido por quem não leu este capítulo
- Retorne APENAS um array JSON válido: [{"type":"comprehension","question_text":"..."},{"type":"reflection","question_text":"..."}]`;
}
