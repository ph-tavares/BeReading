// Linha de capitulo do detalhe do livro (spec 7.4). Feito, com quiz esperando
// ou sem paginacao abre o quiz; lendo e trancado ficam desabilitados, com o
// motivo escrito, porque o quiz so abre no fim do capitulo (BER-48).
import { ListRow } from '../../ui';
import type { Chapter } from '../../types/database';
import { chapterSubtitle, type ChapterState } from './logic';

interface Props {
  chapter: Pick<Chapter, 'id' | 'number' | 'title'>;
  state: ChapterState;
  onOpenQuiz: (chapterId: string) => void;
  last?: boolean;
}

export function ChapterRow({ chapter, state, onOpenQuiz, last = false }: Props) {
  const titulo = chapter.title ?? `Capítulo ${chapter.number}`;
  const subtitulo = chapterSubtitle(state);
  const trancado = state.kind === 'reading' || state.kind === 'locked';

  return (
    <ListRow
      title={titulo}
      subtitle={subtitulo}
      onPress={() => onOpenQuiz(chapter.id)}
      disabled={trancado}
      accessibilityLabel={`${titulo}. ${subtitulo}.`}
      last={last}
    />
  );
}
