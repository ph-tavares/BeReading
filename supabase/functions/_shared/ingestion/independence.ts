// supabase/functions/_shared/ingestion/independence.ts
// "Duas fontes" precisa significar duas fontes independentes (BER-59, spec §5.6).
// Mesmo domínio registrável é uma fonte só, e conteúdo quase idêntico em domínios
// diferentes também: blogs de resumo escolar copiam uns dos outros e confirmariam um erro
// por repetição. A impressão (simhash) é calculada antes de o texto bruto ser apagado.
import { getDomain } from 'npm:tldts@6.1.86';

/**
 * Distância de Hamming máxima entre impressões de 64 bits para considerar cópia. Acima do
 * 3 usual em busca web porque aqui não há peso por termo e os textos são curtos; textos
 * diferentes ficam em torno de 32.
 */
export const NEAR_DUPLICATE_MAX_DISTANCE = 6;
/** Abaixo disto a impressão é instável e juntaria textos só por serem curtos. */
export const MIN_FINGERPRINT_WORDS = 20;

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = (1n << 64n) - 1n;
const encoder = new TextEncoder();

export function registrableDomain(url: string): string | null {
  try {
    return getDomain(new URL(url).hostname) ?? null;
  } catch {
    return null;
  }
}

function fnv1a64(value: string): bigint {
  let hash = FNV_OFFSET;
  for (const byte of encoder.encode(value)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash;
}

export function simhash(text: string): string | null {
  const words = text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').match(/\p{L}+|\d+/gu) ?? [];
  if (words.length < MIN_FINGERPRINT_WORDS) return null;

  const votes = new Array<number>(64).fill(0);
  for (let i = 0; i + 3 <= words.length; i++) {
    const hash = fnv1a64(words.slice(i, i + 3).join(' '));
    for (let bit = 0; bit < 64; bit++) {
      votes[bit] += (hash >> BigInt(bit)) & 1n ? 1 : -1;
    }
  }

  let result = 0n;
  for (let bit = 0; bit < 64; bit++) {
    if (votes[bit] > 0) result |= 1n << BigInt(bit);
  }
  return result.toString(16).padStart(16, '0');
}

export function hammingDistance(a: string, b: string): number {
  let diff = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (diff > 0n) {
    count += Number(diff & 1n);
    diff >>= 1n;
  }
  return count;
}

export interface GroupableSource {
  id: string;
  domain: string | null;
  fingerprint: string | null;
}

/** Agrupa por domínio e por cópia, de forma transitiva. O rótulo é o menor domínio do grupo. */
export function assignIndependenceGroups(sources: GroupableSource[]): Map<string, string> {
  const parent = new Map<string, string>(sources.map((s) => [s.id, s.id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };

  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const a = sources[i];
      const b = sources[j];
      const sameDomain = a.domain !== null && a.domain === b.domain;
      const copy = a.fingerprint !== null && b.fingerprint !== null &&
        hammingDistance(a.fingerprint, b.fingerprint) <= NEAR_DUPLICATE_MAX_DISTANCE;
      if (sameDomain || copy) parent.set(find(a.id), find(b.id));
    }
  }

  const labels = new Map<string, string>();
  for (const source of sources) {
    const root = find(source.id);
    const candidate = source.domain ?? source.id;
    const current = labels.get(root);
    if (current === undefined || candidate < current) labels.set(root, candidate);
  }
  return new Map(sources.map((s) => [s.id, labels.get(find(s.id))!]));
}
