// O projeto "node" do Jest (testMatch *.test.ts) não transforma pacotes ESM
// de node_modules (transformIgnorePatterns default). @expo-google-fonts/* usa
// `export *`, que quebra o require direto. Os mocks abaixo substituem os
// pacotes de fonte por constantes simples antes do import de fonts.ts, então
// o teste roda no ambiente node sem precisar da árvore React Native e sem
// mexer na config do Jest (fora do escopo desta tarefa).
jest.mock('@expo-google-fonts/plus-jakarta-sans', () => ({
  useFonts: jest.fn(),
  PlusJakartaSans_500Medium: 'PlusJakartaSans_500Medium',
  PlusJakartaSans_600SemiBold: 'PlusJakartaSans_600SemiBold',
  PlusJakartaSans_700Bold: 'PlusJakartaSans_700Bold',
  PlusJakartaSans_800ExtraBold: 'PlusJakartaSans_800ExtraBold',
}));
jest.mock('@expo-google-fonts/newsreader', () => ({
  useFonts: jest.fn(),
  Newsreader_400Regular: 'Newsreader_400Regular',
  Newsreader_400Regular_Italic: 'Newsreader_400Regular_Italic',
  Newsreader_500Medium: 'Newsreader_500Medium',
}));
jest.mock('@expo-google-fonts/hanken-grotesk', () => ({
  HankenGrotesk_400Regular: 'HankenGrotesk_400Regular',
  HankenGrotesk_500Medium: 'HankenGrotesk_500Medium',
  HankenGrotesk_600SemiBold: 'HankenGrotesk_600SemiBold',
  HankenGrotesk_700Bold: 'HankenGrotesk_700Bold',
}));
jest.mock('@expo-google-fonts/unbounded', () => ({
  useFonts: jest.fn(),
  Unbounded_700Bold: 'Unbounded_700Bold',
  Unbounded_800ExtraBold: 'Unbounded_800ExtraBold',
}));
jest.mock('@expo-google-fonts/bricolage-grotesque', () => ({
  BricolageGrotesque_400Regular: 'BricolageGrotesque_400Regular',
  BricolageGrotesque_500Medium: 'BricolageGrotesque_500Medium',
  BricolageGrotesque_600SemiBold: 'BricolageGrotesque_600SemiBold',
  BricolageGrotesque_700Bold: 'BricolageGrotesque_700Bold',
}));

import { fontFamily, type } from '../../src/theme/tokens';
import { APP_FONT_MAP, useAppFonts } from '../../src/theme/fonts';
import { useFonts as useAppFontLoaderMock } from '@expo-google-fonts/unbounded';

describe('fontes do app', () => {
  it('toda família citada nos tokens está no mapa de carga', () => {
    const carregadas = Object.keys(APP_FONT_MAP);
    for (const familia of Object.values(fontFamily)) {
      expect(carregadas).toContain(familia);
    }
  });

  it('carrega exatamente os pesos usados, sem peso órfão', () => {
    const usadas = new Set<string>(Object.values(fontFamily));
    for (const chave of Object.keys(APP_FONT_MAP)) {
      expect(usadas.has(chave)).toBe(true);
    }
  });

  // BER-120: a serifa saiu. Newsreader falava pela "camada do livro", mas a
  // unica variante que a usava como corpo (`reading`, serifa italica) nunca
  // teve consumidor — conferido em 20/09 com grep em src/ e app/: zero usos.
  // O que a serifa realmente fazia era titulo, e titulo virou Unbounded.
  // Carregar uma familia inteira por uma variante morta era custo de rede a
  // cada abertura do app, pago em nome de um principio que nenhuma tela
  // exercia.
  it('nenhuma família serifada continua no mapa de carga', () => {
    for (const chave of Object.keys(APP_FONT_MAP)) {
      expect(chave).not.toMatch(/Newsreader/);
    }
  });

  it('as duas famílias novas dividem os papéis: Unbounded no display, Bricolage na interface', () => {
    expect(type.display.fontFamily).toMatch(/^Unbounded_/);
    expect(type.numericXL.fontFamily).toMatch(/^Unbounded_/);
    expect(type.body.fontFamily).toMatch(/^BricolageGrotesque_/);
    expect(type.caption.fontFamily).toMatch(/^BricolageGrotesque_/);
  });
});

describe('useAppFonts', () => {
  afterEach(() => {
    (useAppFontLoaderMock as jest.Mock).mockReset();
  });

  it('libera a splash quando a fonte carrega normalmente', () => {
    (useAppFontLoaderMock as jest.Mock).mockReturnValue([true, null]);
    expect(useAppFonts()).toBe(true);
  });

  it('nao trava para sempre quando a carga da fonte falha: degrada para o fallback do sistema', () => {
    // Sem a correção (descartar o segundo elemento do hook), `loaded` fica
    // `false` para sempre aqui e useAppFonts devolveria `false` — a splash
    // nunca sai. Ver Tarefa da rodada de correção da F2.
    (useAppFontLoaderMock as jest.Mock).mockReturnValue([false, new Error('falha ao baixar a fonte')]);
    expect(useAppFonts()).toBe(true);
  });
});
