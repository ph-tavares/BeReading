// supabase/functions/_shared/ingestion/steps/publish.ts
// Passo `publish` (BER-59, spec §7): fecha o run. `succeeded` só com todo capítulo
// confirmado e sem limite atingido; `partial` e `failed` avisam a operação. A diferença entre
// a estrutura confirmada e a que o app usa vai para o run: é o insumo da reconciliação do
// piloto no próximo ciclo (spec §9).
import { normalizeTitle } from '../locate.ts';
import type { EditionChapter, RunStatus } from '../types.ts';
import type { StepExecutor } from './context.ts';

export function structureDivergence(
  app: { number: number; title: string | null }[],
  confirmed: EditionChapter[],
): { capitulos_no_app: number; capitulos_confirmados: number; titulos_diferentes: number[] } | null {
  const differing = confirmed
    .filter((c) => {
      const inApp = app.find((a) => a.number === c.number);
      const appTitle = normalizeTitle(inApp?.title ?? null);
      const confirmedTitle = normalizeTitle(c.title);
      return appTitle !== '' && confirmedTitle !== '' && appTitle !== confirmedTitle;
    })
    .map((c) => c.number);
  if (app.length === confirmed.length && differing.length === 0) return null;
  return { capitulos_no_app: app.length, capitulos_confirmados: confirmed.length, titulos_diferentes: differing };
}

export const runPublishStep: StepExecutor = async (_step, run, ctx) => {
  const edition = await ctx.store.getEdition(run.editionId);

  const finish = async (status: RunStatus, reason: string | null, divergence: unknown = null) => {
    await ctx.store.updateRun(run.id, {
      status,
      statusReason: reason,
      finishedAt: new Date(ctx.now()).toISOString(),
      structureDivergence: divergence,
    });
    if (status !== 'succeeded') {
      await ctx.notify('ingestion', `run ${run.id} (ISBN ${edition.isbn}) terminou ${status}${reason ? `: ${reason}` : ''}`);
    }
    return { payload: { status, motivo: reason } };
  };

  if (!edition.title) return finish('failed', 'edicao_nao_encontrada');

  const recheck = run.payload.recheckChapters;
  const accepted = (await ctx.store.listSources(run.id)).filter((s) => s.decision === 'accepted');
  if (accepted.length === 0 && !recheck) return finish('failed', 'nenhuma_fonte_aceita');

  const chapters = await ctx.store.listEditionChapters(edition.id);
  if (chapters.length === 0) return finish('partial', run.statusReason ?? 'estrutura_nao_confirmada');

  const scope = recheck ?? chapters.map((c) => c.number);
  // `recheckChapters: []` não é "todos os capítulos" (vazio faria `Math.max` virar `-Infinity`
  // e o `every` de uma lista vazia confirmaria tudo por vacuidade): sem capítulo no escopo, não há o que confirmar.
  if (scope.length === 0) return finish('partial', run.statusReason ?? 'capitulos_sem_confirmacao');
  const knowledge = (await ctx.store.listKnowledge(edition.id, Math.max(...scope))).filter((k) => scope.includes(k.chapterNumber));
  const allConfirmed = knowledge.length === scope.length && knowledge.every((k) => k.status === 'confirmed');
  const divergence = edition.bookId ? structureDivergence(await ctx.store.listBookChapters(edition.bookId), chapters) : null;

  if (allConfirmed && !run.statusReason) return finish('succeeded', null, divergence);
  return finish('partial', run.statusReason ?? 'capitulos_sem_confirmacao', divergence);
};
