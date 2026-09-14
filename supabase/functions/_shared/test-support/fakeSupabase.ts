// supabase/functions/_shared/test-support/fakeSupabase.ts
// BER-49: servidor HTTP mínimo que imita o suficiente do PostgREST e do GoTrue
// para os handlers rodarem de verdade em teste (com Supabase "mockado"), sem
// bater num projeto Supabase real. Não é um clone fiel do PostgREST — só o
// necessário para os padrões que os handlers deste repo realmente usam: filtro
// `eq`, `.single()`, insert, upsert com `on_conflict` e update.
//
// Helper de teste — não é código de produção, não é importado por nenhuma function.

export interface FakeUser {
  id: string;
  [key: string]: unknown;
}

export interface FakeSupabaseOptions {
  tables?: Record<string, Record<string, unknown>[]>;
  /** token do JWT (sem "Bearer ") -> usuário que `/auth/v1/user` deve devolver. */
  users?: Record<string, FakeUser>;
}

export interface RecordedCall {
  method: string;
  path: string;
  body: unknown;
}

export interface FakeSupabase {
  url: string;
  tables: Record<string, Record<string, unknown>[]>;
  /** Toda chamada recebida, na ordem — útil para provar que um dispatch aconteceu. */
  calls: RecordedCall[];
  close(): Promise<void>;
}

/**
 * Resolução de embed de um nível (ex: `select=...,chapters(end_page,book_id)`
 * a partir de `questions`). Só entra em ação quando a linha (fixture ou
 * criada em runtime por um handler) ainda não tem essa chave — uma fixture que
 * já embutiu o objeto à mão continua tendo prioridade. Assume a convenção deste
 * banco: a FK é `<nome-da-tabela-no-singular>_id` (ex: `chapters` → `chapter_id`).
 * Não resolve embeds aninhados por conta própria — se a tabela relacionada já
 * carrega os dela (como `chapters` carrega `book_contents`/`books` nas fixtures
 * deste repo), eles vêm juntos de graça.
 */
function resolveEmbeds(
  row: Record<string, unknown>,
  selectParam: string | null,
  tables: Record<string, Record<string, unknown>[]>,
): Record<string, unknown> {
  if (!selectParam) return row;
  const embedNames = [...selectParam.matchAll(/(\w+)\(/g)].map((m) => m[1]);
  if (embedNames.length === 0) return row;

  const result = { ...row };
  for (const name of embedNames) {
    if (result[name] !== undefined) continue;
    const relatedTable = tables[name];
    if (!relatedTable) continue;
    const fk = name.endsWith('s') ? `${name.slice(0, -1)}_id` : `${name}_id`;
    if (!(fk in row)) continue;
    const match = relatedTable.find((r) => r.id === row[fk]);
    if (match) result[name] = match;
  }
  return result;
}

function matchesFilters(row: Record<string, unknown>, params: URLSearchParams): boolean {
  for (const [key, value] of params) {
    if (key === 'select' || key === 'on_conflict' || key === 'order' || key === 'limit') continue;
    const eq = value.match(/^eq\.(.*)$/);
    if (!eq) continue;
    if (String(row[key]) !== eq[1]) return false;
  }
  return true;
}

function jsonHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json' };
}

/**
 * Um objeto JS só tem as chaves que alguém atribuiu; uma linha do Postgres tem
 * TODAS as colunas, com `NULL` para as que ninguém preencheu. Código real
 * distingue `null` de "a chave nem existe" (ex: `isClaimable` em
 * generate-questions/claim.ts) — sem isso, uma linha nova criada por um insert
 * parcial (`{chapter_id, status}`) teria `last_attempt_at: undefined`, não
 * `null`, e essa distinção muda o resultado.
 */
const COLUMN_DEFAULTS: Record<string, Record<string, unknown>> = {
  chapter_quiz_status: { attempts: 0, last_attempt_at: null, error_message: null },
};

/**
 * UNIQUE constraints que existem no banco real e que algum handler depende de
 * violar de propósito (ex: `answers` UNIQUE(question_id, user_id) — BER-48 conta
 * com o 23505 do Postgres para recusar uma segunda resposta sem fazer o SELECT
 * primeiro, o que teria a mesma corrida check-then-insert da BER-41).
 */
const UNIQUE_CONSTRAINTS: Record<string, string[]> = {
  answers: ['question_id', 'user_id'],
};

export function startFakeSupabase(options: FakeSupabaseOptions = {}): FakeSupabase {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const [name, rows] of Object.entries(options.tables ?? {})) {
    tables[name] = rows.map((r) => ({ ...r }));
  }
  const users = options.users ?? {};
  const calls: RecordedCall[] = [];

  function respond(rows: Record<string, unknown>[], single: boolean): Response {
    if (single) {
      if (rows.length !== 1) {
        return new Response(JSON.stringify({ message: 'no rows found' }), {
          status: 406,
          headers: jsonHeaders(),
        });
      }
      return new Response(JSON.stringify(rows[0]), { headers: jsonHeaders() });
    }
    return new Response(JSON.stringify(rows), { headers: jsonHeaders() });
  }

  const server = Deno.serve({ port: 0, onListen: () => {} }, async (req) => {
    const url = new URL(req.url);
    const method = req.method;
    const rawBody = method === 'GET' || method === 'DELETE' ? null : await req.text();
    const body = rawBody ? JSON.parse(rawBody) : null;
    calls.push({ method, path: url.pathname + url.search, body });

    if (url.pathname === '/auth/v1/user') {
      const auth = req.headers.get('authorization') ?? '';
      const token = auth.replace(/^Bearer\s+/i, '');
      const user = users[token];
      if (!user) {
        return new Response(JSON.stringify({ message: 'invalid token' }), {
          status: 401,
          headers: jsonHeaders(),
        });
      }
      return new Response(JSON.stringify(user), { headers: jsonHeaders() });
    }

    const restMatch = url.pathname.match(/^\/rest\/v1\/(.+)$/);
    if (restMatch) {
      const table = restMatch[1];
      tables[table] ??= [];
      const wantsSingle = (req.headers.get('accept') ?? '').includes('vnd.pgrst.object+json');

      if (method === 'GET') {
        const rows = tables[table]
          .filter((r) => matchesFilters(r, url.searchParams))
          .map((r) => resolveEmbeds(r, url.searchParams.get('select'), tables));
        return respond(rows, wantsSingle);
      }

      if (method === 'POST') {
        const onConflict = url.searchParams.get('on_conflict');
        const uniqueKeys = UNIQUE_CONSTRAINTS[table];
        const items = Array.isArray(body) ? body : [body];
        const affected: Record<string, unknown>[] = [];
        for (const item of items) {
          if (!onConflict && uniqueKeys) {
            const violates = tables[table].some((r) =>
              uniqueKeys.every((k) => r[k] === (item as any)[k]));
            if (violates) {
              return new Response(JSON.stringify({
                code: '23505',
                message: `duplicate key value violates unique constraint on (${uniqueKeys.join(', ')})`,
                details: null,
                hint: null,
              }), { status: 409, headers: jsonHeaders() });
            }
          }

          let matched: Record<string, unknown> | undefined;
          if (onConflict) {
            const keys = onConflict.split(',');
            matched = tables[table].find((r) => keys.every((k) => r[k] === (item as any)[k]));
          }
          if (matched) {
            Object.assign(matched, item);
            affected.push(matched);
          } else {
            const row = {
              id: crypto.randomUUID(),
              ...(COLUMN_DEFAULTS[table] ?? {}),
              ...(item as Record<string, unknown>),
            };
            tables[table].push(row);
            affected.push(row);
          }
        }
        return respond(affected, wantsSingle);
      }

      if (method === 'PATCH') {
        const rows = tables[table].filter((r) => matchesFilters(r, url.searchParams));
        for (const row of rows) Object.assign(row, body as Record<string, unknown>);
        return respond(rows, wantsSingle);
      }
    }

    // Chamada para outra rota (ex: /functions/v1/algo) que o teste não precisa
    // interceptar diretamente — resposta vazia neutra.
    return new Response('{}', { headers: jsonHeaders() });
  });

  const addr = server.addr as Deno.NetAddr;
  return {
    url: `http://127.0.0.1:${addr.port}`,
    tables,
    calls,
    close: () => server.shutdown(),
  };
}
