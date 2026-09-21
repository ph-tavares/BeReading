// Cadastro de livro fora do catalogo (BER-60): a regra do formulario, fora da
// tela para o teste exercitar o codigo real. O servidor (add-book) valida de
// novo; aqui e so para o leitor ver o erro ao lado do campo, antes de enviar.
import type { AddBookContent, AddBookPayload, IsbnLookup } from '../../api/edgeFunctions';

export interface AddBookForm {
  isbn: string;
  title: string;
  author: string;
  totalPages: string;
  chapterCount: string;
  /** Vem do lookup por ISBN; o leitor nao digita capa. */
  coverUrl: string | null;
}

export const EMPTY_FORM: AddBookForm = {
  isbn: '', title: '', author: '', totalPages: '', chapterCount: '', coverUrl: null,
};

/** Os mesmos tetos do servidor (supabase/functions/add-book/book.ts). */
/** O que dizer depois do cadastro, conforme o que o quiz do livro vai ter (BER-59). */
export function contentMessage(content: AddBookContent | undefined): string {
  if (content === 'edition') return 'Os capítulos já vêm da edição, e o quiz usa fatos conferidos.';
  if (content === 'searching') return 'Cada capítulo fecha com um quiz, e o conteúdo conferido chega em alguns minutos.';
  return 'Cada capítulo fecha com um quiz feito com o que a gente achar sobre ele.';
}

export const FORM_LIMITS = { pagesMax: 5000, chaptersMax: 200 } as const;

export type FormErrors = Partial<Record<'isbn' | 'title' | 'author' | 'totalPages' | 'chapterCount', string>>;

/** ISBN so com digitos (e o X final do ISBN-10). */
export function normalizeIsbn(raw: string): string {
  return raw.replace(/[-\s]/g, '').toUpperCase();
}

export function isValidIsbn(isbn: string): boolean {
  return /^\d{9}[\dX]$/.test(isbn) || /^\d{13}$/.test(isbn);
}

/** Inteiro positivo digitado, ou null. "12a", "0" e "" nao sao numero de pagina. */
export function parsePositiveInt(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 ? n : null;
}

export function validateForm(form: AddBookForm): { errors: FormErrors; payload: AddBookPayload | null } {
  const errors: FormErrors = {};
  const isbn = normalizeIsbn(form.isbn);
  if (isbn && !isValidIsbn(isbn)) errors.isbn = 'O ISBN tem 10 ou 13 dígitos.';

  const title = form.title.trim();
  if (!title) errors.title = 'Qual o título do livro?';
  const author = form.author.trim();
  if (!author) errors.author = 'Quem escreveu?';

  const pages = parsePositiveInt(form.totalPages);
  if (pages === null || pages > FORM_LIMITS.pagesMax) errors.totalPages = 'Número de páginas da sua edição.';

  const chapters = parsePositiveInt(form.chapterCount);
  if (chapters === null || chapters > FORM_LIMITS.chaptersMax) {
    errors.chapterCount = 'Quantos capítulos tem? Dá pra ver no sumário.';
  } else if (pages !== null && chapters > pages) {
    errors.chapterCount = 'Tem mais capítulos que páginas. Confere os números?';
  }

  if (Object.keys(errors).length > 0) return { errors, payload: null };
  return {
    errors,
    payload: {
      title,
      author,
      total_pages: pages as number,
      chapter_count: chapters as number,
      isbn: isbn || null,
      cover_url: form.coverUrl,
    },
  };
}

/**
 * Preenche o formulario com o que a Open Library achou, sem apagar o que o
 * leitor ja digitou: o lookup completa, nao sobrescreve.
 */
export function prefillFromLookup(form: AddBookForm, lookup: IsbnLookup): AddBookForm {
  if (!lookup.found) return form;
  return {
    ...form,
    isbn: lookup.isbn,
    title: form.title.trim() || lookup.title,
    author: form.author.trim() || (lookup.authors[0] ?? ''),
    totalPages: form.totalPages.trim() || (lookup.totalPages ? String(lookup.totalPages) : ''),
    // Estrutura confirmada pela ingestão (BER-59) vale mais que a contagem digitada: é ela que
    // liga cada capítulo ao conhecimento verificado.
    chapterCount: lookup.chapterCount ? String(lookup.chapterCount) : form.chapterCount,
    coverUrl: lookup.coverUrl ?? form.coverUrl,
  };
}
