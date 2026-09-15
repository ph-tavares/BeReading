import { COVER_PALETTE_COLORS } from './tokens';

// Cor da capa gerada, sorteada pelo id do livro (BER-77).
//
// Deterministico de proposito: o leitor reconhece o livro pela cor, entao ela
// nao pode mudar entre sessoes nem entre aparelhos. Mesma ideia do coverFromId
// antigo, sem o emblema de RPG.
//
// FNV-1a, nao o hash polinomial (h*31+c) mais obvio: com paleta de tamanho
// potencia de 2, o resto por 8 do polinomial de base impar colide sempre que
// dois ids mudam o mesmo numero de digitos em posicoes simetricas — e e
// exatamente o caso dos tres ids piloto (...-0001-...0001, ...-0002-...0002,
// ...-0003-...0003), que caiam todos na mesma cor. FNV mistura byte a byte
// com XOR e multiplicacao, entao nao tem essa simetria.
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function coverColorFor(bookId: string): string {
  return COVER_PALETTE_COLORS[hashStr(bookId) % COVER_PALETTE_COLORS.length];
}
