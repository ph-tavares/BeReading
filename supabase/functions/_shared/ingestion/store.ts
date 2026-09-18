// supabase/functions/_shared/ingestion/store.ts
// Acesso a dados da ingestão (BER-59) atrás de uma interface: os passos e o worker são
// testados com `MemoryIngestionStore`, sem Postgres; em produção vale `SupabaseIngestionStore`.
import type { DomainPolicy } from './policy.ts';
import type {
  ChapterRef,
  ChapterStatus,
  ClaimKind,
  DeclaredChapter,
  EditionChapter,
  RunStatus,
  SourceType,
  SourceWeight,
  StepKind,
  StepStatus,
} from './types.ts';
import type { VerifiedFact } from './verify.ts';

export interface EditionRow {
  id: string;
  isbn: string;
  title: string | null;
  authors: string[];
  publisher: string | null;
  language: string | null;
  publishYear: number | null;
  firstPublishYear: number | null;
  workKey: string | null;
  originalLanguage: string | null;
  authorDeathYear: number | null;
  bookId: string | null;
}

export interface RunRow {
  id: string;
  editionId: string;
  status: RunStatus;
  statusReason: string | null;
  payload: { recheckChapters?: number[] };
  stats: Record<string, number>;
  startedAt: string;
  finishedAt: string | null;
}

export interface StepRow {
  id: string;
  runId: string;
  kind: StepKind;
  subject: string;
  status: StepStatus;
  attempts: number;
  nextAttemptAt: string;
  lockedAt: string | null;
  /** Quando virou `done`/`failed` (BER-59): a cota diária do Tavily conta pelo fim da busca, não pelo início do run. */
  finishedAt: string | null;
  error: string | null;
  payload: Record<string, unknown>;
}

export interface NewStep {
  runId: string;
  kind: StepKind;
  subject: string;
  payload?: Record<string, unknown>;
  nextAttemptAt?: string;
}

export interface SourceRow {
  id: string;
  runId: string;
  url: string;
  finalUrl: string | null;
  registrableDomain: string | null;
  title: string | null;
  sourceType: SourceType | null;
  weight: SourceWeight | null;
  decision: 'accepted' | 'rejected';
  rejectionReason: string | null;
  publicDomainBasis: string | null;
  isBookFile: boolean;
  tiedToIsbn: boolean;
  contentFingerprint: string | null;
  independenceGroup: string | null;
  declaredStructure: DeclaredChapter[] | null;
  /** A fonte listou todos os capítulos em algum bloco (spec §11, item 24). Ausente conta como false. */
  declaredStructureComplete?: boolean;
}

export type NewSource = Omit<SourceRow, 'id'>;

export interface ClaimRow {
  id: string;
  runId: string;
  sourceId: string;
  chapterRef: ChapterRef | null;
  editionChapterId: string | null;
  kind: ClaimKind;
  statement: string;
  isInterpretation: boolean;
  forwardReference: boolean;
  located: boolean;
  /** Bloco de texto da fonte de onde veio (BER-59): permite ao passo `extract` reexecutado substituir, não duplicar. */
  chunkIndex: number | null;
}

export type NewClaim = Omit<ClaimRow, 'id' | 'editionChapterId' | 'located'>;

export interface PublishChapterInput {
  editionChapterId: string;
  runId: string;
  status: ChapterStatus;
  confidence: number;
  summary: string;
  facts: VerifiedFact[];
  nextRecheckAt: string | null;
}

export interface KnowledgeFact {
  kind: ClaimKind;
  statement: string;
  isInterpretation: boolean;
  confidence: number;
}

export interface KnowledgeRow {
  chapterNumber: number;
  partLabel: string | null;
  numberInPart: number | null;
  title: string | null;
  status: ChapterStatus;
  confidence: number;
  summary: string;
  recheckCount: number;
  facts: KnowledgeFact[];
}

export interface IngestionStore {
  findEditionByIsbn(isbn: string): Promise<EditionRow | null>;
  insertEdition(isbn: string, bookId: string | null): Promise<EditionRow>;
  getEdition(id: string): Promise<EditionRow>;
  updateEdition(id: string, patch: Partial<Omit<EditionRow, 'id' | 'isbn'>>): Promise<EditionRow>;

  createRun(editionId: string, payload: RunRow['payload']): Promise<RunRow>;
  getRun(id: string): Promise<RunRow>;
  /** Run `queued`/`running` da edição, se existir (BER-59 M1): evita duas ingestões da mesma edição ao mesmo tempo. */
  findActiveRun(editionId: string): Promise<RunRow | null>;
  updateRun(id: string, patch: { status?: RunStatus; statusReason?: string | null; finishedAt?: string | null; structureDivergence?: unknown }): Promise<void>;
  incrementRunStats(id: string, delta: Record<string, number>): Promise<void>;
  countRunsSince(iso: string): Promise<number>;
  /**
   * Runs `queued`/`running` sem nenhum passo `pending`/`running` (BER-59): ninguém mais os avançaria.
   * Só os iniciados antes de `startedBeforeIso`: um run recém-criado ainda não teve os passos
   * enfileirados, e replanejá-lo cedo (rebusca sem `discover`) verificaria e publicaria sem buscar.
   */
  listStalledRuns(limit: number, startedBeforeIso: string): Promise<RunRow[]>;
  /** Soma `payload.creditos` dos passos `discover` terminados (`done`) desde `iso` (BER-59). */
  sumTavilyCreditsSince(iso: string): Promise<number>;

  enqueueSteps(steps: NewStep[]): Promise<void>;
  claimSteps(limit: number, staleBeforeIso: string): Promise<StepRow[]>;
  finishStep(id: string, patch: { status: StepStatus; attempts?: number; nextAttemptAt?: string; error?: string | null; payload?: Record<string, unknown> }): Promise<void>;
  listSteps(runId: string): Promise<StepRow[]>;

  getDomainPolicy(domain: string): Promise<DomainPolicy | null>;
  insertSource(source: NewSource): Promise<SourceRow>;
  updateSource(id: string, patch: Partial<Omit<SourceRow, 'id' | 'runId'>>): Promise<void>;
  getSource(id: string): Promise<SourceRow>;
  listSources(runId: string): Promise<SourceRow[]>;
  getSourcesByIds(ids: string[]): Promise<SourceRow[]>;

  saveSourceText(sourceId: string, text: string): Promise<void>;
  getSourceText(sourceId: string): Promise<string | null>;
  deleteSourceText(sourceId: string): Promise<void>;
  deleteSourceTextsBefore(iso: string): Promise<void>;

  /**
   * Fonte igual já extraída antes e ainda válida: mesma URL, da mesma edição ou de outra edição da
   * mesma obra (BER-59). A extração não depende da edição — o que depende é a localização do
   * capítulo, refeita a cada run.
   */
  findExtractedSource(input: { editionId: string; workKey: string | null; url: string; sinceIso: string }): Promise<SourceRow | null>;
  countClaimsForSource(sourceId: string): Promise<number>;
  /** Copia as afirmações de uma fonte já extraída para o run novo, sem capítulo (ele é re-localizado). */
  copyClaims(fromSourceId: string, to: { runId: string; sourceId: string }): Promise<number>;

  insertClaims(claims: NewClaim[]): Promise<void>;
  /** Apaga as afirmações já gravadas de um bloco, para o passo `extract` reexecutado substituir em vez de duplicar. */
  deleteClaimsForChunk(sourceId: string, chunkIndex: number): Promise<void>;
  listClaimsForRun(runId: string): Promise<ClaimRow[]>;
  setClaimLocations(updates: { id: string; editionChapterId: string | null; located: boolean }[]): Promise<void>;
  /** Afirmações localizadas no capítulo, de todos os runs, sem as que antecipam. */
  listLocatedClaims(editionChapterId: string): Promise<ClaimRow[]>;

  listEditionChapters(editionId: string): Promise<EditionChapter[]>;
  replaceEditionChapters(editionId: string, chapters: DeclaredChapter[], confidence: number): Promise<EditionChapter[]>;
  publishChapterKnowledge(input: PublishChapterInput): Promise<void>;
  /** Conhecimento dos capítulos com número ≤ `maxChapterNumber`, em ordem. */
  listKnowledge(editionId: string, maxChapterNumber: number): Promise<KnowledgeRow[]>;
  dueRechecks(nowIso: string, limit: number): Promise<{ editionId: string; chapterNumbers: number[] }[]>;
  /** Incrementa `recheck_count` e adia `next_recheck_at` para `nextRecheckAtIso` (BER-59: nunca `null`, senão um run que falhar depois desta chamada perde o capítulo para sempre). */
  markRechecksScheduled(editionId: string, chapterNumbers: number[], nextRecheckAtIso: string): Promise<void>;
  listBookChapters(bookId: string): Promise<{ number: number; title: string | null }[]>;
}
