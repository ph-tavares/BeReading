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
