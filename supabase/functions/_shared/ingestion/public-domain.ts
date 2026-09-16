// supabase/functions/_shared/ingestion/public-domain.ts
// Domínio público por país (BER-59, spec §5.5). Texto integral conta como fonte primária
// legítima se a obra estiver em domínio público no Brasil, nos EUA ou no país onde o
// repositório está hospedado. País de origem não vem das bases bibliográficas, então não
// é avaliado (refinamento 7 do plano).
//
// Tradução tem direito autoral próprio: sem o ano de morte do tradutor, que nenhuma base
// traz, texto traduzido nunca conta como domínio público.

export interface PublicDomainInput {
  authorDeathYear: number | null;
  firstPublicationYear: number | null;
  isTranslation: boolean;
  currentYear: number;
}

export interface PublicDomainResult {
  isPublicDomain: boolean;
  basis: string | null;
}

const NOT_PD: PublicDomainResult = { isPublicDomain: false, basis: null };

/** Vida + 70: entra em domínio público em 1º de janeiro do 71º ano após a morte. */
function lifePlus70(death: number | null, currentYear: number): boolean {
  return death !== null && currentYear >= death + 71;
}

export function isPublicDomainIn(country: string, input: PublicDomainInput): PublicDomainResult {
  if (input.isTranslation) return NOT_PD;
  const { authorDeathYear: death, firstPublicationYear: published, currentYear } = input;

  switch (country) {
    case 'US':
      // 95 anos da publicação; entra em 1º de janeiro do ano seguinte (17 U.S.C. §304).
      return published !== null && currentYear >= published + 96
        ? { isPublicDomain: true, basis: `US: publicado em ${published}, mais de 95 anos` }
        : NOT_PD;
    case 'AU':
      // A extensão para vida + 70 (2005) não retroagiu para quem morreu antes de 1955.
      return death !== null && (death < 1955 || lifePlus70(death, currentYear))
        ? { isPublicDomain: true, basis: `AU: autor falecido em ${death}` }
        : NOT_PD;
    case 'CA':
      // A extensão para vida + 70 (2022) não retroagiu para quem morreu até 1971.
      return death !== null && (death <= 1971 || lifePlus70(death, currentYear))
        ? { isPublicDomain: true, basis: `CA: autor falecido em ${death}` }
        : NOT_PD;
    case 'BR':
      return lifePlus70(death, currentYear)
        ? { isPublicDomain: true, basis: `BR: autor falecido em ${death}, LDA art. 41 (70 anos)` }
        : NOT_PD;
    default:
      return lifePlus70(death, currentYear)
        ? { isPublicDomain: true, basis: `${country}: autor falecido em ${death}, 70 anos` }
        : NOT_PD;
  }
}

/** Brasil sempre primeiro; depois os demais países na ordem dada. */
export function publicDomainInAny(countries: string[], input: PublicDomainInput): PublicDomainResult {
  for (const country of new Set(['BR', ...countries])) {
    const result = isPublicDomainIn(country, input);
    if (result.isPublicDomain) return result;
  }
  return NOT_PD;
}
