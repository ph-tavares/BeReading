import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Guarda de rotas — nasceu de um defeito real da F3 (BER-77).
 *
 * A F3 trocou `app/reading-success.tsx` por um `<Redirect href="/" />` com a
 * justificativa, escrita no plano, de que a rota so existia pra nao quebrar
 * link antigo. Era falso: `app/register-reading.tsx` navegava pra la em duas
 * linhas. O resultado foi o caminho MAIS COMUM do app — registrar leitura sem
 * fechar capitulo — largando o usuario na Home sem confirmacao nenhuma.
 *
 * Nenhuma suite pegou. Cada arquivo, sozinho, estava certo: a tela redirecionava
 * como o codigo dizia, e o register-reading navegava como sempre navegou. O
 * defeito so existe no par. Guarda por arquivo nao ve par, entao esta guarda le
 * o grafo: quem navega pra onde, e o que tem do outro lado.
 *
 * Limite conhecido e aceito: so enxerga alvo em string literal. Rota montada com
 * template (`/book/${id}`) fica de fora. Cobrir isso pediria analise de AST, e o
 * ganho nao paga — o defeito que aconteceu foi com literal.
 */

const RAIZ = join(__dirname, '..', '..');
const APP = join(RAIZ, 'app');

function rotasNoDisco(dir = 'app'): string[] {
  return readdirSync(join(RAIZ, dir)).flatMap((nome) => {
    const caminho = join(RAIZ, dir, nome);
    if (statSync(caminho).isDirectory()) return rotasNoDisco(join(dir, nome));
    return /\.tsx$/.test(nome) ? [join(dir, nome).replace(/\\/g, '/')] : [];
  });
}

const ARQUIVOS = rotasNoDisco();

/** `app/(tabs)/catalogo.tsx` -> `/(tabs)/catalogo` e `/catalogo`. Grupo entre
 *  parenteses nao aparece na URL, entao a mesma tela responde pelos dois. */
function urlsDe(arquivo: string): string[] {
  const semExt = arquivo.replace(/^app/, '').replace(/\.tsx$/, '');
  const comIndex = semExt.replace(/\/index$/, '') || '/';
  const semGrupo = comIndex.replace(/\/\([^)]+\)/g, '') || '/';
  return [...new Set([comIndex, semGrupo])];
}

const MAPA = new Map<string, string>();
for (const arquivo of ARQUIVOS) {
  if (/_layout\.tsx$/.test(arquivo)) continue;
  for (const url of urlsDe(arquivo)) {
    if (!MAPA.has(url)) MAPA.set(url, arquivo);
  }
}

/** Remove comentario de bloco e de linha, pra nao ler codigo que nao roda. */
function semComentario(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Alvos de navegacao escritos como string literal em `app/`.
 *
 * Ignora comentario: `app/chapter-complete.tsx` tem um comentario explicando
 * que o sheet de registrar leitura vai chamar `router.replace('/chapter-complete')`
 * na F4. Sem esta limpeza a guarda lia isso como navegacao real e inventava uma
 * aresta que nao existe no app — e uma aresta inventada tanto pode passar
 * sozinha quanto reprovar uma tela por um caminho que ninguem percorre.
 */
function alvosDe(bruto: string): string[] {
  const codigo = semComentario(bruto);
  const achados = [
    ...codigo.matchAll(/pathname:\s*'([^']+)'/g),
    ...codigo.matchAll(/router\.(?:push|replace|navigate)\(\s*'([^']+)'/g),
    ...codigo.matchAll(/href=\{?['"]([^'"]+)['"]/g),
  ];
  return [...new Set(achados.map((m) => m[1]).filter((u) => u.startsWith('/')))];
}

const NAVEGACOES = ARQUIVOS.flatMap((arquivo) =>
  alvosDe(readFileSync(join(RAIZ, arquivo), 'utf8')).map((alvo) => ({ arquivo, alvo }))
);

/**
 * Prefixo estatico de rota montada com template: `/book/${id}` da `/book/`.
 * Rota dinamica quase nunca e navegada por string literal, entao sem isto ela
 * pareceria inalcancavel pela checagem abaixo.
 */
function prefixosDe(bruto: string): string[] {
  const codigo = semComentario(bruto);
  const achados = [...codigo.matchAll(/`(\/[^`$]*)\$\{/g)].map((m) => m[1]);
  return [...new Set(achados)];
}

const PREFIXOS = new Set(ARQUIVOS.flatMap((a) => prefixosDe(readFileSync(join(RAIZ, a), 'utf8'))));
const ALVOS = new Set(NAVEGACOES.map((n) => n.alvo));

/** As quatro abas: o TabBar navega por `route.name`, nao por caminho. */
const ABAS = /^app\/\(tabs\)\//;

/**
 * Rota que existe, esta registrada, e que **ninguem alcanca**. Cada entrada e
 * divida com prazo, nao permissao permanente, e o teste logo abaixo obriga a
 * lista a encolher sozinha.
 */
const SEM_CHAMADOR: Record<string, string> = {
  // Vazia desde a F4 Tarefa 5. A unica entrada era app/chapter-complete.tsx
  // (placeholder da F3), e o sheet de registrar leitura passou a navegar pra
  // ela quando o servidor devolve capitulo fechado.
};

function alcancavel(arquivo: string): boolean {
  if (ABAS.test(arquivo)) return true;
  const urls = urlsDe(arquivo);
  if (urls.some((u) => ALVOS.has(u))) return true;
  return urls.some((u) => [...PREFIXOS].some((p) => u.startsWith(p)));
}

/**
 * O espelho da checagem de cima, e a que faltava.
 *
 * A primeira pergunta "quem navega pra ca chega em tela de verdade?". Esta
 * pergunta o contrario: "esta tela, alguem alcanca?". As duas nasceram de
 * defeitos reais da F3, do mesmo tamanho e em sentidos opostos:
 *
 * - `reading-success` continuou sendo alvo de navegacao, mas virou um redirect
 *   mudo. Destino sem conteudo.
 * - `register-reading` continuou intacta, mas a F3 trocou o CustomTabBar (que
 *   tinha o FAB, o unico caminho do app inteiro pra ela) pelo TabBar novo, que
 *   nao tem. Conteudo sem destino: a acao central do produto ficou inalcancavel
 *   e a suite inteira seguiu verde. Pior, o teste do TabBar novo AFIRMA que o
 *   FAB sumiu (`queryByTestId('fab-registrar')` nulo) sem nada checar se a
 *   funcao dele foi pra algum lugar.
 */
describe('guarda: toda tela registrada tem quem a alcance', () => {
  const TELAS = ARQUIVOS.filter((a) => !/_layout\.tsx$/.test(a));

  it.each(TELAS)('%s e alcancavel, ou esta declarada sem chamador', (arquivo) => {
    if (SEM_CHAMADOR[arquivo]) return;
    expect({ arquivo, alcancavel: alcancavel(arquivo) }).toEqual({ arquivo, alcancavel: true });
  });

  // Tripwire inverso, mesma regra das outras guardas: exceção que deixou de ser
  // necessaria e' cobertura perdida em silencio.
  //
  // Um `it` so, e nao `it.each`: com a lista vazia (o estado bom, desde a F4
  // Tarefa 5), `it.each([])` quebra o Jest em vez de passar. Enquanto a lista
  // estiver vazia este teste nao checa nada; ele fica para a proxima entrada
  // que alguem acrescentar.
  it('nenhuma entrada de SEM_CHAMADOR ja tem quem navegue pra ca', () => {
    const jaAlcancaveis = Object.keys(SEM_CHAMADOR).filter((arquivo) => alcancavel(arquivo));
    // Se reprovar: tire estas linhas de SEM_CHAMADOR em rotas.test.ts.
    expect(jaAlcancaveis).toEqual([]);
  });

  it('a leitura de prefixo pega rota montada com template', () => {
    expect(prefixosDe('router.push(`/book/${id}`)')).toEqual(['/book/']);
    expect(prefixosDe("// router.push(`/nada/${x}`)")).toEqual([]);
  });

  it('reconhece o defeito real: sem o botao da Hoje, register-reading fica orfa', () => {
    // Simula o estado em que a branch esteve: nenhum arquivo navegando pra la.
    const alvosSemBotao = new Set([...ALVOS].filter((u) => u !== '/register-reading'));
    const orfa = !alvosSemBotao.has('/register-reading');
    expect(orfa).toBe(true);
    // E hoje, com o botao de volta, ela e alcancavel de novo.
    expect(alcancavel('app/register-reading.tsx')).toBe(true);
  });
});

/** Componente cujo corpo inteiro e um `<Redirect ...>`, sem ramo nenhum. */
function soRedireciona(bruto: string): boolean {
  const codigo = semComentario(bruto);
  if (!/\bRedirect\b/.test(codigo)) return false;
  const retornos = [...codigo.matchAll(/return\s*(\(\s*)?<\s*(\w+)/g)].map((m) => m[2]);
  return retornos.length > 0 && retornos.every((tag) => tag === 'Redirect');
}

describe('guarda: o grafo de navegacao aponta pra tela de verdade', () => {
  it('existe navegacao com alvo literal pra vigiar', () => {
    // Se este numero cair pra zero, a extracao quebrou e as duas checagens
    // abaixo viraram it.each de lista vazia, que passa sem testar nada.
    expect(NAVEGACOES.length).toBeGreaterThanOrEqual(8);
  });

  it.each(NAVEGACOES.map(({ arquivo, alvo }) => [`${arquivo} -> ${alvo}`, alvo] as const))(
    '%s cai numa rota que existe',
    (_titulo, alvo) => {
      expect(MAPA.get(alvo)).toBeDefined();
    }
  );

  it.each(NAVEGACOES.map(({ arquivo, alvo }) => [`${arquivo} -> ${alvo}`, alvo] as const))(
    '%s cai numa tela que mostra algo, nao num redirect mudo',
    (_titulo, alvo) => {
      const destino = MAPA.get(alvo);
      if (!destino) return; // ja reprovou na checagem de cima
      const codigo = readFileSync(join(RAIZ, destino), 'utf8');
      expect({ destino, soRedireciona: soRedireciona(codigo) }).toEqual({
        destino,
        soRedireciona: false,
      });
    }
  );
});

describe('guarda: a leitura de rota funciona', () => {
  it('resolve grupo, index e raiz', () => {
    expect(urlsDe('app/(tabs)/index.tsx')).toEqual(['/(tabs)', '/']);
    expect(urlsDe('app/(tabs)/catalogo.tsx')).toEqual(['/(tabs)/catalogo', '/catalogo']);
    expect(urlsDe('app/chapter-complete.tsx')).toEqual(['/chapter-complete']);
  });

  it('reconhece o redirect mudo que causou o defeito da F3', () => {
    const defeito = `
      import { Redirect } from 'expo-router';
      export default function Tela() {
        return <Redirect href="/" />;
      }
    `;
    expect(soRedireciona(defeito)).toBe(true);
  });

  it('nao confunde tela que redireciona so num ramo', () => {
    const legitimo = `
      export default function Tela({ logado }) {
        if (!logado) return <Redirect href="/login" />;
        return <View><Text>oi</Text></View>;
      }
    `;
    expect(soRedireciona(legitimo)).toBe(false);
  });

  it('nao acha redirect em comentario', () => {
    const comentado = `
      // antes isso era um <Redirect href="/" />
      export default function Tela() { return <View />; }
    `;
    expect(soRedireciona(comentado)).toBe(false);
  });

  // Defeito real desta guarda, achado no mesmo dia em que ela nasceu:
  // app/chapter-complete.tsx explica num comentario que a F4 vai chamar
  // router.replace('/chapter-complete'), e a guarda contava isso como aresta.
  it('nao le alvo de navegacao dentro de comentario', () => {
    const comentado = `
      // o sheet vai chamar router.replace('/chapter-complete') na F4
      /* e o antigo era pathname: '/rota-antiga' */
      export default function Tela() {
        return <Pressable onPress={() => router.push('/quiz/summary')} />;
      }
    `;
    expect(alvosDe(comentado)).toEqual(['/quiz/summary']);
  });

  it('todas as rotas do disco entraram no mapa', () => {
    expect(APP).toBeTruthy();
    const telas = ARQUIVOS.filter((a) => !/_layout\.tsx$/.test(a));
    expect([...new Set(MAPA.values())].sort()).toEqual(telas.sort());
  });
});
