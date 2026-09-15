import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Regra editorial sem enforcement morre na terceira entrega. Estas guardas sao o
 * que mantem o design system obedecido quando as telas forem migrando (F4 a F6).
 */
const RAIZ = join(__dirname, '..', '..');

/** it.each nao aceita lista vazia. Quando a divida de uma lista zera, registra so isso. */
function cadaExcecao(lista: string[]): (nome: string, fn: (rel: string) => void) => void {
  if (lista.length > 0) return it.each(lista) as unknown as (nome: string, fn: (rel: string) => void) => void;
  return (nome: string) => it(nome.replace('%s', 'lista vazia'), () => {});
}

/**
 * Pastas onde o sistema novo ja vale, e que hoje tem pelo menos um arquivo
 * real. src/components e app/(tabs) entram conforme migram.
 *
 * `src/features` entrou nesta lista na F4 Tarefa 4: antes disso a pasta
 * existia vazia (Tarefa 1 a colocou em VIGIADAS so' para nascer coberta
 * quando ganhasse o primeiro arquivo, sem exigir "tem arquivo para varrer"
 * enquanto ainda nao tinha nenhum). `src/features/home/` foi o primeiro
 * bloco de tela a nascer ali; a partir de agora ela responde pela guarda
 * como qualquer pasta do redesign.
 */
const VIGIADAS_COM_CONTEUDO = ['src/ui', 'src/assistant', 'src/game', 'app', 'src/features'];

const VIGIADAS = VIGIADAS_COM_CONTEUDO;

/**
 * Pastas do sistema "Luminous Library" anterior, que ainda nao migraram (saem
 * na F6). Lista compartilhada pelas tres guardas deste diretorio (a11y, copy
 * e esta) — ver a checagem inversa no fim do arquivo.
 */
const LEGADO = ['src/components', 'src/api', 'src/lib', 'src/stores', 'src/types', 'src/utils', 'src/theme'];

/**
 * Excecoes nominais, com motivo. Qualquer adicao aqui precisa de justificativa
 * no PR — a lista curta e o que dá valor a guarda.
 *
 * Banner.tsx NAO entra aqui: ele so usa cor de tokens (color.dangerSoft,
 * color.danger, color.surface1, color.line). Excecao sem uso enfraquece a
 * guarda e convida a proxima excecao desnecessaria.
 */
const EXCECOES_COR = new Set([
  // Sobreposicao sobre a cor da capa (lombada, filete, sombra): nao e cor de
  // marca, e alpha sobre um fundo que muda por livro.
  'src/ui/Cover.tsx',
]);

/**
 * Rodada de correcao 1 (revisao da Tarefa 1) trocou a lista unica
 * `EXCECAO_APP_LEGADO`, compartilhada pelas tres guardas, por uma lista POR
 * CHECAGEM: quase nenhum arquivo do "Luminous Library" anterior viola as
 * cinco checagens ao mesmo tempo (cor, tipografia, feedback, emoji,
 * travessao, a11y), e isentar o arquivo inteiro escondia checagens que ele
 * ja passava de qualquer jeito — dois arquivos podiam ganhar Alert.alert e
 * ate seis podiam ganhar emoji sem a suite acusar nada. Mesmo raciocinio de
 * `EXCECOES_COR` acima (excecao por categoria, nao por arquivo), agora
 * aplicado tambem a divida de migracao.
 *
 * Cada lista abaixo contem SO os arquivos que hoje realmente violam aquela
 * checagem especifica (conferido rodando a checagem, nao por inspecao). Cada
 * entrada e divida DECLARADA e temporal: sai da lista quando a tela for
 * reescrita e a violacao desaparecer (nunca antes, e o tripwire logo abaixo
 * do describe de cada guarda barra a saida cedo demais).
 *
 * app/chapter-complete.tsx (F3) NAO entra em nenhuma: e novo e limpo, e por
 * isso responde pela guarda como qualquer arquivo de VIGIADAS. O mesmo vale
 * para app/register-reading.tsx desde a F4 Tarefa 5, que o reescreveu no
 * sistema novo. app/_layout.tsx, app/(auth)/_layout.tsx e
 * app/(tabs)/_layout.tsx (tambem tocados na F3) tambem ficam de fora: nenhum
 * tinha cor, fontSize ou Alert.alert literal de verdade.
 */
const EXCECAO_COR = new Set<string>([
]);

/**
 * Todo arquivo de EXCECAO_COR mais os dois (auth) que so violam tipografia:
 * login.tsx e signup.tsx nao tem cor literal, mas tem fontSize/fontFamily
 * solto.
 */
const EXCECAO_TIPOGRAFIA = new Set<string>([...EXCECAO_COR]);

const EXCECAO_FEEDBACK = new Set<string>([
  // Permanente: o dialogo do sistema para confirmacao destrutiva (spec secao 8).
  // O tripwire continua valendo: se o arquivo parar de usar Alert.alert, sai.
  'src/ui/confirmDestructive.ts',
]);

function arquivos(dir: string): string[] {
  const abs = join(RAIZ, dir);
  let entradas: string[];
  try {
    entradas = readdirSync(abs);
  } catch {
    return []; // pasta ainda nao existe nesta fase
  }
  return entradas.flatMap((nome) => {
    const caminho = join(abs, nome);
    if (statSync(caminho).isDirectory()) return arquivos(join(dir, nome));
    return /\.tsx?$/.test(nome) ? [join(dir, nome).replace(/\\/g, '/')] : [];
  });
}

const TODOS = VIGIADAS.flatMap(arquivos);

/**
 * As tres guardas deste arquivo leem so o que vira codigo de verdade, nunca
 * comentario. Sem isso, um comentario que explica por que o componente NAO usa
 * Alert.alert (citando o nome da API) reprova a guarda por engano — quem
 * documenta a decisao certa e punido do mesmo jeito que quem comete o
 * anti-pattern. O mesmo vale para cor: "ver issue #123" tem digitos que passam
 * por hex se o comentario nao for descartado antes do match. Alem de `//` e `*`
 * (linha de continuacao de bloco), tambem ignora `/*`: sem isso a primeira
 * linha de um comentario de bloco escapa do filtro.
 */
function linhasDeCodigo(conteudo: string): string[] {
  return conteudo
    .split('\n')
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    });
}

describe('guarda: cor', () => {
  // Checagem por pasta, nao agregada: se TODOS.length>0 dependesse so do total,
  // src/ui podia sumir ou ser renomeada que src/assistant e src/game ainda
  // manteriam o numero positivo, nenhum it.each rodaria pra src/ui e a guarda
  // passaria protegendo nada. Isso acusa pasta renomeada ou movida.
  it.each(VIGIADAS_COM_CONTEUDO)('a pasta %s tem arquivo para varrer', (dir) => {
    expect(arquivos(dir).length).toBeGreaterThan(0);
  });

  it.each(TODOS)('%s nao tem cor literal fora dos tokens', (rel) => {
    if (EXCECOES_COR.has(rel)) return;
    if (EXCECAO_COR.has(rel)) return;
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    const achados = codigo.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? [];
    expect(achados).toEqual([]);
  });
});

describe('guarda: tipografia', () => {
  // Sem lista de isencao: os quatro arquivos que antes eram "isentos" (Text,
  // Field, PageField, Cover) nunca tinham fontSize/fontFamily literal — a
  // isencao nao protegia nada e, pior, escondia justamente o arquivo que existe
  // pra acabar com os tamanhos soltos do app antigo. Se um dia precisar mesmo
  // de literal, a guarda acusa e a excecao volta nominal, com motivo escrito
  // (mesma regra do EXCECOES_COR). EXCECAO_TIPOGRAFIA e diferente: e divida
  // de migracao, nao decisao de design, e por isso vale aqui tambem.
  it.each(TODOS)('%s nao tem fontSize nem fontFamily literal', (rel) => {
    if (EXCECAO_TIPOGRAFIA.has(rel)) return;
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    expect(codigo).not.toMatch(/fontSize:\s*\d/);
    expect(codigo).not.toMatch(/fontFamily:\s*['"]/);
  });
});

describe('guarda: feedback', () => {
  it.each(TODOS)('%s nao usa Alert.alert', (rel) => {
    if (EXCECAO_FEEDBACK.has(rel)) return;
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    expect(codigo).not.toMatch(/Alert\.alert/);
  });
});

/**
 * A lista de excecao precisa provar que esta viva. Excecao apontando pra
 * arquivo apagado e lixo que finge cobertura: a tela "migrou" (ou sumiu) e a
 * entrada continuou aqui, escondendo que ninguem tirou a divida da lista.
 * Isso apodrece ao longo de seis fases se ninguem checar. Este teste falha
 * assim que um arquivo listado deixar de existir.
 */
describe('guarda: excecao desta guarda nao aponta pra arquivo fantasma', () => {
  cadaExcecao([...EXCECAO_COR, ...EXCECAO_TIPOGRAFIA, ...EXCECAO_FEEDBACK].filter((v, i, arr) => arr.indexOf(v) === i))(
    'excecao %s ainda existe',
    (rel) => {
      expect(existsSync(join(RAIZ, rel))).toBe(true);
    },
  );
});

/**
 * O tripwire inverso, que e a metade que realmente resolve o problema: sem
 * ele, a lista so encolhe se alguem lembrar de tirar a entrada quando a tela
 * for reescrita — exatamente o mecanismo que ja falhou nesta branch (revisao
 * da Tarefa 1). Cada arquivo isento precisa provar, a cada rodada da suite,
 * que AINDA viola a checagem que o isenta. No dia que a Tarefa 4, 5 ou 6
 * reescrever a tela e a violacao sumir, este teste vira vermelho na hora —
 * nao silencioso — com uma mensagem que diz o arquivo, a checagem e a acao
 * (tirar da lista), em vez de deixar a excecao "proteger" uma tela que ja
 * ficou limpa.
 */
describe('guarda: excecao desta guarda so cobre arquivo que realmente viola', () => {
  cadaExcecao([...EXCECAO_COR])('%s: tripwire EXCECAO_COR ainda tem cor literal fora dos tokens', (rel) => {
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    const achados = codigo.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? [];
    if (achados.length === 0) {
      throw new Error(
        `${rel} nao tem mais cor literal fora dos tokens. Remova esta linha de EXCECAO_COR em designTokens.test.ts: a excecao parou de proteger qualquer coisa.`,
      );
    }
  });

  cadaExcecao([...EXCECAO_TIPOGRAFIA])('%s: tripwire EXCECAO_TIPOGRAFIA ainda tem fontSize ou fontFamily literal', (rel) => {
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    const violaFontSize = /fontSize:\s*\d/.test(codigo);
    const violaFontFamily = /fontFamily:\s*['"]/.test(codigo);
    if (!violaFontSize && !violaFontFamily) {
      throw new Error(
        `${rel} nao tem mais fontSize/fontFamily literal. Remova esta linha de EXCECAO_TIPOGRAFIA em designTokens.test.ts: a excecao parou de proteger qualquer coisa.`,
      );
    }
  });

  cadaExcecao([...EXCECAO_FEEDBACK])('%s: tripwire EXCECAO_FEEDBACK ainda usa Alert.alert', (rel) => {
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    if (!/Alert\.alert/.test(codigo)) {
      throw new Error(
        `${rel} nao usa mais Alert.alert. Remova esta linha de EXCECAO_FEEDBACK em designTokens.test.ts: a excecao parou de proteger qualquer coisa.`,
      );
    }
  });
});

/**
 * O buraco que as guardas acima nao cobriam: elas so sabem varrer o que ja
 * esta em VIGIADAS. Uma pasta nova sob src/ (ninguem lembrou de adicionar
 * aqui nem em LEGADO) nao acusava nada — nem cor solta, nem fontSize solto,
 * nem Alert.alert eram barrados nela, e o silencio parecia aprovacao. Esta
 * checagem inverte o sentido: enumera as pastas REAIS de primeiro nivel de
 * src/ e falha em qualquer uma que nao esteja nem vigiada nem catalogada
 * como legado. Pasta nova nasce coberta (alguem decide o balde) ou acusa —
 * nunca fica muda.
 */
describe('guarda: pasta nova nasce coberta ou acusa', () => {
  it('todo diretorio de primeiro nivel de src/ esta em VIGIADAS ou em LEGADO', () => {
    const raizSrc = join(RAIZ, 'src');
    const dirs = readdirSync(raizSrc).filter((nome) => statSync(join(raizSrc, nome)).isDirectory());
    const conhecidas = new Set([...VIGIADAS, ...LEGADO].map((p) => p.replace('src/', '')));
    for (const dir of dirs) {
      expect(conhecidas.has(dir)).toBe(true);
    }
  });
});
