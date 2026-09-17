import { assertEquals, assertRejects, assertStrictEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { assertPublicUrl, isPrivateAddress, makeResolve, UnsafeUrlError } from './ssrf.ts';

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

Deno.test('isPrivateAddress: IPv4 embutido em IPv6 (mapeado, compatível, NAT64, 6to4), multicast e TEST-NET', () => {
  for (const ip of ['::ffff:7f00:1', '::ffff:a9fe:a9fe', '0:0:0:0:0:ffff:7f00:1', '::7f00:1', '64:ff9b::a9fe:a9fe', '2002:7f00:1::', 'ff02::1', '192.0.2.5']) {
    assertEquals(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['::ffff:808:808', '2002:808:808::', '2606:4700::1111']) {
    assertEquals(isPrivateAddress(ip), false, ip);
  }
});

Deno.test('assertPublicUrl: recusa IPv4 privado escrito como IPv6', async () => {
  const pub = resolvesTo('8.8.8.8');
  for (const raw of ['http://[::ffff:127.0.0.1]/', 'http://[::ffff:169.254.169.254]/', 'http://[::127.0.0.1]/', 'http://[64:ff9b::a9fe:a9fe]/']) {
    await assertRejects(() => assertPublicUrl(raw, pub), UnsafeUrlError, undefined, raw);
  }
});

Deno.test('makeResolve: sem resolvedor, devolve null (sem DNS no runtime)', async () => {
  assertEquals(await makeResolve(undefined)('example.com'), null);
});

Deno.test('makeResolve: NotFound em um tipo não impede o outro', async () => {
  const resolve = makeResolve((_host, type) => {
    if (type === 'AAAA') return Promise.reject(new Deno.errors.NotFound('x'));
    return Promise.resolve(['8.8.8.8']);
  });
  assertEquals(await resolve('example.com'), ['8.8.8.8']);
});

Deno.test('makeResolve: NotFound nos dois tipos devolve lista vazia', async () => {
  const resolve = makeResolve(() => Promise.reject(new Deno.errors.NotFound('x')));
  assertEquals(await resolve('example.com'), []);
});

Deno.test('makeResolve: erro que não é NotFound é repassado (falha transitória, não recusa)', async () => {
  const timeout = new Error('timeout');
  const resolve = makeResolve((_host, type) => (type === 'A' ? Promise.reject(timeout) : Promise.resolve([])));
  const err = await assertRejects(() => resolve('example.com'));
  assertStrictEquals(err, timeout);
});
