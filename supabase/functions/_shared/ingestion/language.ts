// supabase/functions/_shared/ingestion/language.ts
// Idioma de uma página por contagem de palavras funcionais. Serve a uma decisão só
// (BER-59): saber se o texto integral encontrado está no idioma original da obra ou é
// tradução, que tem direito autoral próprio.

type Lang = 'pt' | 'en' | 'es' | 'fr';

const STOPWORDS: Record<Lang, Set<string>> = {
  pt: new Set(['não', 'uma', 'para', 'com', 'os', 'as', 'ele', 'ela', 'mas', 'dos', 'das', 'foi', 'então', 'também', 'quando', 'seu', 'sua', 'aqui', 'eu', 'de', 'da', 'do']),
  en: new Set(['the', 'and', 'that', 'was', 'with', 'his', 'her', 'not', 'but', 'which', 'were', 'this', 'from', 'they', 'have', 'had', 'it', 'of', 'who']),
  es: new Set(['los', 'las', 'una', 'pero', 'con', 'del', 'por', 'fue', 'cuando', 'también', 'él', 'ella', 'sus', 'muy', 'y']),
  fr: new Set(['les', 'des', 'une', 'est', 'dans', 'pour', 'pas', 'qui', 'avec', 'sur', 'mais', 'elle', 'il', 'sont', 'été', 'et']),
};

/** Mínimo de palavras funcionais para arriscar um idioma. */
const MIN_HITS = 5;

export function detectLanguage(text: string): Lang | null {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  let best: Lang | null = null;
  let bestHits = 0;
  for (const lang of Object.keys(STOPWORDS) as Lang[]) {
    const hits = words.filter((w) => STOPWORDS[lang].has(w)).length;
    if (hits > bestHits) {
      best = lang;
      bestHits = hits;
    }
  }
  return bestHits >= MIN_HITS ? best : null;
}
