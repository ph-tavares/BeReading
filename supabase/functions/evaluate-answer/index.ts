// supabase/functions/evaluate-answer/index.ts
import { createServiceClient } from '../_shared/supabase-client.ts';
import type { AnswerPayload } from '../_shared/types.ts';

function buildEvaluationPrompt(
  questionText: string,
  questionType: 'comprehension' | 'reflection',
  answerText: string,
  chapterContent: string
): string {
  const typeInstruction = questionType === 'comprehension'
    ? 'Esta é uma pergunta de COMPREENSÃO. Avalie se a resposta demonstra conhecimento correto do conteúdo do capítulo.'
    : 'Esta é uma pergunta de REFLEXÃO. Avalie a profundidade e coerência da reflexão. Não há resposta certa ou errada — avalie se o aluno engajou de verdade com a pergunta.';

  return `Você é um avaliador de leitura para estudantes do ensino fundamental.

Pergunta: ${questionText}
${typeInstruction}

Conteúdo do capítulo (contexto): ${chapterContent.substring(0, 2000)}

Resposta do aluno: ${answerText}

Retorne APENAS um JSON válido:
{"score": <0-100>, "feedback": "<1-2 frases encorajadoras em português>"}

Score 0-100 onde:
- 80-100: excelente, demonstra compreensão/reflexão profunda
- 60-79: boa resposta, com algumas lacunas
- 40-59: resposta parcial
- 0-39: muito superficial ou fora do contexto`;
}

function parseEvaluationJson(raw: string): { score: number; feedback: string } {
  const match = raw.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error('No JSON found in response');
  const parsed = JSON.parse(match[0]);
  if (typeof parsed.score !== 'number' || typeof parsed.feedback !== 'string') {
    throw new Error('Invalid evaluation format');
  }
  return {
    score: Math.min(100, Math.max(0, parsed.score)),
    feedback: parsed.feedback,
  };
}

// ---------------------------------------------------------------------------
// AI PROVIDER — OpenAI (gpt-4o-mini)
// Env vars required: AI_API_KEY (OpenAI key), AI_MODEL (default: gpt-4o-mini)
// ---------------------------------------------------------------------------
async function callAI(prompt: string): Promise<string> {
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

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: AnswerPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { question_id, user_id, answer_text } = payload;

  if (!question_id || !user_id || !answer_text?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServiceClient();

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
  const prompt = buildEvaluationPrompt(
    question.question_text,
    question.type as 'comprehension' | 'reflection',
    answer_text.trim(),
    chapterContent
  );

  try {
    const rawResponse = await callAI(prompt);
    const evaluation = parseEvaluationJson(rawResponse);

    const { error: updateError } = await supabase
      .from('answers')
      .update({
        comprehension_score: evaluation.score,
        ai_feedback: evaluation.feedback,
        evaluated_at: new Date().toISOString(),
        evaluation_status: 'completed',
      })
      .eq('id', savedAnswer.id);

    if (updateError) {
      console.error('Failed to update answer with evaluation:', updateError.message);
    }

    return new Response(JSON.stringify({
      data: { score: evaluation.score, feedback: evaluation.feedback },
      error: null,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch {
    // Marcar como falha — pode ser retentado
    await supabase
      .from('answers')
      .update({ evaluation_status: 'failed' })
      .eq('id', savedAnswer.id);

    return new Response(JSON.stringify({
      data: {
        score: null,
        feedback: 'Resposta recebida! A avaliação ficará disponível em breve.',
      },
      error: null,
    }), { headers: { 'Content-Type': 'application/json' } });
  }
});
