import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..');

/**
 * Pastas .tsx que ja tem arquivo real hoje (accessibilityRole/Label so faz
 * sentido em JSX). app/ entra nesta rodada (F4, Tarefa 1): e onde a fase
 * escreve tela nova, e o app antigo tinha zero accessibilityLabel.
 * `src/features` entrou na F4 Tarefa 4, com `src/features/home/`: e' a
 * primeira pasta de blocos de tela com JSX de verdade, Pressable incluido.
 */
const VIGIADAS_COM_CONTEUDO = ['src/ui', 'app', 'src/features'];

const VIGIADAS = VIGIADAS_COM_CONTEUDO;

/**
 * As pastas que o redesign (F2-F4) entregou, mesmo as que esta guarda em
 * particular nao varre: accessibilityRole/Label so faz sentido em JSX
 * (.tsx), e src/assistant e src/game sao .ts puro, sem Pressable nenhum —
 * por isso VIGIADAS acima fica sem eles. Mas para a checagem inversa no fim
 * do arquivo (pasta nova nasce coberta ou acusa), as pastas precisam
 * aparecer como "com dono conhecido", senao a checagem acusaria pastas que
 * ja existem e ja sao cobertas pelas outras duas guardas (copy,
 * designTokens) por engano.
 */
const PASTAS_DO_REDESIGN = ['src/ui', 'src/assistant', 'src/game', 'src/features'];

/** Pastas do sistema "Luminous Library" anterior, que ainda nao migraram
 * (saem na F6). Lista compartilhada pelas tres guardas deste diretorio. */
const LEGADO = ['src/components', 'src/api', 'src/lib', 'src/stores', 'src/types', 'src/utils', 'src/theme'];

/**
 * Rodada de correcao 1 (revisao da Tarefa 1): a lista unica
 * `EXCECAO_APP_LEGADO`, compartilhada pelas tres guardas, isentava arquivo
 * que nem tem Pressable no arquivo (por exemplo login.tsx e livros.tsx) — a
 * checagem abaixo ja e um no-op pra eles (so roda de verdade quando acha
 * <Pressable ou AnimatedPressable), entao mante-los na lista so escondia
 * cobertura sem precisar. Trocada por uma lista com SO os arquivos que hoje
 * tem Pressable sem accessibilityRole/accessibilityLabel — ver
 * designTokens.test.ts pro raciocinio completo da mudanca.
 */
const EXCECAO_A11Y = new Set<string>([
  // app/book/[id].tsx saiu no merge do main de 15/09: o PR #17 (BER-48) deu
  // role e label aos Pressable dos capitulos, e o tripwire acusou.
  // app/quiz/[chapterId].tsx saiu na F5: a rota passou a compor so primitivos
  // do sistema (QuizConversation, AssistantStateView), com role e label.
  // confirm-email, signup, catalogo e perfil sairam na F6: a lista esta vazia,
  // e as checagens abaixo continuam valendo para quem entrar nela de novo.
]);

function arquivos(dir: string): string[] {
  const abs = join(RAIZ, dir);
  let entradas: string[];
  try { entradas = readdirSync(abs); } catch { return []; }
  return entradas.flatMap((nome) => {
    const caminho = join(abs, nome);
    if (statSync(caminho).isDirectory()) return arquivos(join(dir, nome));
    return /\.tsx$/.test(nome) ? [join(dir, nome).replace(/\\/g, '/')] : [];
  });
}

const TODOS = VIGIADAS.flatMap(arquivos);

/**
 * Zero accessibilityLabel no app inteiro foi um dos achados da auditoria. Aqui a
 * regra e grosseira de proposito: todo arquivo que renderiza Pressable precisa
 * declarar role e label em algum lugar. O teste de componente cobre o caso a caso.
 */
describe('guarda: acessibilidade', () => {
  // Checagem por pasta, nao agregada: ver designTokens.test.ts (rodada de
  // correcao 1) pro raciocinio completo de por que o total sozinho nao basta.
  it.each(VIGIADAS_COM_CONTEUDO)('a pasta %s tem arquivo para varrer', (dir) => {
    expect(arquivos(dir).length).toBeGreaterThan(0);
  });

  it.each(TODOS)('%s: se tem Pressable, declara role e label', (rel) => {
    if (EXCECAO_A11Y.has(rel)) return;
    const conteudo = readFileSync(join(RAIZ, rel), 'utf8');
    if (!/<Pressable|AnimatedPressable/.test(conteudo)) return;
    expect(conteudo).toMatch(/accessibilityRole=/);
    expect(conteudo).toMatch(/accessibilityLabel[=:]/);
  });
});

/**
 * A lista de excecao precisa provar que esta viva: falha assim que um
 * arquivo listado deixar de existir, em vez de continuar "protegendo" uma
 * tela que ja migrou ou sumiu (lixo que finge cobertura).
 */
describe('guarda: excecao desta guarda nao aponta pra arquivo fantasma', () => {
  // Laco num teste so, e nao it.each: com a lista vazia, it.each([]) falha.
  it('toda excecao ainda existe', () => {
    for (const rel of EXCECAO_A11Y) {
      expect(existsSync(join(RAIZ, rel))).toBe(true);
    }
  });
});

/**
 * Tripwire inverso (a parte que resolve o problema de verdade, ver
 * designTokens.test.ts pro raciocinio completo): cada arquivo isento precisa
 * provar, a cada rodada, que AINDA tem Pressable sem role/label. Sem isso a
 * lista so encolhe se alguem lembrar quando a Tarefa 4/5/6 reescrever a tela
 * — o mesmo mecanismo que ja falhou nesta branch.
 */
describe('guarda: excecao desta guarda so cobre arquivo que realmente viola', () => {
  it('tripwire: cada excecao de EXCECAO_A11Y ainda tem Pressable sem role/label', () => {
    for (const rel of EXCECAO_A11Y) {
      const conteudo = readFileSync(join(RAIZ, rel), 'utf8');
      const temPressable = /<Pressable|AnimatedPressable/.test(conteudo);
      const temRole = /accessibilityRole=/.test(conteudo);
      const temLabel = /accessibilityLabel[=:]/.test(conteudo);
      if (!(temPressable && !(temRole && temLabel))) {
        throw new Error(
          `${rel} nao tem mais Pressable sem accessibilityRole/accessibilityLabel. Remova esta linha de EXCECAO_A11Y em a11y.test.ts: a excecao parou de proteger qualquer coisa.`,
        );
      }
    }
  });
});

/**
 * O buraco: nada aqui acusava uma pasta nova sob src/ que ninguem catalogou.
 * Enumera as pastas REAIS de primeiro nivel e falha em qualquer uma que nao
 * esteja nem em PASTAS_DO_REDESIGN nem em LEGADO — pasta nova nasce coberta
 * ou acusa.
 */
describe('guarda: pasta nova nasce coberta ou acusa', () => {
  it('todo diretorio de primeiro nivel de src/ esta em PASTAS_DO_REDESIGN ou em LEGADO', () => {
    const raizSrc = join(RAIZ, 'src');
    const dirs = readdirSync(raizSrc).filter((nome) => statSync(join(raizSrc, nome)).isDirectory());
    const conhecidas = new Set([...PASTAS_DO_REDESIGN, ...LEGADO].map((p) => p.replace('src/', '')));
    for (const dir of dirs) {
      expect(conhecidas.has(dir)).toBe(true);
    }
  });
});
