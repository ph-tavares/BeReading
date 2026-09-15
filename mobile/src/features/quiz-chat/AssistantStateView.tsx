// Os estados do quiz que nao sao pergunta (spec 7.5): preparando, demorando,
// sem conteudo, falhou e cota do mes. A Orelha diz o que esta acontecendo, com
// a fala de quizStateLine, sobre o EmptyState do sistema. Substitui o
// QuizMessageScreen na rota; a decisao de qual estado mostrar continua na rota
// (BER-40, BER-58, BER-66).
import { Glyph } from '../../assistant/Glyph';
import { quizStateLine, type QuizStateKey } from '../../assistant/lines';
import { EmptyState } from '../../ui';

interface Props {
  state: QuizStateKey;
  chapterNumber: number | null;
  /** Complemento da fala: o que fica garantido, ou a data de volta da cota. */
  detail: string;
  /** Acao principal do estado (verificar de novo, tentar de novo, Premium). */
  onPrimary?: () => void;
  onBack: () => void;
}

type Acoes = { primaria: 'onPrimary' | 'onBack' | null; secundaria: string | null };

// Sem conteudo (BER-66) nao oferece tentar de novo: re-tentar sabidamente nao
// resolve. Preparando nao tem acao principal: e so esperar ou sair.
const ACOES: Record<QuizStateKey, Acoes> = {
  polling: { primaria: null, secundaria: 'Responder depois' },
  'still-generating': { primaria: 'onPrimary', secundaria: 'Responder depois' },
  'no-content': { primaria: 'onBack', secundaria: null },
  failed: { primaria: 'onPrimary', secundaria: 'Voltar' },
  quota: { primaria: 'onPrimary', secundaria: 'Voltar' },
};

export function AssistantStateView({ state, chapterNumber, detail, onPrimary, onBack }: Props) {
  const fala = quizStateLine(state, chapterNumber);
  const { primaria, secundaria } = ACOES[state];
  const acaoPrincipal = primaria === 'onPrimary' ? onPrimary : primaria === 'onBack' ? onBack : undefined;

  return (
    <EmptyState
      illustration={<Glyph size={40} />}
      title={fala.text}
      description={detail}
      actionLabel={primaria ? fala.cta : undefined}
      onAction={acaoPrincipal}
      secondaryLabel={secundaria ?? undefined}
      onSecondary={secundaria ? onBack : undefined}
    />
  );
}
