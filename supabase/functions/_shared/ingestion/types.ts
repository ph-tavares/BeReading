// supabase/functions/_shared/ingestion/types.ts
// Tipos da ingestão de conteúdo de capítulo (BER-59). Nomes espelham as colunas da
// migration 20260917120000_ber59_ingestion_schema.sql.

export type SourceWeight = 'A' | 'B' | 'C' | 'D';

/** Spec §6.2: A texto primário legítimo, B editora/base/enciclopédia, C editorial, D resto. */
export const WEIGHT_VALUE: Record<SourceWeight, number> = { A: 1, B: 0.7, C: 0.5, D: 0.3 };

export type SourceType =
  | 'public_domain_text'
  | 'open_license_text'
  | 'bibliographic'
  | 'publisher'
  | 'encyclopedia'
  | 'editorial'
  | 'web';

export type ClaimKind = 'event' | 'character' | 'relationship' | 'argument' | 'theme';

/** Como a fonte nomeia o capítulo; qualquer campo pode faltar. */
export interface ChapterRef {
  number: number | null;
  part: string | null;
  numberInPart: number | null;
  title: string | null;
}

/** Capítulo como uma fonte declara a estrutura. `number` é sequencial no livro. */
export interface DeclaredChapter {
  number: number;
  part: string | null;
  numberInPart: number | null;
  title: string | null;
}

/** Linha de `edition_chapters`. */
export interface EditionChapter {
  id: string;
  number: number;
  partLabel: string | null;
  numberInPart: number | null;
  title: string | null;
}

export type ChapterStatus = 'confirmed' | 'partial' | 'insufficient';
export type RunStatus = 'queued' | 'running' | 'succeeded' | 'partial' | 'failed';
export type StepKind = 'edition' | 'discover' | 'fetch' | 'extract' | 'structure' | 'verify' | 'publish';
export type StepStatus = 'pending' | 'running' | 'done' | 'failed';

/** Uma fonte apoiando uma afirmação: o grupo de independência e o peso dela. */
export interface Support {
  independenceGroup: string;
  weight: SourceWeight;
}
