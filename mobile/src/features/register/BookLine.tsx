// Linha do livro no topo do sheet (spec S7.2, mockup 04): capa, titulo, onde o
// leitor parou e, com mais de um livro em andamento, o "Trocar" (BER-44).
import { ListRow } from '../../ui/ListRow';
import { Cover } from '../../ui/Cover';
import { Button } from '../../ui/Button';
import type { Book } from '../../types/database';

interface Props {
  book: Pick<Book, 'id' | 'title' | 'author' | 'cover_url'>;
  currentPage: number;
  /** A lista de livros esta aberta. */
  switching: boolean;
  /** Presente so quando ha outro livro para escolher. */
  onToggleSwitch?: () => void;
  /** Trava o "Trocar" enquanto o registro esta sendo enviado (F4-18). */
  disabled?: boolean;
}

export function BookLine({ book, currentPage, switching, onToggleSwitch, disabled = false }: Props) {
  return (
    <ListRow
      last
      title={book.title}
      subtitle={currentPage > 0 ? `parou na pág. ${currentPage}` : 'ainda não começou'}
      leading={<Cover book={book} size="xs" />}
      trailing={
        onToggleSwitch ? (
          <Button
            variant="ghost"
            size="md"
            onPress={onToggleSwitch}
            disabled={disabled}
            accessibilityLabel={switching ? 'Fechar lista de livros' : 'Trocar livro'}
          >
            {switching ? 'Fechar' : 'Trocar'}
          </Button>
        ) : null
      }
    />
  );
}
