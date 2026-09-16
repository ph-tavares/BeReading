import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { assertPublicUrl, isPrivateAddress, UnsafeUrlError } from './ssrf.ts';

const resolvesTo = (...ips: string[]) => () => Promise.resolve(ips);

Deno.test('isPrivateAddress: faixas privadas, loopback, link-local e metadados de nuvem', () => {
  for (const ip of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.5.4', '172.31.255.255', '192.168.0.1', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
    assertEquals(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '172.32.0.1', '151.101.1.69', '2606:4700::1111']) {
    assertEquals(isPrivateAddress(ip), false, ip);
  }
});

Deno.test('assertPublicUrl: aceita https público', async () => {
  const url = await assertPublicUrl('https://www.gutenberg.org/ebooks/55752', resolvesTo('152.19.134.47'));
  assertEquals(url.hostname, 'www.gutenberg.org');
});

Deno.test('assertPublicUrl: recusa esquema, credencial, IP privado, localhost, host sem ponto e DNS privado', async () => {
  const pub = resolvesTo('8.8.8.8');
  await assertRejects(() => assertPublicUrl('file:///etc/passwd', pub), UnsafeUrlError);
  await assertRejects(() => assertPublicUrl('ftp://example.com/x', pub), UnsafeUrlError);
  await assertRejects(() => assertPublicUrl('https://user:pw@example.com/', pub), UnsafeUrlError);
  await assertRejects(() => assertPublicUrl('http://127.0.0.1/admin', pub), UnsafeUrlError);
  await assertRejects(() => assertPublicUrl('http://[::1]/', pub), UnsafeUrlError);
  await assertRejects(() => assertPublicUrl('http://localhost:8080/', pub), UnsafeUrlError);
  await assertRejects(() => assertPublicUrl('http://intranet/', pub), UnsafeUrlError);
  await assertRejects(() => assertPublicUrl('https://evil.example.com/', resolvesTo('10.0.0.5')), UnsafeUrlError);
});

Deno.test('assertPublicUrl: recusa host que não resolve', async () => {
  const noResolve = () => Promise.resolve([]);
  await assertRejects(() => assertPublicUrl('https://nao-existe-nowhere.test/', noResolve), UnsafeUrlError);
});

Deno.test('assertPublicUrl: aceita quando resolver retorna null (sem DNS no runtime)', async () => {
  const noDns = () => Promise.resolve(null);
  const url = await assertPublicUrl('https://example.com/path', noDns);
  assertEquals(url.hostname, 'example.com');
});
