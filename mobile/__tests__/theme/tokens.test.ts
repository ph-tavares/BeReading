import { color, space, radius, type, motion, COVER_PALETTE_COLORS, COVER_INK } from '../../src/theme/tokens';

/** Contraste WCAG 2.1 entre duas cores hex opacas. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const v = hex.replace('#', '');
    const ch = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
    const [r, g, bl] = ch.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// As cinco superficies onde texto pousa de verdade, nao so as tres mais
// obvias: surface3 e "pressed/selecionado" (legenda dentro de linha
// selecionada e combinacao trivial nas telas) e floating e o toast (onde
// text3 tambem aparece, no detalhe). Faltar as duas deixou passar text3
// reprovando AA sobre surface3 (4,295) e apertando sobre floating (4,652)
// — ver rodada de correcao da F2.
const SURFACES = [color.bg, color.surface1, color.surface2, color.surface3, color.floating];

describe('tokens · contraste', () => {
  it.each([['text', color.text], ['text2', color.text2], ['text3', color.text3]])(
    '%s passa em AA (4.5) sobre bg, surface1 e surface2',
    (_name, fg) => {
      for (const surface of SURFACES) {
        expect(contrast(fg, surface)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it.each([['accent', color.accent], ['positive', color.positive], ['danger', color.danger]])(
    '%s passa em AA sobre as superfícies',
    (_name, fg) => {
      for (const surface of SURFACES) {
        expect(contrast(fg, surface)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('accentInk é legível sobre accent (texto do botão primário)', () => {
    expect(contrast(color.accentInk, color.accent)).toBeGreaterThanOrEqual(4.5);
  });

  // BER-120: o jade tem duas formas porque nao existe um verde so' que sirva
  // pros dois usos. `brand` e' preenchimento (bloco, botao, aba ativa) e
  // reprova como texto — medido em 20/09: 3,83 sobre surface3, contra o
  // minimo de 4,5. `brandText` e' a mesma familia clareada, e' o que pode
  // virar letra. Separar os dois foi o que permitiu manter a guarda inteira
  // em vez de abrir excecao pro verde.
  it('brandInk é legível sobre brand (texto dentro do bloco e do botão)', () => {
    expect(contrast(color.brandInk, color.brand)).toBeGreaterThanOrEqual(4.5);
  });

  it('brandText passa em AA sobre as superfícies', () => {
    for (const surface of SURFACES) {
      expect(contrast(color.brandText, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  /**
   * Tripwire: se alguem "simplificar" trocando brandText por brand em texto,
   * este teste morre junto e a regressao passa. Ele grava o motivo da
   * separacao existir — brand REPROVA como texto, e isso e' esperado.
   */
  it('brand, sozinho, não serve como texto — é por isso que brandText existe', () => {
    expect(contrast(color.brand, color.surface3)).toBeLessThan(4.5);
  });

  it('o creme da capa é legível sobre toda a paleta de capas', () => {
    for (const c of COVER_PALETTE_COLORS) {
      expect(contrast(COVER_INK, c)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('tokens · escalas', () => {
  it('todo espaço é múltiplo de 4', () => {
    for (const v of Object.values(space)) expect(v % 4).toBe(0);
  });

  it('nenhuma variante tipográfica fica abaixo de 12', () => {
    for (const v of Object.values(type)) expect(v.fontSize).toBeGreaterThanOrEqual(12);
  });

  it('toda variante tipográfica declara lineHeight', () => {
    for (const v of Object.values(type)) expect(v.lineHeight).toBeGreaterThan(0);
  });

  it('a saída é mais rápida que a entrada (regra de motion da Wiki)', () => {
    expect(motion.exit.duration).toBeLessThan(motion.enter.duration);
  });

  it('o raio do card é maior que o do controle', () => {
    expect(radius.card).toBeGreaterThan(radius.control);
  });
});

/**
 * BER-120: a regra "âmbar é jogo, jade é leitura e ação" só vale se os
 * componentes obedecerem. Estes casos travam a divisão no nível do sistema,
 * não de cada tela: são o que impede o jade e o âmbar de trocarem de lado num
 * merge distraído. O `Ring` (nível) e a `StreakWeek` continuam em `accent` de
 * propósito — a mecânica de jogo não mudou.
 */
describe('tokens · quem é jogo e quem é leitura', () => {
  it('jade e âmbar são cores distintas, com tintas distintas', () => {
    expect(color.brand).not.toBe(color.accent);
    expect(color.brandInk).not.toBe(color.accentInk);
  });

  it('o jade de texto é mais claro que o de preenchimento', () => {
    const luz = (hex: string) => {
      const v = hex.replace('#', '');
      const ch = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
      return ch[0] + ch[1] + ch[2];
    };
    expect(luz(color.brandText)).toBeGreaterThan(luz(color.brand));
  });
});
