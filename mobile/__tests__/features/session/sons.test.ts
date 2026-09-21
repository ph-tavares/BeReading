import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guarda de duracao dos sons da sessao (BER-124).
 *
 * O teste em aparelho de 21/09 ouviu o sino de fim como "curto e baixo": o
 * arquivo tinha 2,6 s de decaimento exponencial, entao a parte audivel nao
 * passava de ~1,5 s. Para quem largou o celular e esta lendo, isso passa
 * despercebido. O fim precisa de presenca sonora, nao de um "tlim".
 *
 * O inicio continua curto de proposito: ele abre a leitura, e cinco segundos
 * de som antes da primeira pagina seriam atraso, nao ritual.
 *
 * Os dois arquivos sao gerados por `scripts/gerar-sons.mjs`. Se esta guarda
 * quebrar depois de mexerem no gerador, rode-o de novo.
 */
const DIRETORIO = join(__dirname, '..', '..', '..', 'assets', 'audio');

function lerWav(nome: string) {
  const b = readFileSync(join(DIRETORIO, nome));
  const canais = b.readUInt16LE(22);
  const taxa = b.readUInt32LE(24);
  const bits = b.readUInt16LE(34);

  let deslocamento = 12;
  let tamanho = 0;
  while (deslocamento < b.length - 8) {
    const id = b.toString('ascii', deslocamento, deslocamento + 4);
    const n = b.readUInt32LE(deslocamento + 4);
    if (id === 'data') {
      tamanho = n;
      break;
    }
    deslocamento += 8 + n + (n % 2);
  }

  const amostras = tamanho / (canais * (bits / 8));
  return { duracaoSegundos: amostras / taxa, inicioDados: deslocamento + 8, tamanho, b, taxa };
}

/**
 * Energia media de uma janela, em dBFS. Duracao de arquivo sozinha nao basta:
 * um arquivo de 5 s cujo som morreu no segundo 1 continua sendo um som curto
 * com silencio colado atras.
 */
function energiaEm(nome: string, deSegundos: number, ateSegundos: number) {
  const { b, taxa, inicioDados, tamanho } = lerWav(nome);
  const primeira = Math.floor(deSegundos * taxa);
  const ultima = Math.floor(ateSegundos * taxa);

  let soma = 0;
  let n = 0;
  for (let i = primeira; i < ultima; i += 1) {
    const p = inicioDados + i * 2;
    if (p + 1 >= inicioDados + tamanho) break;
    const v = b.readInt16LE(p) / 32767;
    soma += v * v;
    n += 1;
  }
  if (n === 0) return -99;
  const rms = Math.sqrt(soma / n);
  return rms > 0 ? 20 * Math.log10(rms) : -99;
}

describe('som de fim', () => {
  it('dura pelo menos 4,5 segundos', () => {
    expect(lerWav('fim.wav').duracaoSegundos).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * O ponto do pedido: som **seguido**, e nao uma batida com cauda inaudivel.
   * -40 dBFS e o piso do que se escuta num quarto silencioso com o celular
   * a um braco de distancia.
   */
  it('continua audivel no quarto segundo', () => {
    expect(energiaEm('fim.wav', 3.5, 4.5)).toBeGreaterThan(-40);
  });
});

describe('som de inicio', () => {
  /** Curto de proposito: abre a leitura, nao a atrasa. */
  it('fica abaixo de 2 segundos', () => {
    expect(lerWav('inicio.wav').duracaoSegundos).toBeLessThan(2);
  });
});
