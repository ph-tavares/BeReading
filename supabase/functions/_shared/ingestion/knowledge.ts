// supabase/functions/_shared/ingestion/knowledge.ts
// ÚNICA leitura da base de conhecimento para consumo (BER-59, spec §6.4, guarda 3). Quiz,
// conversa e personalização recebem só os capítulos até onde o leitor chegou. O filtro é
// repetido aqui mesmo com o store já filtrando: um bug de consulta não pode virar spoiler.
import type { IngestionStore, KnowledgeRow } from './store.ts';

export async function getKnowledgeUpTo(
  store: Pick<IngestionStore, 'listKnowledge'>,
  editionId: string,
  currentChapterNumber: number,
): Promise<KnowledgeRow[]> {
  if (!Number.isInteger(currentChapterNumber) || currentChapterNumber < 1) return [];
  const rows = await store.listKnowledge(editionId, currentChapterNumber);
  return rows
    .filter((row) => row.chapterNumber <= currentChapterNumber)
    .sort((a, b) => a.chapterNumber - b.chapterNumber);
}
