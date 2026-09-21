// supabase/functions/_shared/ingestion/steps/publish.ts
// Passo `publish` (BER-59, spec §7): fecha o run. `succeeded` só com todo capítulo
// confirmado e sem limite atingido; `partial` e `failed` avisam a operação. A diferença entre
// a estrutura confirmada e a que o app usa vai para o run: é o insumo da reconciliação do
// piloto no próximo ciclo (spec §9).
import { type AppSyncReport, syncAppBooks } from '../app-sync.ts';
import { principalLooksTruncated } from '../full-text.ts';
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

  // Rede de segurança (BER-59): o texto bruto da obra não pode sobreviver ao run. Cada passo apaga
  // o seu, mas no run local de 21/09/2026 uma extração que falhou deixou a página guardada. Sobra
  // aqui é defeito em algum passo, por isso avisa a operação.
  const textosDescartados = await ctx.store.deleteSourceTextsForRun(run.id);
  if (textosDescartados > 0) {
    await ctx.notify('ingestion', `run ${run.id}: ${textosDescartados} texto bruto de fonte ainda estava guardado ao fechar e foi apagado`);
  }

  let appSync: AppSyncReport | null = null;
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
    return {
      payload: {
        status, motivo: reason,
        ...(textosDescartados > 0 ? { textos_descartados: textosDescartados } : {}),
        ...(appSync ? { app: appSync } : {}),
      },
    };
  };

  // Conferência das cópias do texto integral (BER-59, spec §11 item 39): a segunda cópia não é
  // extraída, só conta capítulos. Se ela mostra bem mais capítulos que a principal nas mesmas
  // primeiras páginas, a principal provavelmente veio truncada — vale um aviso, não um bloqueio.
  const fetches = (await ctx.store.listSteps(run.id)).filter((s) => s.kind === 'fetch');
  const capitulos = (marca: string) =>
    fetches.filter((s) => s.payload[marca] === true).map((s) => Number(s.payload.capitulos_no_texto ?? 0));
  const [principal] = capitulos('principal');
  const conferencias = capitulos('conferencia');
  if (principal !== undefined && conferencias.some((n) => principalLooksTruncated(principal, n))) {
    await ctx.notify(
      'ingestion',
      `run ${run.id}: o texto integral lido mostra ${principal} capítulos e uma cópia de conferência mostra ${Math.max(...conferencias)}`,
    );
  }

  if (!edition.title) return finish('failed', 'edicao_nao_encontrada');

  const recheck = run.payload.recheckChapters;
  const accepted = (await ctx.store.listSources(run.id)).filter((s) => s.decision === 'accepted');
  if (accepted.length === 0 && !recheck) return finish('failed', 'nenhuma_fonte_aceita');

  const chapters = await ctx.store.listEditionChapters(edition.id);
  if (chapters.length === 0) return finish('partial', run.statusReason ?? 'estrutura_nao_confirmada');

  // BER-60: o livro do app passa a usar o que o run publicou (capítulos da edição, quiz sem
  // conteúdo gerado de novo). Falhar aqui não desfaz o conhecimento publicado: avisa e segue.
  try {
    appSync = await syncAppBooks(ctx, edition, chapters);
  } catch (err) {
    await ctx.notify('ingestion', `run ${run.id}: falha ao atualizar o livro do app: ${err instanceof Error ? err.message : String(err)}`);
  }

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
