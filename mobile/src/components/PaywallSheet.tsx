// Reexport: o convite ao Premium migrou para o sistema novo em
// src/features/plans (R3, BER-77). As telas do time (catalogo e detalhe do
// livro) importam deste caminho, e continuam importando sem mudar nada.
export { PaywallSheet } from '../features/plans/PaywallSheet';
