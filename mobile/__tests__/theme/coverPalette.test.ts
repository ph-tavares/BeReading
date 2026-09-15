import { coverColorFor } from '../../src/theme/coverPalette';
import { COVER_PALETTE_COLORS } from '../../src/theme/tokens';

describe('coverColorFor', () => {
  it('sempre devolve uma cor da paleta', () => {
    for (const id of ['a', 'b', 'c', '00000000-0000-0000-0001-000000000001']) {
      expect(COVER_PALETTE_COLORS).toContain(coverColorFor(id) as any);
    }
  });

  it('e deterministico: o mesmo livro tem sempre a mesma capa', () => {
    const id = '00000000-0000-0000-0002-000000000002';
    expect(coverColorFor(id)).toBe(coverColorFor(id));
  });

  it('os tres livros do piloto nao ficam todos com a mesma cor', () => {
    const cores = new Set([
      coverColorFor('00000000-0000-0000-0001-000000000001'),
      coverColorFor('00000000-0000-0000-0002-000000000002'),
      coverColorFor('00000000-0000-0000-0003-000000000003'),
    ]);
    expect(cores.size).toBeGreaterThan(1);
  });

  it('id vazio nao quebra', () => {
    expect(COVER_PALETTE_COLORS).toContain(coverColorFor('') as any);
  });
});
