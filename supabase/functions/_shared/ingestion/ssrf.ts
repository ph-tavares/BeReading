// supabase/functions/_shared/ingestion/ssrf.ts
// O worker baixa URLs vindas de uma busca na internet (BER-59, spec §5.9). Sem esta
// guarda, uma URL maliciosa faria a Edge Function requisitar endereços internos
// (metadados de nuvem, serviços da rede do Supabase). Cada redirecionamento passa aqui.

export type ResolveFn = (hostname: string) => Promise<string[] | null>;

export class UnsafeUrlError extends Error {}

function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null;
    value = value * 256 + Number(part);
  }
  return value;
}

const IPV4_BLOCKED: [string, number][] = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

function isPrivateIpv4(v4: number): boolean {
  return IPV4_BLOCKED.some(([base, bits]) => {
    const start = ipv4ToNumber(base)!;
    return v4 >= start && v4 < start + 2 ** (32 - bits);
  });
}

/** Expande um IPv6 (com `::` e cauda IPv4 opcional) em 8 hextetos; `null` se não for IPv6 válido. */
function expandIpv6(address: string): number[] | null {
  let text = address;
  const lastColon = text.lastIndexOf(':');
  if (lastColon < 0) return null;
  const last = text.slice(lastColon + 1);
  if (last.includes('.')) {
    const v4 = ipv4ToNumber(last);
    if (v4 === null) return null;
    text = `${text.slice(0, lastColon + 1)}${Math.floor(v4 / 65536).toString(16)}:${(v4 % 65536).toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const groups = (half: string) => (half === '' ? [] : half.split(':'));
  const head = groups(halves[0]);
  const tail = halves.length === 2 ? groups(halves[1]) : [];
  if (![...head, ...tail].every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  const explicit = head.length + tail.length;
  if (halves.length === 1 ? explicit !== 8 : explicit > 7) return null;
  const fill = halves.length === 2 ? Array(8 - explicit).fill('0') : [];
  return [...head, ...fill, ...tail].map((g) => parseInt(g, 16));
}

export function isPrivateAddress(ip: string): boolean {
  const address = ip.replace(/^\[|\]$/g, '').toLowerCase();
  const v4 = ipv4ToNumber(address);
  if (v4 !== null) return isPrivateIpv4(v4);

  // BER-59: `new URL` normaliza `[::ffff:127.0.0.1]` para `[::ffff:7f00:1]`, e NAT64/6to4
  // também levam a um IPv4. Sem expandir e extrair o IPv4 embutido, esses endereços
  // passariam pela guarda e alcançariam loopback ou metadados de nuvem.
  const h = expandIpv6(address);
  if (h === null) return true; // não é IP reconhecível: recusa (fail-closed)
  const embedded = () => isPrivateIpv4(h[6] * 65536 + h[7]);
  const zeros = (n: number) => h.slice(0, n).every((x) => x === 0);
  if (zeros(8)) return true; // ::
  if (zeros(7) && h[7] === 1) return true; // ::1
  if (zeros(5) && h[5] === 0xffff) return embedded(); // IPv4-mapped ::ffff:0:0/96
  if (zeros(6)) return embedded(); // IPv4-compatible ::/96
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) return embedded(); // NAT64 64:ff9b::/96
  if (h[0] === 0x2002) return isPrivateIpv4(h[1] * 65536 + h[2]); // 6to4 2002::/16
  if ((h[0] & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((h[0] & 0xffc0) === 0xfe80) return true; // fe80::/10
  return (h[0] & 0xff00) === 0xff00; // ff00::/8 multicast
}

export async function assertPublicUrl(raw: string, resolve: ResolveFn): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError(`URL inválida: ${raw}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UnsafeUrlError(`esquema recusado: ${url.protocol}`);
  if (url.username || url.password) throw new UnsafeUrlError('URL com credencial');

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (ipv4ToNumber(host) !== null || host.includes(':')) {
    if (isPrivateAddress(host)) throw new UnsafeUrlError(`IP não público: ${host}`);
    return url;
  }
  if (host === 'localhost' || host.endsWith('.localhost') || !host.includes('.')) {
    throw new UnsafeUrlError(`host não público: ${host}`);
  }
  const addresses = await resolve(host);
  if (addresses === null) return url;
  if (addresses.length === 0) throw new UnsafeUrlError(`${host} não resolve`);
  if (addresses.some(isPrivateAddress)) throw new UnsafeUrlError(`${host} resolve para IP não público`);
  return url;
}

/**
 * Constrói um `ResolveFn` a partir de um resolvedor de DNS (BER-59, spec §5.9). Sem
 * `resolver` (runtime não expõe DNS), devolve `null` — fallback para a checagem de host em
 * `assertPublicUrl`. Caso contrário, consulta A e AAAA: uma rejeição `Deno.errors.NotFound`
 * conta como "sem registros" para aquele tipo; qualquer outra rejeição (timeout, permissão,
 * `NotSupported`, rede) vira `TypeError` com o host, que `isTransientError` trata como
 * transitório (BER-59): o passo é repetido em vez de recusar a URL por engano ou falhar de vez
 * com um erro que a fila classificaria como permanente. O resultado é a concatenação dos endereços
 * encontrados (possivelmente `[]`, e então `assertPublicUrl` recusa por fail-closed).
 */
export function makeResolve(
  resolver: ((host: string, type: 'A' | 'AAAA') => Promise<string[]>) | undefined,
): ResolveFn {
  if (!resolver) return () => Promise.resolve(null);
  return async (hostname) => {
    const lookup = async (type: 'A' | 'AAAA'): Promise<string[]> => {
      try {
        return await resolver(hostname, type);
      } catch (err) {
        if (err instanceof Deno.errors.NotFound) return [];
        const message = err instanceof Error ? err.message : String(err);
        throw new TypeError(`DNS falhou para ${hostname}: ${message}`);
      }
    };
    const [a, aaaa] = await Promise.all([lookup('A'), lookup('AAAA')]);
    return [...a, ...aaaa];
  };
}

/**
 * Em produção a checagem de IP não pode ser pulada em silêncio (BER-59, spec §5.9): se o runtime
 * não expuser DNS, `null` faria `assertPublicUrl` aceitar qualquer host com ponto, inclusive um
 * nome que aponta para a rede interna. Sem DNS o host é recusado (`[]`, "não resolve"), a menos
 * que `allowNoDns` libere de propósito.
 */
export function requireDns(resolve: ResolveFn, allowNoDns: boolean): ResolveFn {
  return async (hostname) => {
    const addresses = await resolve(hostname);
    return addresses === null && !allowNoDns ? [] : addresses;
  };
}

export const defaultResolve: ResolveFn = makeResolve(
  typeof Deno.resolveDns === 'function' ? (h, t) => Deno.resolveDns(h, t) : undefined,
);
