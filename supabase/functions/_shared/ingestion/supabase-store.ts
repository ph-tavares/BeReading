// supabase/functions/_shared/ingestion/supabase-store.ts
// `IngestionStore` sobre supabase-js com a service key (BER-59). As tabelas não têm policy:
// só este cliente de servidor lê e escreve. Não tem teste unitário (precisa de Postgres); é
// exercitado na execução de aceitação (Tarefa 19).
import type { createServiceClient } from '../supabase-client.ts';
import type { DomainPolicy } from './policy.ts';
import { MAX_RECHECKS } from './recheck.ts';
import type {
  ClaimRow,
  EditionRow,
  IngestionStore,
  KnowledgeRow,
  NewClaim,
  NewSource,
  NewStep,
  PublishChapterInput,
  RunRow,
  SourceRow,
  StepRow,
} from './store.ts';
import type { DeclaredChapter, EditionChapter } from './types.ts';

type Client = ReturnType<typeof createServiceClient>;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function must<T>(result: { data: T | null; error: { message: string } | null }, context: string): T {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${context}: sem dados`);
  return result.data;
}

function ok(result: { error: { message: string } | null }, context: string): void {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
}

const toEdition = (r: Row): EditionRow => ({
  id: r.id, isbn: r.isbn, title: r.title, authors: r.authors ?? [], publisher: r.publisher, language: r.language,
  publishYear: r.publish_year, firstPublishYear: r.first_publish_year, workKey: r.work_key,
  originalLanguage: r.original_language, authorDeathYear: r.author_death_year, bookId: r.book_id,
});

const toRun = (r: Row): RunRow => ({
  id: r.id, editionId: r.edition_id, status: r.status, statusReason: r.status_reason, payload: r.payload ?? {},
  stats: r.stats ?? {}, startedAt: r.started_at, finishedAt: r.finished_at,
});

const toStep = (r: Row): StepRow => ({
  id: r.id, runId: r.run_id, kind: r.kind, subject: r.subject, status: r.status, attempts: r.attempts,
  nextAttemptAt: r.next_attempt_at, lockedAt: r.locked_at, error: r.error, payload: r.payload ?? {},
});

const toSource = (r: Row): SourceRow => ({
  id: r.id, runId: r.run_id, url: r.url, finalUrl: r.final_url, registrableDomain: r.registrable_domain, title: r.title,
  sourceType: r.source_type, weight: r.weight, decision: r.decision, rejectionReason: r.rejection_reason,
  publicDomainBasis: r.public_domain_basis, isBookFile: r.is_book_file, tiedToIsbn: r.tied_to_isbn,
  contentFingerprint: r.content_fingerprint, independenceGroup: r.independence_group, declaredStructure: r.declared_structure,
});

const fromSource = (s: Partial<NewSource>): Row => {
  const map: Record<string, string> = {
    runId: 'run_id', url: 'url', finalUrl: 'final_url', registrableDomain: 'registrable_domain', title: 'title',
    sourceType: 'source_type', weight: 'weight', decision: 'decision', rejectionReason: 'rejection_reason',
    publicDomainBasis: 'public_domain_basis', isBookFile: 'is_book_file', tiedToIsbn: 'tied_to_isbn',
    contentFingerprint: 'content_fingerprint', independenceGroup: 'independence_group', declaredStructure: 'declared_structure',
  };
  return Object.fromEntries(Object.entries(s).filter(([k]) => k in map).map(([k, v]) => [map[k], v]));
};

const toClaim = (r: Row): ClaimRow => ({
  id: r.id, runId: r.run_id, sourceId: r.source_id, chapterRef: r.chapter_ref, editionChapterId: r.edition_chapter_id,
  kind: r.kind, statement: r.statement, isInterpretation: r.is_interpretation, forwardReference: r.forward_reference, located: r.located,
});

const toChapter = (r: Row): EditionChapter => ({
  id: r.id, number: r.number, partLabel: r.part_label, numberInPart: r.number_in_part, title: r.title,
});

export class SupabaseIngestionStore implements IngestionStore {
  constructor(private readonly db: Client) {}

  async findEditionByIsbn(isbn: string) {
    const { data, error } = await this.db.from('book_editions').select('*').eq('isbn', isbn).maybeSingle();
    if (error) throw new Error(`findEditionByIsbn: ${error.message}`);
    return data ? toEdition(data) : null;
  }

  async insertEdition(isbn: string, bookId: string | null) {
    return toEdition(must(await this.db.from('book_editions').insert({ isbn, book_id: bookId }).select('*').single(), 'insertEdition'));
  }

  async getEdition(id: string) {
    return toEdition(must(await this.db.from('book_editions').select('*').eq('id', id).single(), 'getEdition'));
  }

  async updateEdition(id: string, patch: Partial<Omit<EditionRow, 'id' | 'isbn'>>) {
    const row: Row = {};
    if ('title' in patch) row.title = patch.title;
    if ('authors' in patch) row.authors = patch.authors;
    if ('publisher' in patch) row.publisher = patch.publisher;
    if ('language' in patch) row.language = patch.language;
    if ('publishYear' in patch) row.publish_year = patch.publishYear;
    if ('firstPublishYear' in patch) row.first_publish_year = patch.firstPublishYear;
    if ('workKey' in patch) row.work_key = patch.workKey;
    if ('originalLanguage' in patch) row.original_language = patch.originalLanguage;
    if ('authorDeathYear' in patch) row.author_death_year = patch.authorDeathYear;
    if ('bookId' in patch) row.book_id = patch.bookId;
    return toEdition(must(await this.db.from('book_editions').update(row).eq('id', id).select('*').single(), 'updateEdition'));
  }

  async createRun(editionId: string, payload: RunRow['payload']) {
    return toRun(must(await this.db.from('ingestion_runs').insert({ edition_id: editionId, payload }).select('*').single(), 'createRun'));
  }

  async getRun(id: string) {
    return toRun(must(await this.db.from('ingestion_runs').select('*').eq('id', id).single(), 'getRun'));
  }

  async updateRun(id: string, patch: { status?: RunRow['status']; statusReason?: string | null; finishedAt?: string | null; structureDivergence?: unknown }) {
    const row: Row = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.statusReason !== undefined) row.status_reason = patch.statusReason;
    if (patch.finishedAt !== undefined) row.finished_at = patch.finishedAt;
    if (patch.structureDivergence !== undefined) row.structure_divergence = patch.structureDivergence;
    ok(await this.db.from('ingestion_runs').update(row).eq('id', id), 'updateRun');
  }

  async incrementRunStats(id: string, delta: Record<string, number>) {
    ok(await this.db.rpc('increment_ingestion_run_stats', { p_run_id: id, p_delta: delta }), 'incrementRunStats');
  }

  async countRunsSince(iso: string) {
    const { count, error } = await this.db.from('ingestion_runs').select('id', { count: 'exact', head: true }).gte('started_at', iso);
    if (error) throw new Error(`countRunsSince: ${error.message}`);
    return count ?? 0;
  }

  async sumRunStatSince(key: string, iso: string) {
    const rows = must(await this.db.from('ingestion_runs').select('stats').gte('started_at', iso), 'sumRunStatSince');
    return rows.reduce((sum: number, r: Row) => sum + Number(r.stats?.[key] ?? 0), 0);
  }

  async enqueueSteps(steps: NewStep[]) {
    if (steps.length === 0) return;
    const rows = steps.map((s) => ({
      run_id: s.runId, kind: s.kind, subject: s.subject, payload: s.payload ?? {},
      ...(s.nextAttemptAt ? { next_attempt_at: s.nextAttemptAt } : {}),
    }));
    ok(await this.db.from('ingestion_steps').upsert(rows, { onConflict: 'run_id,kind,subject', ignoreDuplicates: true }), 'enqueueSteps');
  }

  async claimSteps(limit: number, staleBeforeIso: string) {
    const rows = must(await this.db.rpc('claim_ingestion_steps', { p_limit: limit, p_stale_before: staleBeforeIso }), 'claimSteps');
    return (rows as Row[]).map(toStep);
  }

  async finishStep(id: string, patch: { status: StepRow['status']; attempts?: number; nextAttemptAt?: string; error?: string | null; payload?: Record<string, unknown> }) {
    const row: Row = { status: patch.status, locked_at: null };
    if (patch.attempts !== undefined) row.attempts = patch.attempts;
    if (patch.nextAttemptAt !== undefined) row.next_attempt_at = patch.nextAttemptAt;
    if (patch.error !== undefined) row.error = patch.error;
    if (patch.payload !== undefined) row.payload = patch.payload;
    ok(await this.db.from('ingestion_steps').update(row).eq('id', id), 'finishStep');
  }

  async listSteps(runId: string) {
    return must(await this.db.from('ingestion_steps').select('*').eq('run_id', runId), 'listSteps').map(toStep);
  }

  async getDomainPolicy(domain: string): Promise<DomainPolicy | null> {
    const { data, error } = await this.db.from('source_domain_policies').select('*').eq('domain', domain).maybeSingle();
    if (error) throw new Error(`getDomainPolicy: ${error.message}`);
    return data
      ? { domain: data.domain, policy: data.policy, weight: data.weight, sourceType: data.source_type, authorizesFullText: data.authorizes_full_text, hostCountry: data.host_country }
      : null;
  }

  async insertSource(source: NewSource) {
    // Um passo `fetch` re-executado depois de uma falha transitória tem que reaproveitar a
    // fonte já registrada, não reescrever a decisão dela — mesma semântica do memory store (BER-59).
    const { data, error } = await this.db.from('ingestion_sources')
      .upsert(fromSource(source), { onConflict: 'run_id,url', ignoreDuplicates: true }).select('*');
    if (error) throw new Error(`insertSource: ${error.message}`);
    if (data && data.length > 0) return toSource(data[0]);
    return toSource(
      must(await this.db.from('ingestion_sources').select('*').eq('run_id', source.runId).eq('url', source.url).single(), 'insertSource(existing)'),
    );
  }

  async updateSource(id: string, patch: Partial<Omit<SourceRow, 'id' | 'runId'>>) {
    ok(await this.db.from('ingestion_sources').update(fromSource(patch)).eq('id', id), 'updateSource');
  }

  async getSource(id: string) {
    return toSource(must(await this.db.from('ingestion_sources').select('*').eq('id', id).single(), 'getSource'));
  }

  async listSources(runId: string) {
    return must(await this.db.from('ingestion_sources').select('*').eq('run_id', runId), 'listSources').map(toSource);
  }

  async getSourcesByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return must(await this.db.from('ingestion_sources').select('*').in('id', ids), 'getSourcesByIds').map(toSource);
  }

  async saveSourceText(sourceId: string, text: string) {
    ok(await this.db.from('ingestion_source_texts').upsert({ source_id: sourceId, text }), 'saveSourceText');
  }

  async getSourceText(sourceId: string) {
    const { data, error } = await this.db.from('ingestion_source_texts').select('text').eq('source_id', sourceId).maybeSingle();
    if (error) throw new Error(`getSourceText: ${error.message}`);
    return data?.text ?? null;
  }

  async deleteSourceText(sourceId: string) {
    ok(await this.db.from('ingestion_source_texts').delete().eq('source_id', sourceId), 'deleteSourceText');
  }

  async deleteSourceTextsBefore(iso: string) {
    ok(await this.db.from('ingestion_source_texts').delete().lt('created_at', iso), 'deleteSourceTextsBefore');
  }

  async insertClaims(claims: NewClaim[]) {
    if (claims.length === 0) return;
    const rows = claims.map((c) => ({
      run_id: c.runId, source_id: c.sourceId, chapter_ref: c.chapterRef, kind: c.kind, statement: c.statement,
      is_interpretation: c.isInterpretation, forward_reference: c.forwardReference,
    }));
    ok(await this.db.from('ingestion_claims').insert(rows), 'insertClaims');
  }

  async listClaimsForRun(runId: string) {
    return must(await this.db.from('ingestion_claims').select('*').eq('run_id', runId), 'listClaimsForRun').map(toClaim);
  }

  async setClaimLocations(updates: { id: string; editionChapterId: string | null; located: boolean }[]) {
    const byTarget = new Map<string, string[]>();
    for (const u of updates) {
      const key = `${u.editionChapterId ?? ''}|${u.located}`;
      byTarget.set(key, [...(byTarget.get(key) ?? []), u.id]);
    }
    for (const [key, ids] of byTarget) {
      const [chapterId, located] = key.split('|');
      ok(
        await this.db.from('ingestion_claims').update({ edition_chapter_id: chapterId || null, located: located === 'true' }).in('id', ids),
        'setClaimLocations',
      );
    }
  }

  async listLocatedClaims(editionChapterId: string) {
    const result = await this.db.from('ingestion_claims').select('*')
      .eq('edition_chapter_id', editionChapterId).eq('located', true).eq('forward_reference', false);
    return must(result, 'listLocatedClaims').map(toClaim);
  }

  async listEditionChapters(editionId: string) {
    const result = await this.db.from('edition_chapters').select('*').eq('edition_id', editionId).order('number');
    return must(result, 'listEditionChapters').map(toChapter);
  }

  async replaceEditionChapters(editionId: string, chapters: DeclaredChapter[], confidence: number) {
    ok(await this.db.from('edition_chapters').delete().eq('edition_id', editionId), 'replaceEditionChapters(delete)');
    const rows = chapters.map((c) => ({
      edition_id: editionId, number: c.number, part_label: c.part, number_in_part: c.numberInPart, title: c.title, confidence,
    }));
    ok(await this.db.from('edition_chapters').insert(rows), 'replaceEditionChapters(insert)');
    return this.listEditionChapters(editionId);
  }

  async publishChapterKnowledge(input: PublishChapterInput) {
    const knowledge = must<Row>(
      await this.db.from('chapter_knowledge').upsert({
        edition_chapter_id: input.editionChapterId, run_id: input.runId, status: input.status, confidence: input.confidence,
        summary: input.summary, next_recheck_at: input.nextRecheckAt, published_at: new Date().toISOString(),
      }, { onConflict: 'edition_chapter_id' }).select('id').single(),
      'publishChapterKnowledge(upsert)',
    );
    ok(await this.db.from('chapter_facts').delete().eq('chapter_knowledge_id', knowledge.id), 'publishChapterKnowledge(delete)');
    if (input.facts.length === 0) return;

    const inserted = must(
      await this.db.from('chapter_facts').insert(input.facts.map((f) => ({
        chapter_knowledge_id: knowledge.id, kind: f.kind, statement: f.statement, is_interpretation: f.isInterpretation,
        confidence: f.confidence, independent_support: f.independentSupport,
      }))).select('id'),
      'publishChapterKnowledge(facts)',
    );
    const links = input.facts.flatMap((f, i) => f.sourceIds.map((sourceId) => ({ fact_id: inserted[i].id, source_id: sourceId })));
    if (links.length > 0) ok(await this.db.from('chapter_fact_sources').insert(links), 'publishChapterKnowledge(sources)');
  }

  async listKnowledge(editionId: string, maxChapterNumber: number): Promise<KnowledgeRow[]> {
    const result = await this.db.from('chapter_knowledge')
      .select('status, confidence, summary, recheck_count, edition_chapters!inner(number, part_label, number_in_part, title, edition_id), chapter_facts(kind, statement, is_interpretation, confidence)')
      .eq('edition_chapters.edition_id', editionId)
      .lte('edition_chapters.number', maxChapterNumber);
    return must(result, 'listKnowledge').map((r: Row) => ({
      chapterNumber: r.edition_chapters.number, partLabel: r.edition_chapters.part_label, numberInPart: r.edition_chapters.number_in_part,
      title: r.edition_chapters.title, status: r.status, confidence: Number(r.confidence), summary: r.summary, recheckCount: r.recheck_count,
      facts: (r.chapter_facts ?? []).map((f: Row) => ({ kind: f.kind, statement: f.statement, isInterpretation: f.is_interpretation, confidence: Number(f.confidence) })),
    })).sort((a: KnowledgeRow, b: KnowledgeRow) => a.chapterNumber - b.chapterNumber);
  }

  async dueRechecks(nowIso: string, limit: number) {
    const result = await this.db.from('chapter_knowledge')
      .select('edition_chapters!inner(number, edition_id)')
      .eq('status', 'insufficient').lte('next_recheck_at', nowIso).lt('recheck_count', MAX_RECHECKS).limit(200);
    const byEdition = new Map<string, number[]>();
    for (const r of must(result, 'dueRechecks') as Row[]) {
      const { edition_id, number } = r.edition_chapters;
      byEdition.set(edition_id, [...(byEdition.get(edition_id) ?? []), number]);
    }
    return [...byEdition.entries()].slice(0, limit).map(([editionId, chapterNumbers]) => ({ editionId, chapterNumbers: chapterNumbers.sort((a, b) => a - b) }));
  }

  async markRechecksScheduled(editionId: string, chapterNumbers: number[]) {
    const chapters = await this.listEditionChapters(editionId);
    for (const chapter of chapters.filter((c) => chapterNumbers.includes(c.number))) {
      const current = must<Row>(await this.db.from('chapter_knowledge').select('recheck_count').eq('edition_chapter_id', chapter.id).single(), 'markRechecksScheduled(select)');
      ok(
        await this.db.from('chapter_knowledge').update({ recheck_count: current.recheck_count + 1, next_recheck_at: null }).eq('edition_chapter_id', chapter.id),
        'markRechecksScheduled(update)',
      );
    }
  }

  async listBookChapters(bookId: string) {
    const result = await this.db.from('chapters').select('number, title').eq('book_id', bookId).order('number');
    return must(result, 'listBookChapters') as { number: number; title: string | null }[];
  }
}
