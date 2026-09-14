import { chapterLockState } from '../../src/utils/chapterGate';

// BER-48: o quiz de um capítulo só abre para quem leu até o fim dele. A regra é a
// mesma do servidor (evaluate-answer / register-reading-session): a maior página
// registrada precisa alcançar a última página do capítulo.

describe('chapterLockState', () => {
  it('libera quando a página atual alcança o fim do capítulo', () => {
    expect(chapterLockState(40, 40)).toEqual({ unlocked: true, pagesLeft: 0 });
  });

  it('libera quando a página atual passou do fim do capítulo', () => {
    expect(chapterLockState(40, 120)).toEqual({ unlocked: true, pagesLeft: 0 });
  });

  it('bloqueia e diz quantas páginas faltam', () => {
    expect(chapterLockState(40, 31)).toEqual({ unlocked: false, pagesLeft: 9 });
  });

  it('bloqueia quem ainda não registrou leitura nenhuma do livro', () => {
    expect(chapterLockState(12, 0)).toEqual({ unlocked: false, pagesLeft: 12 });
  });
});
