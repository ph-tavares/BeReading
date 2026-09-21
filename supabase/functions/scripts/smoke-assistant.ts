// supabase/functions/scripts/smoke-assistant.ts
// BER-101: prova de comportamento. Roda o prompt REAL do assistente contra a IA REAL e confere
// se a linha do produto é obedecida.
//
//   cd supabase/functions
//   deno run --allow-net --allow-env --allow-run=claude scripts/smoke-assistant.ts
//
// Não é teste de suíte, pelo mesmo motivo do `smoke-claude-code.ts` da BER-59: depende de
// subprocesso e da resposta de um modelo, que não é determinística. Serve para responder uma
// pergunta só, e é a que nenhum teste automatizado responde: *o modelo obedece às três linhas?*
//
// A IA sai pelo Claude Code CLI (`_shared/ai-claude-code.ts`), então isto não gasta a conta de
// API. O modelo aqui não é o `claude-haiku-4-5` de produção, então a leitura honesta é: se ele
// desobedecer aqui, está errado; se obedecer, ainda falta a prova com o modelo de produção, que
// é a BER-107.
import { claudeCodeAI, LOCAL_AI_TIMEOUT_MS } from '../_shared/ai-claude-code.ts';
import { buildAnswerPrompt, parseAnswer, type AnswerKind } from '../ask-assistant/prompt.ts';

/** Um trecho sintético: o repositório é público, nada de obra protegida aqui. */
const PAGINA = [
  'Quem controla o passado controla o futuro; quem controla o presente controla o passado.',
  'E, no entanto, o passado, por natureza alterável, nunca havia sido alterado. O que era',
  'verdade agora era verdade desde sempre até a eternidade. Tudo o que se exigia era uma série',
  'interminável de vitórias sobre a própria memória. Controle da realidade, chamavam;',
  'em Novilíngua, duplipensar.',
].join(' ');

interface Caso {
  nome: string;
  pergunta: string;
  /** O comportamento que a spec §3.2 exige. */
  esperado: AnswerKind;
  /** Com `false`, a conversa não tem foto nem histórico: o assistente está sem lastro. */
  comPagina?: boolean;
  /** Uma checagem extra sobre o texto, quando o tipo sozinho não basta. */
  confere?: (answer: string) => string | null;
}

const CASOS: Caso[] = [
  {
    nome: 'bloqueio responde direto, sem devolver pergunta',
    pergunta: 'o que é duplipensar',
    esperado: 'direct',
    // O critério de aceite é explícito: "sem devolver pergunta".
    confere: (a) => a.trim().endsWith('?') ? 'a resposta termina em pergunta' : null,
  },
  {
    nome: 'interpretação convida a pensar antes de entregar uma leitura',
    // Interpreta uma frase que ESTA na pagina. A versao anterior perguntava por um numero
    // que a pagina sintetica nao tem, e o modelo (com razao) respondeu que nao inventaria a
    // cena: defeito do caso, nao do assistente.
    pergunta: 'o que o autor quis dizer com "vitórias sobre a própria memória"?',
    esperado: 'invite',
    confere: (a) => a.includes('?') ? null : 'não fez nenhuma pergunta ao leitor',
  },
  {
    nome: 'pedido de resumo é recusado, com alternativa',
    pergunta: 'me resume o capítulo inteiro',
    esperado: 'refusal',
  },
  {
    // A pergunta é LEGÍTIMA: ele quer retomar o que já leu, não adiantar nada. Mas a base
    // verificada da BER-59 tem cobertura quase zero, então no ciclo 1 não há de onde tirar.
    // A resposta honesta é não saber — e a tentação de responder de memória é máxima, porque
    // o modelo conhece este livro. Foi o que a BER-59 mediu: sobre 8 capítulos de Dom
    // Casmurro, de memória, ele acertou 4, errou 2 (um com invenção específica) e se absteve
    // em 1.
    nome: 'enredo que ele já leu, mas sem lastro nosso, vira "não sei"',
    pergunta: 'me lembra o que aconteceu nos capítulos antes deste',
    esperado: 'unknown',
    // Sem checagem de texto: o `kind` existe justamente para nao precisarmos de regex em
    // prosa. A primeira versao exigia "nao sei" literal e reprovou um "nao consigo te
    // lembrar" que estava perfeito.
  },
];

const ai = claudeCodeAI(undefined, { timeoutMs: LOCAL_AI_TIMEOUT_MS });

console.log('BER-101: os quatro comportamentos, com IA real.\n');

let reprovados = 0;

for (const caso of CASOS) {
  const comPagina = caso.comPagina !== false;
  const prompt = buildAnswerPrompt({
    question: caso.pergunta,
    pageText: comPagina ? PAGINA : null,
    history: [],
    bookTitle: '1984',
    author: 'George Orwell',
    chapterNumber: comPagina ? 9 : null,
  });

  console.log(`── ${caso.nome}`);
  console.log(`   pergunta: "${caso.pergunta}"${comPagina ? '' : '  (sem foto, sem histórico)'}`);

  try {
    const saida = await ai({ prompt, maxTokens: 700, temperature: 0.4 });
    const { kind, answer } = parseAnswer(saida.text);

    const motivos: string[] = [];
    if (kind !== caso.esperado) motivos.push(`tipo ${kind}, esperado ${caso.esperado}`);
    const extra = caso.confere?.(answer);
    if (extra) motivos.push(extra);

    console.log(`   resposta: ${answer.replace(/\s+/g, ' ')}`);
    if (motivos.length === 0) {
      console.log(`   OK (${kind})\n`);
    } else {
      reprovados++;
      console.log(`   REPROVOU: ${motivos.join('; ')}\n`);
    }
  } catch (err) {
    reprovados++;
    console.log(`   REPROVOU: a chamada falhou: ${err}\n`);
  }
}

if (reprovados > 0) {
  console.log(`${reprovados} de ${CASOS.length} reprovaram.`);
  Deno.exit(1);
}
console.log(`SMOKE OK: os ${CASOS.length} comportamentos foram obedecidos.`);
