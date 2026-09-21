import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Guarda de teclado — nasceu de um defeito real, achado em aparelho (BER-121).
 *
 * No iPhone, o teclado cobria o campo e o botao `Enviar` do quiz: o leitor nao
 * conseguia responder, e o loop central do produto ficava inalcancavel no iOS.
 * A suite inteira estava verde.
 *
 * A causa e estrutural, nao de logica. Com `behavior="padding"` o React Native
 * calcula o quanto empurrar a partir da distancia entre o TOPO DA JANELA e o
 * teclado. Quando o `KeyboardAvoidingView` nao comeca em y=0 — porque tem inset
 * de topo e cabecalho do `Screen` acima dele — o valor sai menor que o
 * necessario, e sobra exatamente a altura do cabecalho por baixo do teclado.
 *
 * Ou seja: o mesmo codigo funciona ou nao dependendo de QUEM ENVOLVE QUEM. Isso
 * nao aparece em teste de unidade (o componente renderiza igual nos dois casos)
 * e nao aparece em emulador com teclado de hardware. So aparece com o dedo na
 * tela — que e o lugar mais caro de descobrir.
 *
 * Por isso a guarda le a ORDEM no fonte: o `KeyboardAvoidingView` tem que abrir
 * ANTES do `Screen`. E heuristica de texto, nao AST, no mesmo espirito da
 * guarda de rotas: cobre o defeito que de fato aconteceu, sem pagar por
 * analise sintatica.
 */

const RAIZ = join(__dirname, '..', '..');

function telas(dir: string): string[] {
  let entradas: string[];
  try { entradas = readdirSync(join(RAIZ, dir)); } catch { return []; }
  return entradas.flatMap((nome) => {
    const caminho = join(RAIZ, dir, nome);
    if (statSync(caminho).isDirectory()) return telas(join(dir, nome));
    return /\.tsx$/.test(nome) ? [join(dir, nome).replace(/\\/g, '/')] : [];
  });
}

const ARQUIVOS = [...telas('app'), ...telas('src/features')];

const ler = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');

/**
 * Excecao nominal, com motivo — mesmo padrao das outras guardas.
 *
 * `app/register-reading.tsx` tem a MESMA forma que quebrou o quiz, mas nao foi
 * confirmada em aparelho: a tela e apresentada como sheet, o que muda a
 * geometria, e o campo dela e numerico e curto (o teclado cobre menos). Trocar
 * as duas de uma vez seria mexer no que nao se mediu.
 *
 * TIRE DAQUI assim que alguem abrir a tela num iPhone e decidir — e o pedido
 * esta escrito na BER-121.
 */
const EXCECAO = new Map<string, string>([
  ['app/register-reading.tsx', 'BER-121: mesma forma, sheet, nao confirmado em aparelho'],
]);

/** Arquivos que usam os dois: so eles tem essa regra pra cumprir. */
const COM_TECLADO = ARQUIVOS.filter((rel) => {
  const codigo = ler(rel);
  return codigo.includes('<KeyboardAvoidingView') && codigo.includes('<Screen');
});

describe('guarda: o KeyboardAvoidingView envolve o Screen', () => {
  it('existe pelo menos uma tela com os dois, senao a guarda nao guarda nada', () => {
    expect(COM_TECLADO.length).toBeGreaterThan(0);
  });

  it.each(COM_TECLADO.filter((rel) => !EXCECAO.has(rel)))(
    '%s abre o KeyboardAvoidingView antes do Screen',
    (rel) => {
      const codigo = ler(rel);
      const kav = codigo.indexOf('<KeyboardAvoidingView');
      const screen = codigo.indexOf('<Screen');
      // Mensagem no objeto para o erro dizer o que fazer, nao so "false".
      expect({ arquivo: rel, kavEnvolveScreen: kav < screen }).toEqual({
        arquivo: rel,
        kavEnvolveScreen: true,
      });
    },
  );

  // Tripwire inverso: excecao que deixou de ser necessaria e cobertura perdida
  // em silencio. Se alguem consertar o register-reading e esquecer de tirar
  // daqui, este teste avisa.
  it('nenhuma exceção já está no formato certo', () => {
    const jaCorretas = [...EXCECAO.keys()].filter((rel) => {
      const codigo = ler(rel);
      return codigo.indexOf('<KeyboardAvoidingView') < codigo.indexOf('<Screen');
    });
    expect(jaCorretas).toEqual([]);
  });

  it('toda exceção ainda existe e ainda usa os dois componentes', () => {
    for (const rel of EXCECAO.keys()) {
      expect(COM_TECLADO).toContain(rel);
    }
  });
});
