// supabase/functions/_shared/test-support/memoryIngestionStore.ts
// Store da ingestão em memória (BER-59), com a semântica das tabelas e das funções SQL
// que os passos usam: índice único dos passos, reivindicação com trava velha, soma de
// estatística, cascata de conhecimento. Helper de teste — não é código de produção.
import type { DomainPolicy } from '../ingestion/policy.ts';
import { MAX_RECHECKS } from '../ingestion/recheck.ts';
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
} from '../ingestion/store.ts';
import type { ChapterStatus, DeclaredChapter, EditionChapter } from '../ingestion/types.ts';
import type { VerifiedFact } from '../ingestion/verify.ts';

type StoredChapter = EditionChapter & { editionId: string; confidence: number };
type StoredKnowledge = {
  id: string;
  editionChapterId: string;
  runId: string;
  status: ChapterStatus;
  confidence: number;
  summary: string;
  recheckCount: number;
  nextRecheckAt: string | null;
};

function notFound(what: string, id: string): never {
  throw new Error(`${what} não encontrado: ${id}`);
}

export class MemoryIngestionStore implements IngestionStore {
  editions: EditionRow[] = [];
  runs: (RunRow & { structureDivergence?: unknown })[] = [];
  steps: StepRow[] = [];
  policies: DomainPolicy[] = [];
  sources: SourceRow[] = [];
  texts = new Map<string, { text: string; createdAt: string }>();
  claims: ClaimRow[] = [];
  chapters: StoredChapter[] = [];
  knowledge: StoredKnowledge[] = [];
  facts: (VerifiedFact & { id: string; knowledgeId: string })[] = [];
  factSources: { factId: string; sourceId: string }[] = [];
  bookChapters = new Map<string, { number: number; title: string | null }[]>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  private iso(): string {
    return new Date(this.now()).toISOString();
  }

  async findEditionByIsbn(isbn: string) {
    return this.editions.find((e) => e.isbn === isbn) ?? null;
  }

  async insertEdition(isbn: string, bookId: string | null) {
    const row: EditionRow = {
      id: crypto.randomUUID(), isbn, title: null, authors: [], publisher: null, language: null, publishYear: null,
      firstPublishYear: null, workKey: null, originalLanguage: null, authorDeathYear: null, bookId,
    };
    this.editions.push(row);
    return row;
  }

  async getEdition(id: string) {
    return this.editions.find((e) => e.id === id) ?? notFound('edição', id);
  }

  async updateEdition(id: string, patch: Partial<Omit<EditionRow, 'id' | 'isbn'>>) {
    return Object.assign(await this.getEdition(id), patch);
  }

  async createRun(editionId: string, payload: RunRow['payload']) {
    const row: RunRow = {
      id: crypto.randomUUID(), editionId, status: 'queued', statusReason: null, payload, stats: {},
      startedAt: this.iso(), finishedAt: null,
    };
    this.runs.push(row);
    return row;
  }

  async getRun(id: string) {
    return this.runs.find((r) => r.id === id) ?? notFound('run', id);
  }

  async updateRun(id: string, patch: { status?: RunRow['status']; statusReason?: string | null; finishedAt?: string | null; structureDivergence?: unknown }) {
    Object.assign(await this.getRun(id), patch);
  }

  async incrementRunStats(id: string, delta: Record<string, number>) {
    const run = await this.getRun(id);
    for (const [key, value] of Object.entries(delta)) run.stats[key] = (run.stats[key] ?? 0) + value;
  }

  async countRunsSince(iso: string) {
    return this.runs.filter((r) => r.startedAt >= iso).length;
  }

  async sumRunStatSince(key: string, iso: string) {
    return this.runs.filter((r) => r.startedAt >= iso).reduce((sum, r) => sum + (r.stats[key] ?? 0), 0);
  }

  async enqueueSteps(steps: NewStep[]) {
    for (const step of steps) {
      const exists = this.steps.some((s) => s.runId === step.runId && s.kind === step.kind && s.subject === step.subject);
      if (exists) continue;
      this.steps.push({
        id: crypto.randomUUID(), runId: step.runId, kind: step.kind, subject: step.subject, status: 'pending', attempts: 0,
        nextAttemptAt: step.nextAttemptAt ?? this.iso(), lockedAt: null, error: null, payload: step.payload ?? {},
      });
    }
  }

  async claimSteps(limit: number, staleBeforeIso: string) {
    const now = this.iso();
    const ready = this.steps
      .filter((s) => (s.status === 'pending' && s.nextAttemptAt <= now) || (s.status === 'running' && s.lockedAt !== null && s.lockedAt < staleBeforeIso))
      .sort((a, b) => a.nextAttemptAt.localeCompare(b.nextAttemptAt))
      .slice(0, limit);
    for (const step of ready) {
      step.status = 'running';
      step.lockedAt = now;
    }
    return ready.map((s) => ({ ...s, payload: { ...s.payload } }));
  }

  async finishStep(id: string, patch: { status: StepRow['status']; attempts?: number; nextAttemptAt?: string; error?: string | null; payload?: Record<string, unknown> }) {
    const step = this.steps.find((s) => s.id === id) ?? notFound('passo', id);
    Object.assign(step, patch, { lockedAt: null });
  }

  async listSteps(runId: string) {
    return this.steps.filter((s) => s.runId === runId).map((s) => ({ ...s }));
  }

  async getDomainPolicy(domain: string) {
    return this.policies.find((p) => p.domain === domain) ?? null;
  }

  async insertSource(source: NewSource) {
    const existing = this.sources.find((s) => s.runId === source.runId && s.url === source.url);
    if (existing) return existing;
    const row: SourceRow = { id: crypto.randomUUID(), ...source };
    this.sources.push(row);
    return row;
  }

  async updateSource(id: string, patch: Partial<Omit<SourceRow, 'id' | 'runId'>>) {
    Object.assign(await this.getSource(id), patch);
  }

  async getSource(id: string) {
    return this.sources.find((s) => s.id === id) ?? notFound('fonte', id);
  }

  async listSources(runId: string) {
    return this.sources.filter((s) => s.runId === runId);
  }

  async getSourcesByIds(ids: string[]) {
    return this.sources.filter((s) => ids.includes(s.id));
  }

  async saveSourceText(sourceId: string, text: string) {
    this.texts.set(sourceId, { text, createdAt: this.iso() });
  }

  async getSourceText(sourceId: string) {
    return this.texts.get(sourceId)?.text ?? null;
  }

  async deleteSourceText(sourceId: string) {
    this.texts.delete(sourceId);
  }

  async deleteSourceTextsBefore(iso: string) {
    for (const [id, value] of this.texts) if (value.createdAt < iso) this.texts.delete(id);
  }

  async insertClaims(claims: NewClaim[]) {
    for (const claim of claims) this.claims.push({ id: crypto.randomUUID(), editionChapterId: null, located: false, ...claim });
  }

  async listClaimsForRun(runId: string) {
    return this.claims.filter((c) => c.runId === runId);
  }

  async setClaimLocations(updates: { id: string; editionChapterId: string | null; located: boolean }[]) {
    for (const update of updates) {
      const claim = this.claims.find((c) => c.id === update.id);
      if (claim) Object.assign(claim, { editionChapterId: update.editionChapterId, located: update.located });
    }
  }

  async listLocatedClaims(editionChapterId: string) {
    return this.claims.filter((c) => c.editionChapterId === editionChapterId && c.located && !c.forwardReference);
  }

  async listEditionChapters(editionId: string) {
    return this.chapters
      .filter((c) => c.editionId === editionId)
      .sort((a, b) => a.number - b.number)
      .map(({ id, number, partLabel, numberInPart, title }) => ({ id, number, partLabel, numberInPart, title }));
  }

  async replaceEditionChapters(editionId: string, chapters: DeclaredChapter[], confidence: number) {
    const removed = new Set(this.chapters.filter((c) => c.editionId === editionId).map((c) => c.id));
    this.chapters = this.chapters.filter((c) => c.editionId !== editionId);
    const removedKnowledge = new Set(this.knowledge.filter((k) => removed.has(k.editionChapterId)).map((k) => k.id));
    this.knowledge = this.knowledge.filter((k) => !removedKnowledge.has(k.id));
    this.facts = this.facts.filter((f) => !removedKnowledge.has(f.knowledgeId));
    for (const claim of this.claims) {
      if (claim.editionChapterId && removed.has(claim.editionChapterId)) claim.editionChapterId = null;
    }
    for (const c of chapters) {
      this.chapters.push({ id: crypto.randomUUID(), editionId, number: c.number, partLabel: c.part, numberInPart: c.numberInPart, title: c.title, confidence });
    }
    return this.listEditionChapters(editionId);
  }

  async publishChapterKnowledge(input: PublishChapterInput) {
    let row = this.knowledge.find((k) => k.editionChapterId === input.editionChapterId);
    if (!row) {
      row = { id: crypto.randomUUID(), editionChapterId: input.editionChapterId, runId: input.runId, status: input.status, confidence: 0, summary: '', recheckCount: 0, nextRecheckAt: null };
      this.knowledge.push(row);
    }
    Object.assign(row, { runId: input.runId, status: input.status, confidence: input.confidence, summary: input.summary, nextRecheckAt: input.nextRecheckAt });
    const oldFacts = new Set(this.facts.filter((f) => f.knowledgeId === row!.id).map((f) => f.id));
    this.facts = this.facts.filter((f) => !oldFacts.has(f.id));
    this.factSources = this.factSources.filter((fs) => !oldFacts.has(fs.factId));
    for (const fact of input.facts) {
      const id = crypto.randomUUID();
      this.facts.push({ ...fact, id, knowledgeId: row.id });
      for (const sourceId of fact.sourceIds) this.factSources.push({ factId: id, sourceId });
    }
  }

  async listKnowledge(editionId: string, maxChapterNumber: number) {
    const chapters = await this.listEditionChapters(editionId);
    const rows: KnowledgeRow[] = [];
    for (const chapter of chapters.filter((c) => c.number <= maxChapterNumber)) {
      const k = this.knowledge.find((x) => x.editionChapterId === chapter.id);
      if (!k) continue;
      rows.push({
        chapterNumber: chapter.number, partLabel: chapter.partLabel, numberInPart: chapter.numberInPart, title: chapter.title,
        status: k.status, confidence: k.confidence, summary: k.summary, recheckCount: k.recheckCount,
        facts: this.facts.filter((f) => f.knowledgeId === k.id).map(({ kind, statement, isInterpretation, confidence }) => ({ kind, statement, isInterpretation, confidence })),
      });
    }
    return rows;
  }

  async dueRechecks(nowIso: string, limit: number) {
    const byEdition = new Map<string, number[]>();
    for (const k of this.knowledge) {
      if (k.status !== 'insufficient' || !k.nextRecheckAt || k.nextRecheckAt > nowIso || k.recheckCount >= MAX_RECHECKS) continue;
      const chapter = this.chapters.find((c) => c.id === k.editionChapterId);
      if (!chapter) continue;
      byEdition.set(chapter.editionId, [...(byEdition.get(chapter.editionId) ?? []), chapter.number]);
    }
    return [...byEdition.entries()].slice(0, limit).map(([editionId, chapterNumbers]) => ({ editionId, chapterNumbers: chapterNumbers.sort((a, b) => a - b) }));
  }

  async markRechecksScheduled(editionId: string, chapterNumbers: number[]) {
    for (const chapter of this.chapters.filter((c) => c.editionId === editionId && chapterNumbers.includes(c.number))) {
      const k = this.knowledge.find((x) => x.editionChapterId === chapter.id);
      if (k) Object.assign(k, { recheckCount: k.recheckCount + 1, nextRecheckAt: null });
    }
  }

  async listBookChapters(bookId: string) {
    return this.bookChapters.get(bookId) ?? [];
  }
}
