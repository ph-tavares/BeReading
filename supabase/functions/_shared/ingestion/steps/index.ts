// supabase/functions/_shared/ingestion/steps/index.ts
// Um executor por tipo de passo (BER-59, spec §3).
import type { StepKind } from '../types.ts';
import type { StepExecutor } from './context.ts';
import { runDiscoverStep } from './discover.ts';
import { runEditionStep } from './edition.ts';
import { runExtractStep } from './extract.ts';
import { runFetchStep } from './fetch.ts';
import { runPublishStep } from './publish.ts';
import { runStructureStep } from './structure.ts';
import { runVerifyStep } from './verify.ts';

export const EXECUTORS: Record<StepKind, StepExecutor> = {
  edition: runEditionStep,
  discover: runDiscoverStep,
  fetch: runFetchStep,
  extract: runExtractStep,
  structure: runStructureStep,
  verify: runVerifyStep,
  publish: runPublishStep,
};
