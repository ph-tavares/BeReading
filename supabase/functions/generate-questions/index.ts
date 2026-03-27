// supabase/functions/generate-questions/index.ts
import { createServiceClient } from '../_shared/supabase-client.ts';

const QUESTION_COUNT = 4;

function buildQuestionPrompt(
  bookTitle: string, author: string, chapterNumber: number,
  chapterTitle: string, contentText: string, grade: string, count: number
): string {
  return `Você é um companheiro de leitura para estudantes do ensino fundamental (${grade}).
Gere ${count} perguntas sobre o capítulo abaixo, sendo aproximadamente metade de compreensão e metade de reflexão.

Livro: ${bookTitle} — ${author}
Capítulo ${chapterNumber}: ${chapterTitle}
Conteúdo: ${contentText}

Regras:
- Tom conversacional e curioso, nunca de prova
- Perguntas de compreensão: verificam se o aluno leu e entendeu o que aconteceu
- Perguntas de reflexão: pedem opinião, conexão pessoal, pensamento crítico
- Linguagem adequada para ${grade}
- Retorne APENAS um array JSON válido: [{"type":"comprehension","question_text":"..."},{"type":"reflection","question_text":"..."}]`;
}

function parseQuestionsJson(raw: string): { type: string; question_text: string }[] {
  const match = raw.match(/\[[\s\S]*?\]/);
  if (!match) throw new Error('No JSON array found in LLM response');
  return JSON.parse(match[0]);
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
      max_tokens: 1024,
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

  let chapter_id: string;
  try {
    const body = await req.json();
    chapter_id = body.chapter_id;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!chapter_id) {
    return new Response(JSON.stringify({ error: 'chapter_id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServiceClient();

  // Verificar cache — se já existem perguntas, retornar
  const { data: existingQuestions } = await supabase
    .from('questions')
    .select('id')
    .eq('chapter_id', chapter_id)
    .limit(1);

  if (existingQuestions && existingQuestions.length > 0) {
    return new Response(JSON.stringify({ data: { cached: true }, error: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Incrementar tentativas no status
  const { data: currentStatus } = await supabase
    .from('chapter_quiz_status')
    .select('attempts')
    .eq('chapter_id', chapter_id)
    .single();

  const attempts = (currentStatus?.attempts ?? 0) + 1;

  await supabase.from('chapter_quiz_status').upsert({
    chapter_id,
    status: 'pending',
    attempts,
    last_attempt_at: new Date().toISOString(),
  }, { onConflict: 'chapter_id' });

  // Buscar dados do capítulo e livro
  const { data: chapter } = await supabase
    .from('chapters')
    .select('number, title, book_id, book_contents(content_text), books(title, author)')
    .eq('id', chapter_id)
    .single();

  if (!chapter) {
    return new Response(JSON.stringify({ error: 'Chapter not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const contentText = (chapter.book_contents as any)?.content_text ?? '';
  const bookTitle = (chapter.books as any)?.title ?? '';
  const author = (chapter.books as any)?.author ?? '';

  const prompt = buildQuestionPrompt(
    bookTitle, author, chapter.number,
    chapter.title ?? `Capítulo ${chapter.number}`,
    contentText, '7o ao 9o ano', QUESTION_COUNT
  );

  try {
    const rawResponse = await callAI(prompt);
    const questions = parseQuestionsJson(rawResponse);

    // Salvar perguntas (cache por capítulo — sem student_id)
    const { error: insertError } = await supabase.from('questions').insert(
      questions.map(q => ({
        chapter_id,
        type: q.type,
        question_text: q.question_text,
      }))
    );

    if (insertError) {
      throw new Error(`Failed to insert questions: ${insertError.message}`);
    }

    // Marcar como gerado
    await supabase.from('chapter_quiz_status').upsert({
      chapter_id,
      status: 'generated',
      attempts,
      last_attempt_at: new Date().toISOString(),
    }, { onConflict: 'chapter_id' });

    return new Response(JSON.stringify({
      data: { questions_generated: questions.length },
      error: null,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    // Marcar como falha para retry via pg_cron
    await supabase.from('chapter_quiz_status').upsert({
      chapter_id,
      status: 'failed',
      attempts,
      error_message: String(err),
      last_attempt_at: new Date().toISOString(),
    }, { onConflict: 'chapter_id' });

    return new Response(JSON.stringify({ error: 'AI generation failed, will retry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
