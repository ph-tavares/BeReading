// supabase/functions/_shared/ingestion/robots.ts
// robots.txt e sinais `noai`/`noindex` são respeitados antes de ler qualquer página
// (BER-59, spec §5.2). Precedência do RFC 9309: vale a regra de caminho mais longa;
// empate favorece Allow.

export const USER_AGENT = 'BeReadingBot/1.0 (+https://github.com/ph-tavares/BeReading)';
const AGENT_TOKEN = 'bereadingbot';

export interface RobotsRules {
  isAllowed(path: string): boolean;
}

export const ALLOW_ALL: RobotsRules = { isAllowed: () => true };

interface Rule {
  allow: boolean;
  pattern: string;
  regex: RegExp;
}

function toRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

export function parseRobots(txt: string): RobotsRules {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of txt.split(/\r?\n/)) {
    const match = rawLine.replace(/#.*/, '').trim().match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();

    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase().replace(/\/.*/, ''));
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current || (key !== 'allow' && key !== 'disallow') || value === '') continue;
    current.rules.push({ allow: key === 'allow', pattern: value, regex: toRegex(value) });
  }

  const specific = groups.filter((g) => g.agents.includes(AGENT_TOKEN));
  const selected = specific.length > 0 ? specific : groups.filter((g) => g.agents.includes('*'));
  const rules = selected.flatMap((g) => g.rules);

  return {
    isAllowed(path: string): boolean {
      let best: Rule | null = null;
      for (const rule of rules) {
        if (!rule.regex.test(path)) continue;
        const longer = !best || rule.pattern.length > best.pattern.length;
        const tieAllow = best !== null && rule.pattern.length === best.pattern.length && rule.allow;
        if (longer || tieAllow) best = rule;
      }
      return best ? best.allow : true;
    },
  };
}

export function hasNoAiSignal(headers: Headers, html: string | null): boolean {
  if (/\b(noai|noindex)\b/.test((headers.get('x-robots-tag') ?? '').toLowerCase())) return true;
  if (!html) return false;
  const metas = html.match(/<meta[^>]+name=["']robots["'][^>]*>/gi) ?? [];
  return metas.some((meta) => /content=["'][^"']*\b(noai|noindex)\b/i.test(meta));
}
