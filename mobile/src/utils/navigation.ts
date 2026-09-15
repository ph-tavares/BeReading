// Voltar de uma tela que pode ter sido aberta como a primeira da pilha.
//
// O sheet de registrar leitura e a tela de capitulo fechado foram pensados para
// abrir por cima da Hoje, mas isso nao e garantido: um link direto
// (`bereading://register-reading`) ou o recarregamento do app em
// desenvolvimento abrem a rota sozinha. Ai `router.back()` nao tem para onde
// ir, o expo-router acusa "GO_BACK was not handled" e o leitor fica preso na
// tela, com o voltar bloqueado pelo envio. Visto no emulador em 15/09 (R2).

export interface VoltaNavegavel {
  canGoBack(): boolean;
  back(): void;
  replace(href: '/'): void;
}

/** Volta se houver tela atras; sem nada atras, vai para a Hoje. */
export function backOrHome(router: VoltaNavegavel): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
