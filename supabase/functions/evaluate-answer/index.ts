// supabase/functions/evaluate-answer/index.ts
import { createServiceClient } from '../_shared/supabase-client.ts';
import { authErrorResponse, isServiceRole, resolveUserId } from '../_shared/auth.ts';
import { parseEvaluation, type ParsedEvaluation } from '../_shared/ai-json.ts';
import type { AnswerPayload } from '../_shared/types.ts';
// BER-35: o prompt vive em módulo próprio para ser testado de verdade.
// BER-65: sem "aluno" e sem "ensino fundamental" — o leitor é adulto.
import { buildEvaluationPrompt } from './prompt.ts';

// ---------------------------------------------------------------------------
// AI PROVIDER — OpenAI (default) or Anthropic/Claude (set AI_PROVIDER=anthropic)
// Env: AI_PROVIDER (openai|anthropic)
//   OpenAI    -> AI_API_KEY, AI_MODEL (default gpt-4o-mini)
//   Anthropic -> ANTHROPIC_API_KEY, ANTHROPIC_MODEL (default claude-haiku-4-5)
// ---------------------------------------------------------------------------
async function callAI(prompt: string): Promise<string> {
  const provider = Deno.env.get('AI_PROVIDER') ?? 'openai';

  if (provider === 'anthropic') {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5';
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY env var not set');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  }

  const apiKey = Deno.env.get('AI_API_KEY');
  const model = Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini';
  if (!apiKey) throw new Error('AI_API_KEY env var not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

type SupabaseClient = ReturnType<typeof createServiceClient>;

/**
 * Avalia uma resposta já gravada e persiste o resultado.
 *
 * Usada pelos dois caminhos: o do app (logo depois de salvar a resposta) e o do
 * cron (BER-36, re-avaliando o que ficou sem nota). Falha aqui nunca é fatal para
 * quem chamou — a linha fica `failed`, e é justamente isso que o retry procura.
 */
async function evaluateAndStore(
  supabase: SupabaseClient,
  answerId: string,
  questionText: string,
  questionType: 'comprehension' | 'reflection',
  answerText: string,
  chapterContent: string,
  // BER-42: `score` pode ser null — a IA respondeu, mas não conseguiu pontuar.
  // Isso NÃO é nota zero e não é falha de avaliação: a linha vai para `completed`
  // com score nulo, e a tela mostra "avaliação em processamento".
): Promise<ParsedEvaluation | null> {
  const prompt = buildEvaluationPrompt(questionText, questionType, answerText, chapterContent);

  try {
    const evaluation = parseEvaluation(await callAI(prompt));

    const { error: updateError } = await supabase
      .from('answers')
      .update({
        comprehension_score: evaluation.score,
        ai_feedback: evaluation.feedback,
        evaluated_at: new Date().toISOString(),
        evaluation_status: 'completed',
      })
      .eq('id', answerId);

    if (updateError) {
      console.error('Failed to update answer with evaluation:', updateError.message);
    }

    return evaluation;
  } catch (err) {
    console.error(`[evaluate-answer] avaliação falhou para a resposta ${answerId}:`, err);
    // Marcar como falha — o cron de retry volta aqui depois (BER-36).
    await supabase
      .from('answers')
      .update({ evaluation_status: 'failed' })
      .eq('id', answerId);
    return null;
  }
}

/**
 * Caminho interno (BER-36): o cron manda `answer_id` de uma resposta que ficou
 * sem nota, e a avaliação é refeita sobre a linha que já existe.
 *
 * Não há `user_id` envolvido: nada é criado nem sobrescrito, só a avaliação de
 * uma resposta que o próprio dono já gravou. O IDOR da BER-30 continua fechado
 * porque este caminho exige a service_role key, que o app não tem.
 */
async function handleReevaluation(supabase: SupabaseClient, answerId: unknown): Promise<Response> {
  if (typeof answerId !== 'string' || !answerId) {
    return new Response(JSON.stringify({ error: 'answer_id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: answer } = await supabase
    .from('answers')
    .select('id, answer_text, evaluation_status, questions(question_text, type, chapters(book_contents(content_text)))')
    .eq('id', answerId)
    .single();

  if (!answer) {
    return new Response(JSON.stringify({ error: 'Answer not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Corrida com o app: se alguém já avaliou entre a varredura e agora, não
  // gastar IA de novo.
  if (answer.evaluation_status === 'completed') {
    return new Response(JSON.stringify({ data: { status: 'already-evaluated' }, error: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const question = (answer.questions as any);
  const chapterContent = question?.chapters?.book_contents?.content_text ?? '';

  const evaluation = await evaluateAndStore(
    supabase,
    answer.id,
    question?.question_text ?? '',
    (question?.type as 'comprehension' | 'reflection') ?? 'comprehension',
    answer.answer_text,
    chapterContent,
  );

  return new Response(JSON.stringify({
    data: { status: evaluation ? 'evaluated' : 'failed' },
    error: null,
  }), {
    status: evaluation ? 200 : 502,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: AnswerPayload & { answer_id?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { question_id, user_id: bodyUserId, answer_text } = payload;

  if (!question_id || !answer_text?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServiceClient();

  // BER-36: chamada do cron para re-avaliar uma resposta que ficou sem nota.
  // Só entra aqui quem apresenta a service_role key; para o app, nada muda.
  if (isServiceRole(req.headers.get('Authorization'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))) {
    return await handleReevaluation(supabase, payload.answer_id);
  }

  // BER-30: sem isto, o upsert em (question_id, user_id) abaixo sobrescreve a
  // resposta de qualquer aluno cujo id o chamador conheça.
  let user_id: string;
  try {
    user_id = await resolveUserId(
      req.headers.get('Authorization'),
      bodyUserId,
      (token) => supabase.auth.getUser(token),
    );
  } catch (err) {
    return authErrorResponse(err);
  }

  // Buscar pergunta + conteúdo do capítulo
  const { data: question } = await supabase
    .from('questions')
    .select('question_text, type, chapter_id, chapters(book_contents(content_text))')
    .eq('id', question_id)
    .single();

  if (!question) {
    return new Response(JSON.stringify({ error: 'Question not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Salvar resposta imediatamente com evaluation_status = 'pending'
  const { data: savedAnswer, error: answerError } = await supabase
    .from('answers')
    .upsert({
      question_id,
      user_id,
      answer_text: answer_text.trim(),
      evaluation_status: 'pending',
    }, { onConflict: 'question_id,user_id' })
    .select('id')
    .single();

  if (answerError || !savedAnswer) {
    return new Response(JSON.stringify({ error: 'Failed to save answer' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const chapterContent = (question.chapters as any)?.book_contents?.content_text ?? '';

  const evaluation = await evaluateAndStore(
    supabase,
    savedAnswer.id,
    question.question_text,
    question.type as 'comprehension' | 'reflection',
    answer_text.trim(),
    chapterContent,
  );

  if (evaluation) {
    return new Response(JSON.stringify({
      data: { score: evaluation.score, feedback: evaluation.feedback },
      error: null,
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // A resposta está salva e marcada como `failed`; o cron volta nela (BER-36).
  // BER-42: score null não é nota zero — a tela mostra "avaliação em processamento".
  return new Response(JSON.stringify({
    data: {
      score: null,
      feedback: 'Resposta recebida! A avaliação ficará disponível em breve.',
    },
    error: null,
  }), { headers: { 'Content-Type': 'application/json' } });
});
