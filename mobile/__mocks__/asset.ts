// Asset binário (som, imagem) visto pelo projeto `node` do jest, que não tem
// transformador para eles — o projeto `react-native` usa o do jest-expo e não
// passa por aqui. O Metro resolve `require` de asset para um NÚMERO (o id no
// registro de assets), então é isso que o dobro devolve: teste que compare o
// valor compara o que o app veria de verdade.
export default 1;
