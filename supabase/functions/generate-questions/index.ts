// supabase/functions/generate-questions/index.ts
import { createServiceClient } from '../_shared/supabase-client.ts';
import { assertInternalCaller, authErrorResponse } from '../_shared/auth.ts';
import { internalCallerKeys } from '../_shared/keys.ts';
import { parseQuestions } from '../_shared/ai-json.ts';
// BER-35: o prompt vive em módulo próprio para que o teste exercite o código real.
// BER-65: sem `grade` — o público é leitor adulto, não turma do fundamental.
import { buildQuestionPrompt } from './prompt.ts';
import { buildNoContentMessage, hasUsableContent } from '../_shared/content.ts';
import { buildClaimableFilter, isClaimable } from './claim.ts';
import { notifyOps } from '../_shared/ops-alert.ts';
import { callAI } from '../_shared/ai.ts';
import { type ChapterGrounding, groundingSummary, groundingText, loadChapterGrounding } from '../_shared/chapter-grounding.ts';

const QUESTION_COUNT = 4;

/** BER-41: outra chamada está gerando este capítulo agora — não gasta IA de novo. */
function inProgressResponse(): Response {
  return new Response(JSON.stringify({ data: { in_progress: true }, error: null }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  });
}

// BER-55: sem temperature, os dois provedores usam o default de 1.0 — as
// perguntas de um mesmo capítulo variam mais do que precisam. O cache por
// capítulo mitiga o custo de gerar de novo, mas não a qualidade de uma geração
// só. 0.4 mantém formato e tom consistentes sem virar sempre a mesma pergunta.
const QUESTION_TEMPERATURE = 0.4;

// BER-49: exportada para que o teste de handler chame o código real, não uma
// cópia — o mesmo raciocínio da BER-35 para a lógica pura.
export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Função interna (BER-30 / BER-46): chamada por register-reading-session e pelo
  // cron de retry. Endpoint público aqui é abuso de custo de IA por chamada.
  try {
    assertInternalCaller(
      req.headers,
      internalCallerKeys((name) => Deno.env.get(name)),
    );
  } catch (err) {
    return authErrorResponse(err);
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

  // BER-41: reservar o capítulo antes de gastar IA (ver claim.ts).
  // Garante a linha de status sem sobrescrever uma que já exista.
  await supabase.from('chapter_quiz_status').upsert(
    { chapter_id, status: 'pending' },
    { onConflict: 'chapter_id', ignoreDuplicates: true },
  );

  const { data: currentStatus } = await supabase
    .from('chapter_quiz_status')
    .select('status, attempts, last_attempt_at')
    .eq('chapter_id', chapter_id)
    .single();

  const now = Date.now();
  if (!currentStatus || !isClaimable(currentStatus, now)) {
    return inProgressResponse();
  }

  const previousAttempts = currentStatus.attempts ?? 0;
  const attempts = previousAttempts + 1;

  // A reserva em si. Só passa quem ainda vê o mesmo `attempts` e uma tentativa
  // velha (ou nenhuma): duas chamadas simultâneas disputam a mesma linha no
  // Postgres, e a segunda já não encontra a condição.
  const { data: claimed } = await supabase
    .from('chapter_quiz_status')
    .update({ status: 'pending', attempts, last_attempt_at: new Date(now).toISOString() })
    .eq('chapter_id', chapter_id)
    .eq('attempts', previousAttempts)
    .neq('status', 'generated')
    .or(buildClaimableFilter(now))
    .select('chapter_id');

  if (!claimed || claimed.length === 0) {
    return inProgressResponse();
  }

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

  const catalogText = (chapter.book_contents as any)?.content_text ?? '';
  const bookTitle = (chapter.books as any)?.title ?? '';
  const author = (chapter.books as any)?.author ?? '';

  // BER-59: o conhecimento verificado da ingestão entra junto com o texto do catálogo. Falhar
  // aqui nunca derruba o quiz — sem conhecimento, é o comportamento de antes.
  let grounding: ChapterGrounding | null = null;
  try {
    grounding = await loadChapterGrounding(supabase, { bookId: chapter.book_id, number: chapter.number, title: chapter.title });
  } catch (err) {
    console.error(`[generate-questions] conhecimento verificado indisponível para o capítulo ${chapter_id}: ${err}`);
  }
  const contentText = [catalogText.trim(), grounding ? groundingText(grounding) : ''].filter(Boolean).join('\n\n');

  // BER-66: sem conteúdo, o prompt saía com "Conteúdo: " em branco e a IA gerava as
  // 4 perguntas a partir só do título — o capítulo virava `generated`, o custo de IA
  // era gasto e nada era registrado. Falha silenciosa que passa por sucesso.
  // A chamada de IA agora nem acontece.
  // Conhecimento verificado já traz o mínimo próprio (MIN_GROUNDING_FACTS): basta um dos dois.
  if (!hasUsableContent(catalogText) && !grounding) {
    const message = buildNoContentMessage(catalogText);
    console.error(`[generate-questions] ${message} — capítulo ${chapter_id}`);

    await supabase.from('chapter_quiz_status').upsert({
      chapter_id,
      status: 'failed',
      attempts,
      error_message: message,
      last_attempt_at: new Date().toISOString(),
    }, { onConflict: 'chapter_id' });

    return new Response(JSON.stringify({ error: message }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const prompt = buildQuestionPrompt(
    bookTitle, author, chapter.number,
    chapter.title ?? `Capítulo ${chapter.number}`,
    contentText, QUESTION_COUNT
  );

  try {
    const { text: rawResponse } = await callAI({
      prompt,
      maxTokens: 1024,
      temperature: QUESTION_TEMPERATURE,
    });
    // BER-38: uma pergunta com `type` fora do CHECK do banco derrubava o INSERT do
    // lote inteiro — as 4 perdidas e o capítulo marcado como `failed`. Agora as
    // inválidas são descartadas individualmente.
    const { valid: questions, rejected } = parseQuestions(rawResponse);

    if (rejected.length > 0) {
      console.warn(
        `[generate-questions] ${rejected.length} pergunta(s) descartada(s) para o capítulo ${chapter_id}:`,
        rejected.map(r => r.reason).join(' | '),
      );
    }
    if (questions.length === 0) {
      throw new Error('LLM não devolveu nenhuma pergunta válida');
    }

    // BER-41: se a reserva expirou durante a IA e outra chamada já gravou as
    // perguntas, este lote é descartado em vez de duplicar o quiz.
    const { data: alreadyGenerated } = await supabase
      .from('questions')
      .select('id')
      .eq('chapter_id', chapter_id)
      .limit(1);

    if (alreadyGenerated && alreadyGenerated.length > 0) {
      await supabase.from('chapter_quiz_status').upsert({
        chapter_id,
        status: 'generated',
        attempts,
        last_attempt_at: new Date().toISOString(),
      }, { onConflict: 'chapter_id' });

      return new Response(JSON.stringify({ data: { cached: true }, error: null }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    // Marcar como gerado. `grounding` diz ao app de onde veio o conteúdo (BER-59): null quando
    // o quiz saiu só do texto do catálogo.
    await supabase.from('chapter_quiz_status').upsert({
      chapter_id,
      status: 'generated',
      attempts,
      last_attempt_at: new Date().toISOString(),
      grounding: grounding ? groundingSummary(grounding) : null,
    }, { onConflict: 'chapter_id' });

    return new Response(JSON.stringify({
      data: { questions_generated: questions.length },
      error: null,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    // BER-39: antes, esta falha não deixava rastro nenhum além da linha
    // `failed` — nenhum log, nenhum alerta. O retry cobre o sintoma; isto
    // avisa que ele está sendo necessário.
    await notifyOps('generate-questions', `falha ao gerar perguntas para o capítulo ${chapter_id}: ${err}`);

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
}

// BER-49: só sobe o listener quando este arquivo é o entrypoint (deploy real).
// Um teste que importa `handler` não pode abrir uma porta de verdade.
if (import.meta.main) Deno.serve(handler);
