import { bookAverage, readProgress, shelfSubtitle } from '../../../src/features/shelf/logic';

const resposta = (chapter_id: string, score: number | null, status = 'completed') => ({
  comprehension_score: score, evaluation_status: status, question: { chapter_id },
});

describe('readProgress', () => {
  it('fracao lida, saturada entre 0 e 1', () => {
    expect(readProgress({ current_page: 82, book: { total_pages: 328 } })).toBe(0.25);
    expect(readProgress({ current_page: 400, book: { total_pages: 328 } })).toBe(1);
  });

  it('livro sem total de paginas fica em 0', () => {
    expect(readProgress({ current_page: 10, book: { total_pages: 0 } })).toBe(0);
  });
});

describe('bookAverage', () => {
  it('media so das notas avaliadas dos capitulos do livro', () => {
    const respostas = [
      resposta('c1', 80), resposta('c2', 61), resposta('outro', 10),
      resposta('c1', null, 'pending'), resposta('c2', null),
    ];
    expect(bookAverage(respostas, ['c1', 'c2'])).toBe(71);
  });

  it('sem nota nenhuma nao tem media (nota ausente nao e zero)', () => {
    expect(bookAverage([resposta('c1', null, 'failed')], ['c1'])).toBeNull();
    expect(bookAverage([], ['c1'])).toBeNull();
  });
});

describe('shelfSubtitle', () => {
  it('no gratuito diz o uso da vaga em texto', () => {
    expect(shelfSubtitle(1, 2)).toBe('1 de 2 livros em leitura');
    expect(shelfSubtitle(1, 1)).toBe('1 de 1 livro em leitura');
  });

  it('sem limite so conta', () => {
    expect(shelfSubtitle(1, null)).toBe('1 livro em leitura');
    expect(shelfSubtitle(3, null)).toBe('3 livros em leitura');
  });
});
