// supabase/functions/_shared/ingestion/ssrf.ts
// O worker baixa URLs vindas de uma busca na internet (BER-59, spec §5.9). Sem esta
// guarda, uma URL maliciosa faria a Edge Function requisitar endereços internos
// (metadados de nuvem, serviços da rede do Supabase). Cada redirecionamento passa aqui.

export type ResolveFn = (hostname: string) => Promise<string[]>;

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
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

export function isPrivateAddress(ip: string): boolean {
  const address = ip.replace(/^\[|\]$/g, '').toLowerCase();
  const v4 = ipv4ToNumber(address);
  if (v4 !== null) {
    return IPV4_BLOCKED.some(([base, bits]) => {
      const start = ipv4ToNumber(base)!;
      return v4 >= start && v4 < start + 2 ** (32 - bits);
    });
  }
  if (address.startsWith('::ffff:')) return isPrivateAddress(address.slice(7));
  if (address === '::1' || address === '::') return true;
  return /^f[cd]/.test(address) || /^fe[89ab]/.test(address);
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
  if ((await resolve(host)).some(isPrivateAddress)) throw new UnsafeUrlError(`${host} resolve para IP não público`);
  return url;
}

/**
 * A e AAAA via `Deno.resolveDns`. Se o runtime não expuser DNS, devolve lista vazia e vale
 * só a checagem de host acima. Conferir no Edge Runtime na primeira execução real (Tarefa 19).
 */
export const defaultResolve: ResolveFn = async (hostname) => {
  const resolver = (Deno as { resolveDns?: typeof Deno.resolveDns }).resolveDns;
  if (typeof resolver !== 'function') return [];
  const results = await Promise.allSettled([resolver(hostname, 'A'), resolver(hostname, 'AAAA')]);
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
};
