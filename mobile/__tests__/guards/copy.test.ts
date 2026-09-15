import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..');

/** it.each nao aceita lista vazia. Quando a divida de uma lista zera, registra so isso. */
function cadaExcecao(lista: string[]): (nome: string, fn: (rel: string) => void) => void {
  if (lista.length > 0) return it.each(lista) as unknown as (nome: string, fn: (rel: string) => void) => void;
  return (nome: string) => it(nome.replace('%s', 'lista vazia'), () => {});
}

/**
 * Pastas onde o sistema novo ja vale, e que hoje tem pelo menos um arquivo
 * real.
 *
 * src/game entrou nesta rodada: LEVEL_TITLES em src/game/xp.ts ("Rato de
 * biblioteca" etc.) e copy de verdade, exibida na tela, e nao tinha guarda
 * nenhuma de emoji/travessao ate agora — a checagem inversa no fim do
 * arquivo foi o que acusou o buraco. `src/features` entrou na F4 Tarefa 4,
 * quando `src/features/home/` nasceu o primeiro bloco de tela real (ver
 * designTokens.test.ts pro raciocinio completo de por que ela ficava fora
 * antes disso).
 */
// src/utils entrou na R3: paywallCopy e planFeatures (src/utils/billing.ts) sao
// copy que chega na tela, e so as outras duas guardas tratam utils como legado.
const VIGIADAS_COM_CONTEUDO = ['src/ui', 'src/assistant', 'src/game', 'app', 'src/features', 'src/utils'];

const VIGIADAS = VIGIADAS_COM_CONTEUDO;

/** Pastas do sistema "Luminous Library" anterior, que ainda nao migraram
 * (saem na F6). Lista compartilhada pelas tres guardas deste diretorio. */
const LEGADO = ['src/components', 'src/api', 'src/lib', 'src/stores', 'src/types', 'src/theme'];

/**
 * Rodada de correcao 1 (revisao da Tarefa 1): a lista unica
 * `EXCECAO_APP_LEGADO`, compartilhada pelas tres guardas, isentava arquivo
 * inteiro de emoji E travessao mesmo quando ele so violava um dos dois (ou
 * nenhum). Trocada por uma lista por checagem — ver designTokens.test.ts pro
 * raciocinio completo. Cada lista abaixo e local a este arquivo: nenhuma das
 * duas e usada por designTokens.test.ts nem a11y.test.ts, entao nao ha copia
 * cruzada pra decidir manter em modulo compartilhado (ver nota antes do
 * describe de tripwire, mais abaixo).
 *
 * chapter-complete.tsx, register-reading.tsx (reescrito na F4 Tarefa 5) e os
 * tres _layout.tsx nao entram: nao violam nem emoji nem travessao.
 */
const EXCECAO_EMOJI = new Set<string>([
  // src/utils/quizUtils.ts saiu na F9, com o getScoreConfig. A lista esta vazia.
]);

const EXCECAO_TRAVESSAO = new Set<string>([
]);

/**
 * Emoji e travessao: proibidos em texto de interface (DESIGN.md, secao Voice).
 * A faixa de bandeira (Regional Indicator Symbols, U+1F1E6-U+1F1FF) fica ABAIXO
 * da faixa de simbolos e pictogramas (U+1F300+); sem ela, uma bandeira como
 * 🇧🇷 passa pela guarda inteira.
 */
const EMOJI = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const TRAVESSAO = /[—–]/;

function arquivos(dir: string): string[] {
  const abs = join(RAIZ, dir);
  let entradas: string[];
  try { entradas = readdirSync(abs); } catch { return []; }
  return entradas.flatMap((nome) => {
    const caminho = join(abs, nome);
    if (statSync(caminho).isDirectory()) return arquivos(join(dir, nome));
    return /\.tsx?$/.test(nome) ? [join(dir, nome).replace(/\\/g, '/')] : [];
  });
}

const TODOS = VIGIADAS.flatMap(arquivos);

/**
 * So o que vira texto na tela. Comentario pode ter travessao. Alem de `//` e
 * `*` (linha de continuacao de bloco), tambem ignora `/*`: sem isso a primeira
 * linha de um comentario de bloco escapa do filtro e um travessao legitimo
 * logo depois de `/**` reprovaria a guarda.
 */
function linhasDeCodigo(conteudo: string): string[] {
  return conteudo
    .split('\n')
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    });
}

describe('guarda: copy', () => {
  // Checagem por pasta, nao agregada: ver designTokens.test.ts (rodada de
  // correcao 1) pro raciocinio completo de por que o total sozinho nao basta.
  it.each(VIGIADAS_COM_CONTEUDO)('a pasta %s tem arquivo para varrer', (dir) => {
    expect(arquivos(dir).length).toBeGreaterThan(0);
  });

  it.each(TODOS)('%s nao tem emoji', (rel) => {
    if (EXCECAO_EMOJI.has(rel)) return;
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    expect(EMOJI.test(codigo)).toBe(false);
  });

  it.each(TODOS)('%s nao tem travessao em codigo', (rel) => {
    if (EXCECAO_TRAVESSAO.has(rel)) return;
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    expect(TRAVESSAO.test(codigo)).toBe(false);
  });
});

/**
 * A lista de excecao precisa provar que esta viva: falha assim que um
 * arquivo listado deixar de existir, em vez de continuar "protegendo" uma
 * tela que ja migrou ou sumiu (lixo que finge cobertura).
 */
describe('guarda: excecao desta guarda nao aponta pra arquivo fantasma', () => {
  cadaExcecao([...EXCECAO_EMOJI, ...EXCECAO_TRAVESSAO].filter((v, i, arr) => arr.indexOf(v) === i))(
    'excecao %s ainda existe',
    (rel) => {
      expect(existsSync(join(RAIZ, rel))).toBe(true);
    },
  );
});

/**
 * Tripwire inverso (a parte que resolve o problema de verdade, ver
 * designTokens.test.ts pro raciocinio completo): cada arquivo isento precisa
 * provar, a cada rodada, que AINDA viola a checagem que o isenta. Sem isso a
 * lista so encolhe se alguem lembrar quando a Tarefa 4/5/6 reescrever a tela
 * — o mesmo mecanismo que ja falhou nesta branch.
 */
describe('guarda: excecao desta guarda so cobre arquivo que realmente viola', () => {
  cadaExcecao([...EXCECAO_EMOJI])('%s: tripwire EXCECAO_EMOJI ainda tem emoji', (rel) => {
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    if (!EMOJI.test(codigo)) {
      throw new Error(
        `${rel} nao tem mais emoji. Remova esta linha de EXCECAO_EMOJI em copy.test.ts: a excecao parou de proteger qualquer coisa.`,
      );
    }
  });

  cadaExcecao([...EXCECAO_TRAVESSAO])('%s: tripwire EXCECAO_TRAVESSAO ainda tem travessao em codigo', (rel) => {
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    if (!TRAVESSAO.test(codigo)) {
      throw new Error(
        `${rel} nao tem mais travessao em codigo. Remova esta linha de EXCECAO_TRAVESSAO em copy.test.ts: a excecao parou de proteger qualquer coisa.`,
      );
    }
  });
});

/**
 * O buraco: nada aqui acusava uma pasta nova sob src/ que ninguem catalogou
 * (foi assim que src/game ficou de fora desta guarda ate agora, mesmo tendo
 * copy de verdade). Enumera as pastas REAIS de primeiro nivel e falha em
 * qualquer uma que nao esteja nem em VIGIADAS nem em LEGADO.
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
