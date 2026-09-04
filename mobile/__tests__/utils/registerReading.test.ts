import {
  pagesAlreadyRead,
  pickInitialBook,
  summarizeCompletedChapters,
  toChoices,
  type BookChoice,
} from '../../src/utils/registerReading';
import type { Book, StudentBook } from '../../src/types/database';

function book(id: string, title = 'Livro'): Book {
  return { id, title, author: 'A', total_pages: 200, genre: 'Ficção' } as Book;
}

function row(id: string, status: StudentBook['status'] = 'reading') {
  return {
    id: `sb-${id}`,
    user_id: 'u1',
    book_id: id,
    status,
    current_page: 10,
    started_at: '2026-09-01T00:00:00Z',
    finished_at: null,
    book: book(id),
  } as StudentBook & { book: Book };
}

describe('toChoices', () => {
  it('mantém só os livros em andamento', () => {
    const choices = toChoices([row('a'), row('b', 'finished'), row('c')]);
    expect(choices.map((c) => c.book.id)).toEqual(['a', 'c']);
  });

  it('separa studentBook do book sem perder dados', () => {
    const [choice] = toChoices([row('a')]);
    expect(choice.book.id).toBe('a');
    expect(choice.studentBook.current_page).toBe(10);
    expect(choice.studentBook).not.toHaveProperty('book');
  });

  it('devolve lista vazia quando não há nada em leitura', () => {
    expect(toChoices([row('a', 'finished')])).toEqual([]);
    expect(toChoices([])).toEqual([]);
  });
});

// BER-44: o coração do bug — antes, o livro era sempre o primeiro da Home.
describe('pickInitialBook', () => {
  const choices: BookChoice[] = toChoices([row('a'), row('b'), row('c')]);

  it('respeita o livro pedido, mesmo não sendo o primeiro', () => {
    expect(pickInitialBook(choices, 'c')?.book.id).toBe('c');
  });

  it('cai no primeiro quando nada foi pedido', () => {
    expect(pickInitialBook(choices)?.book.id).toBe('a');
    expect(pickInitialBook(choices, null)?.book.id).toBe('a');
  });

  it('cai no primeiro quando o pedido não está mais na lista', () => {
    // Ex.: veio um bookId de um livro que o leitor terminou nesse meio-tempo.
    expect(pickInitialBook(choices, 'z')?.book.id).toBe('a');
  });

  it('devolve null sem livros — a tela precisa saber disso para oferecer saída', () => {
    expect(pickInitialBook([], 'a')).toBeNull();
  });
});

// BER-54: a tela usava completed_chapter_ids[0] e ignorava o resto.
describe('summarizeCompletedChapters', () => {
  it('conta todos os capítulos completados, não só o primeiro', () => {
    expect(summarizeCompletedChapters(['c1', 'c2', 'c3'])).toEqual({
      count: 3,
      firstChapterId: 'c1',
    });
  });

  it('um capítulo', () => {
    expect(summarizeCompletedChapters(['c1'])).toEqual({ count: 1, firstChapterId: 'c1' });
  });

  it('nenhum', () => {
    expect(summarizeCompletedChapters([])).toEqual({ count: 0, firstChapterId: null });
  });
});

// BER-54: relê e registra de novo -> as páginas contam duas vezes. Não dá para
// corrigir a contagem sem migration (`pages_read` é coluna gerada), mas dá para
// a pessoa saber antes de enviar.
describe('pagesAlreadyRead', () => {
  it('intervalo totalmente novo não tem sobreposição', () => {
    expect(pagesAlreadyRead(51, 80, 50)).toBe(0);
  });

  it('conta a parte que já tinha sido lida', () => {
    // Leu até 50; registra 41–80 -> 41..50 são repetidas.
    expect(pagesAlreadyRead(41, 80, 50)).toBe(10);
  });

  it('intervalo inteiramente repetido', () => {
    expect(pagesAlreadyRead(10, 20, 50)).toBe(11);
  });

  it('livro ainda não começado não acusa repetição', () => {
    expect(pagesAlreadyRead(1, 20, 0)).toBe(0);
  });

  it('a página seguinte à última lida é nova', () => {
    expect(pagesAlreadyRead(51, 60, 50)).toBe(0);
  });

  it('a última página lida, registrada de novo, conta como uma repetida', () => {
    expect(pagesAlreadyRead(50, 60, 50)).toBe(1);
  });
});
