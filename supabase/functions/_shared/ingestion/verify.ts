// supabase/functions/_shared/ingestion/verify.ts
// Transforma afirmações agrupadas de um capítulo em fatos verificados (BER-59, spec §6.2).
// Resumo do capítulo: só fatos confirmados daquele capítulo, sem interpretação, montado em
// código. Serve de lastro interno ao quiz e nunca é mostrado ao leitor ("a IA não lê por
// você", docs/product.md §1).
import type { Grouping } from './grouping.ts';
import {
  bestWeightPerGroup,
  chapterConfidence,
  chapterStatus,
  factConfidence,
  isConfirmed,
  resolveContradiction,
} from './rules.ts';
import type { ChapterStatus, ClaimKind, SourceWeight, Support } from './types.ts';

export interface ClaimForVerify {
  id: string;
  sourceId: string;
  kind: ClaimKind;
  statement: string;
  isInterpretation: boolean;
}

export interface SourceSupport {
  sourceId: string;
  independenceGroup: string;
  weight: SourceWeight;
}

export interface VerifiedFact {
  kind: ClaimKind;
  statement: string;
  isInterpretation: boolean;
  confidence: number;
  independentSupport: number;
  sourceIds: string[];
}

export interface ChapterVerification {
  facts: VerifiedFact[];
  status: ChapterStatus;
  confidence: number;
  summary: string;
}

const RANK: Record<SourceWeight, number> = { A: 0, B: 1, C: 2, D: 3 };

export function verifyChapter(
  claims: ClaimForVerify[],
  sources: Map<string, SourceSupport>,
  grouping: Grouping,
): ChapterVerification {
  const byId = new Map(claims.map((c) => [c.id, c]));
  const members = grouping.groups.map((ids) =>
    ids.map((id) => byId.get(id)).filter((c): c is ClaimForVerify => !!c && sources.has(c.sourceId))
  );
  const supportsOf = (group: ClaimForVerify[]): Support[] =>
    group.map((c) => {
      const s = sources.get(c.sourceId)!;
      return { independenceGroup: s.independenceGroup, weight: s.weight };
    });

  const losers = new Set<number>();
  const contradicted = new Set<number>();
  for (const [a, b] of grouping.contradictions) {
    const winner = resolveContradiction(supportsOf(members[a] ?? []), supportsOf(members[b] ?? []));
    if (winner === 'a') {
      losers.add(b);
      contradicted.add(a);
    } else if (winner === 'b') {
      losers.add(a);
      contradicted.add(b);
    } else {
      losers.add(a);
      losers.add(b);
    }
  }

  const facts: VerifiedFact[] = [];
  members.forEach((group, index) => {
    if (group.length === 0 || losers.has(index)) return;
    const supports = supportsOf(group);
    const isInterpretation = group.filter((c) => c.isInterpretation).length * 2 > group.length;
    if (!isConfirmed(supports, isInterpretation)) return;

    const kindCounts = new Map<ClaimKind, number>();
    for (const c of group) kindCounts.set(c.kind, (kindCounts.get(c.kind) ?? 0) + 1);
    const kind = [...kindCounts.entries()].sort((x, y) => y[1] - x[1])[0][0];

    const best = [...group].sort((x, y) =>
      RANK[sources.get(x.sourceId)!.weight] - RANK[sources.get(y.sourceId)!.weight] ||
      x.statement.length - y.statement.length
    )[0];

    facts.push({
      kind,
      statement: best.statement,
      isInterpretation,
      confidence: factConfidence(supports, contradicted.has(index)),
      independentSupport: bestWeightPerGroup(supports).size,
      sourceIds: [...new Set(group.map((c) => c.sourceId))].sort(),
    });
  });

  facts.sort((x, y) => Number(x.isInterpretation) - Number(y.isInterpretation) || y.confidence - x.confidence);
  const plotFacts = facts.filter((f) => !f.isInterpretation);

  return {
    facts,
    status: chapterStatus(plotFacts.length),
    confidence: chapterConfidence(plotFacts.map((f) => f.confidence)),
    summary: plotFacts.map((f) => f.statement).join(' '),
  };
}
