import {
  EMPTY_FORM, isValidIsbn, normalizeIsbn, parsePositiveInt, prefillFromLookup, validateForm,
} from '../../../src/features/add-book/logic';

const PREENCHIDO = { ...EMPTY_FORM, title: 'O Hobbit', author: 'Tolkien', totalPages: '336', chapterCount: '19' };

describe('add-book: formulario (BER-60)', () => {
  it('normaliza e valida ISBN de 10 e 13 digitos', () => {
    expect(normalizeIsbn('978-85-359-1484-9')).toBe('9788535914849');
    expect(isValidIsbn('9788535914849')).toBe(true);
    expect(isValidIsbn('859508114X')).toBe(true);
    expect(isValidIsbn('12345')).toBe(false);
  });

  it('so aceita inteiro positivo como numero', () => {
    expect(parsePositiveInt(' 12 ')).toBe(12);
    expect(parsePositiveInt('0')).toBeNull();
    expect(parsePositiveInt('12a')).toBeNull();
    expect(parsePositiveInt('')).toBeNull();
  });

  it('formulario completo vira o payload do add-book, sem ISBN quando vazio', () => {
    const { errors, payload } = validateForm(PREENCHIDO);
    expect(errors).toEqual({});
    expect(payload).toEqual({
      title: 'O Hobbit', author: 'Tolkien', total_pages: 336, chapter_count: 19, isbn: null, cover_url: null,
    });
  });

  it('aponta cada campo faltando, e nao monta payload', () => {
    const { errors, payload } = validateForm(EMPTY_FORM);
    expect(payload).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(['author', 'chapterCount', 'title', 'totalPages']);
  });

  it('recusa mais capitulos que paginas e ISBN malformado', () => {
    expect(validateForm({ ...PREENCHIDO, totalPages: '10', chapterCount: '11' }).errors.chapterCount).toBeTruthy();
    expect(validateForm({ ...PREENCHIDO, isbn: '123' }).errors.isbn).toBeTruthy();
  });

  it('o lookup completa o que falta e nao sobrescreve o que o leitor digitou', () => {
    const lookup = {
      found: true as const, isbn: '9788535914849', title: '1984', authors: ['George Orwell'],
      totalPages: 416, coverUrl: 'https://covers.openlibrary.org/b/id/8172473-L.jpg',
    };
    const vazio = prefillFromLookup({ ...EMPTY_FORM, isbn: '978-85-359-1484-9' }, lookup);
    expect(vazio).toMatchObject({ isbn: '9788535914849', title: '1984', author: 'George Orwell', totalPages: '416' });
    expect(vazio.coverUrl).toBe(lookup.coverUrl);

    const digitado = prefillFromLookup({ ...EMPTY_FORM, title: 'Mil novecentos e oitenta e quatro' }, lookup);
    expect(digitado.title).toBe('Mil novecentos e oitenta e quatro');
  });

  it('ISBN nao encontrado deixa o formulario como estava', () => {
    expect(prefillFromLookup(PREENCHIDO, { found: false })).toBe(PREENCHIDO);
  });
});

describe('add-book: conteudo do quiz (BER-59)', () => {
  const { contentMessage } = jest.requireActual('../../../src/features/add-book/logic');

  it('a estrutura da edicao ja ingerida preenche os capitulos, mesmo com numero digitado', () => {
    const lookup = {
      found: true as const, isbn: '9788535914849', title: '1984', authors: [], totalPages: 416, coverUrl: null, chapterCount: 24,
    };
    expect(prefillFromLookup({ ...EMPTY_FORM, chapterCount: '9' }, lookup).chapterCount).toBe('24');
    expect(prefillFromLookup({ ...EMPTY_FORM, chapterCount: '9' }, { ...lookup, chapterCount: null }).chapterCount).toBe('9');
  });

  it('diz ao leitor o que esperar do quiz', () => {
    expect(contentMessage('edition')).toMatch(/fatos conferidos/);
    expect(contentMessage('searching')).toMatch(/alguns minutos/);
    expect(contentMessage('none')).toMatch(/quiz/);
  });
});
