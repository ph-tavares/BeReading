import { readFileSync } from 'fs';
import { join } from 'path';

// Guarda de arvore de rotas (Tarefa 4, BER-77): confere que app/_layout.tsx e
// app/(tabs)/_layout.tsx DECLARAM a apresentacao esperada de cada rota. Le o
// codigo-fonte em vez de montar o Stack de verdade porque app/_layout.tsx
// carrega Supabase, perfil e fontes reais no proprio corpo do componente —
// simular tudo isso so pra ler `options.presentation` seria um teste fragil
// por motivo errado. Mesma tecnica de __tests__/guards/*.test.ts.
const RAIZ = join(__dirname, '..', '..');

function ler(caminhoRelativo: string): string {
  return readFileSync(join(RAIZ, caminhoRelativo), 'utf8');
}

describe('app/_layout.tsx: apresentacao das rotas', () => {
  const codigo = ler('app/_layout.tsx');

  // O brief pedia formSheet com detents [0.7, 1]. No iPhone (SDK 57) o sheet
  // com detent media o layout errado — cabecalho sobre os chips, titulo
  // cortado — e as duas folhas passaram para o page sheet nativo (`modal`).
  // A trava agora e o contrario: ninguem volta ao formSheet sem ver em aparelho.
  it.each(['register-reading', 'session/start'])('%s abre como page sheet (modal), nao formSheet', (nome) => {
    const bloco = codigo.slice(
      codigo.indexOf(`name="${nome}"`),
      codigo.indexOf(`name="${nome}"`) + 150,
    );
    expect(bloco).toMatch(/presentation:\s*'modal'/);
    expect(bloco).not.toMatch(/formSheet/);
  });

  it('quiz/[chapterId] e quiz/summary declaram fullScreenModal', () => {
    const blocoPergunta = codigo.slice(
      codigo.indexOf("name=\"quiz/[chapterId]\""),
      codigo.indexOf("name=\"quiz/[chapterId]\"") + 150,
    );
    const blocoResumo = codigo.slice(
      codigo.indexOf('name="quiz/summary"'),
      codigo.indexOf('name="quiz/summary"') + 150,
    );
    expect(blocoPergunta).toMatch(/presentation:\s*'fullScreenModal'/);
    expect(blocoResumo).toMatch(/presentation:\s*'fullScreenModal'/);
  });

  it('chapter-complete e rota nova em fullScreenModal', () => {
    const bloco = codigo.slice(
      codigo.indexOf('name="chapter-complete"'),
      codigo.indexOf('name="chapter-complete"') + 150,
    );
    expect(bloco).toMatch(/presentation:\s*'fullScreenModal'/);
  });

  it('nenhuma das quatro rotas some do arquivo', () => {
    for (const nome of ['register-reading', 'quiz/[chapterId]', 'quiz/summary', 'chapter-complete']) {
      expect(codigo.includes(`name="${nome}"`)).toBe(true);
    }
  });

  // O guard de autenticacao e a splash sao intocaveis (contrato da Tarefa 4).
  // Nao reescreve o teste de guarda inteiro aqui: so confere que os tres
  // pedacos que identificam a logica original continuam de pe, byte a byte,
  // porque sao a marca d'agua de que ninguem tocou no que nao devia.
  it('o guard de autenticacao e a logica de splash continuam no arquivo', () => {
    expect(codigo).toContain("if (!sess.user.email_confirmed_at) return;");
    expect(codigo).toContain("if (!session && !inAuth) {");
    expect(codigo).toContain('router.replace(\'/(auth)/login\');');
    expect(codigo).toContain('router.replace(\'/(auth)/confirm-email\');');
    expect(codigo).toContain("router.replace('/');");
    expect(codigo).toContain('if (fontsLoaded && isInitialized) {');
    expect(codigo).toContain('SplashScreen.hideAsync().catch(() => {});');
  });

  // O supabase-js roda o callback de onAuthStateChange dentro de uma trava
  // exclusiva. Callback async que espera outra chamada ao Supabase (o perfil)
  // trava o app quando o token e renovado na abertura: a splash nunca sai.
  // Visto no emulador em 15/09 (R2); a doc do auth-js 2.103 marca essa
  // assinatura como deprecated por isso.
  it('onAuthStateChange nao recebe callback async (deadlock da trava do auth)', () => {
    expect(codigo).toMatch(/onAuthStateChange\(\s*\(/);
    expect(codigo).not.toMatch(/onAuthStateChange\(\s*async/);
  });

  // Rota aberta sozinha (link direto, Expo Go restaurando a ultima tela) virava
  // a primeira da pilha: o sheet de registro sem nada atras e sem saida (R2,
  // 15/09). O anchor poe as abas embaixo de qualquer rota aberta direto, entao
  // a Hoje sempre esta na pilha.
  it("declara anchor '(tabs)': a Hoje fica embaixo de rota aberta direto", () => {
    expect(codigo).toMatch(/export const unstable_settings\s*=\s*\{\s*anchor:\s*'\(tabs\)'/);
  });
});

describe('app/(tabs)/_layout.tsx: rotulos e TabBar novo', () => {
  const codigo = ler('app/(tabs)/_layout.tsx');

  it('usa o TabBar novo, nao o CustomTabBar legado', () => {
    expect(codigo).toContain("from '../../src/ui/TabBar'");
    expect(codigo).not.toContain('CustomTabBar');
  });

  it('os quatro nomes de arquivo de rota continuam iguais (deep link)', () => {
    for (const nome of ['index', 'livros', 'catalogo', 'perfil']) {
      expect(codigo.includes(`name="${nome}"`)).toBe(true);
    }
  });

  it('os rotulos novos sao Hoje, Estante, Explorar e Voce', () => {
    expect(codigo).toMatch(/name="index"\s+options=\{\{\s*title:\s*'Hoje'/);
    expect(codigo).toMatch(/name="livros"\s+options=\{\{\s*title:\s*'Estante'/);
    expect(codigo).toMatch(/name="catalogo"\s+options=\{\{\s*title:\s*'Explorar'/);
    expect(codigo).toMatch(/name="perfil"\s+options=\{\{\s*title:\s*'Você'/);
  });
});

describe('BER-100: a camera do assistente e a bolinha', () => {
  it('assistant/scan e declarada como modal de tela cheia', () => {
    const codigo = ler('app/_layout.tsx');
    const bloco = codigo.slice(
      codigo.indexOf('name="assistant/scan"'),
      codigo.indexOf('name="assistant/scan"') + 150,
    );
    expect(bloco).toMatch(/presentation:\s*'fullScreenModal'/);
  });

  // A bolinha segue o leitor pelas quatro abas (artboard B1), entao ela mora no
  // layout das abas. Dentro da Hoje, ela sumiria nas outras tres.
  it('a bolinha mora no layout das abas, nao dentro de uma tela', () => {
    const layoutAbas = ler('app/(tabs)/_layout.tsx');
    expect(layoutAbas).toContain('AssistantBubble');
    expect(layoutAbas).toContain("pathname: '/assistant/scan'");
    expect(ler('app/(tabs)/index.tsx')).not.toContain('AssistantBubble');
  });
});
