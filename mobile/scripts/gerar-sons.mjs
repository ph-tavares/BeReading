// Gera os dois sons da sessão de leitura (BER-124).
//
// POR QUE SINTETIZADO, e não um arquivo baixado: o repositório é público, e a
// licença de um som de biblioteca precisa ser conferida e mantida. O mascote
// gerado por IA já é risco de licença aberto no projeto desde 20/09/2026 — não
// vale abrir um segundo. O que este script produz é trabalho do próprio time,
// sem terceiro envolvido.
//
// ⚠️ ISTO É PROVISÓRIO. A spec §11 lista "escolher o som de início e fim" como
// pendência do time. Quando essa escolha acontecer, troque os arquivos e, se o
// som novo vier de fora, registre a licença aqui e no PR.
//
// Rodar:  node scripts/gerar-sons.mjs
//
// O desenho de cada som:
//   início — duas notas subindo, curtas. "Começou", sem susto.
//   fim    — três notas graves resolvendo para baixo, ~5 s de som seguido.
//   encerrar — o início ao contrário, duas notas descendo: o leitor parou.
//            "Acabou", sem alarme de despertador: quem está lendo em silêncio
//            não precisa levar susto, mas precisa ouvir.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DESTINO = join(AQUI, '..', 'assets', 'audio');

const TAXA = 22050; // Hz. Suficiente para um sino: nada aqui passa de 4 kHz.

/**
 * Parciais de um sino. Um sino não é uma senoide: são várias frequências não
 * harmônicas decaindo em velocidades diferentes, e as agudas somem primeiro.
 * É o que dá o "tlim" em vez do "biip".
 */
const PARCIAIS = [
  { razao: 1.0, amplitude: 1.0, decaimento: 1.0 },
  { razao: 2.0, amplitude: 0.45, decaimento: 1.6 },
  { razao: 2.98, amplitude: 0.25, decaimento: 2.4 },
  { razao: 4.5, amplitude: 0.12, decaimento: 3.6 },
];

/** Uma nota de sino: amostras em ponto flutuante, de -1 a 1. */
function nota({ frequencia, duracao, decaimento }) {
  const total = Math.floor(TAXA * duracao);
  const amostras = new Float64Array(total);

  for (let i = 0; i < total; i += 1) {
    const t = i / TAXA;
    let valor = 0;
    for (const p of PARCIAIS) {
      valor += p.amplitude * Math.sin(2 * Math.PI * frequencia * p.razao * t)
        * Math.exp(-decaimento * p.decaimento * t);
    }
    // Ataque de 5 ms. Sem ele, o primeiro sample sai de zero para o pico e o
    // alto-falante estala.
    const ataque = Math.min(1, t / 0.005);
    amostras[i] = valor * ataque;
  }
  return amostras;
}

/** Soma notas em posições diferentes do tempo, numa trilha só. */
function misturar(camadas, duracaoTotal) {
  const total = Math.floor(TAXA * duracaoTotal);
  const saida = new Float64Array(total);
  for (const { amostras, atrasoSegundos } of camadas) {
    const desloca = Math.floor(TAXA * atrasoSegundos);
    for (let i = 0; i < amostras.length && desloca + i < total; i += 1) {
      saida[desloca + i] += amostras[i];
    }
  }
  return saida;
}

/** WAV PCM 16 bits, mono. Normaliza para 0.89 e deixa folga de pico. */
function paraWav(amostras) {
  let pico = 0;
  for (const v of amostras) pico = Math.max(pico, Math.abs(v));
  const ganho = pico > 0 ? 0.89 / pico : 1;

  const dados = Buffer.alloc(amostras.length * 2);
  for (let i = 0; i < amostras.length; i += 1) {
    const v = Math.max(-1, Math.min(1, amostras[i] * ganho));
    dados.writeInt16LE(Math.round(v * 32767), i * 2);
  }

  const cabecalho = Buffer.alloc(44);
  cabecalho.write('RIFF', 0);
  cabecalho.writeUInt32LE(36 + dados.length, 4);
  cabecalho.write('WAVE', 8);
  cabecalho.write('fmt ', 12);
  cabecalho.writeUInt32LE(16, 16);
  cabecalho.writeUInt16LE(1, 20); // PCM
  cabecalho.writeUInt16LE(1, 22); // mono
  cabecalho.writeUInt32LE(TAXA, 24);
  cabecalho.writeUInt32LE(TAXA * 2, 28);
  cabecalho.writeUInt16LE(2, 32);
  cabecalho.writeUInt16LE(16, 34);
  cabecalho.write('data', 36);
  cabecalho.writeUInt32LE(dados.length, 40);

  return Buffer.concat([cabecalho, dados]);
}

mkdirSync(DESTINO, { recursive: true });

// Início: duas notas subindo (fá e dó acima), curtas e leves.
const inicio = misturar([
  { amostras: nota({ frequencia: 349.23, duracao: 1.1, decaimento: 4.2 }), atrasoSegundos: 0 },
  { amostras: nota({ frequencia: 523.25, duracao: 1.1, decaimento: 4.2 }), atrasoSegundos: 0.16 },
], 1.35);

// Fim: três notas resolvendo para baixo (dó–sol–dó grave), espaçadas, com
// decaimento lento. Cinco segundos de som SEGUIDO, e não uma batida com cauda
// inaudível: o teste em aparelho de 21/09 ouviu a versão anterior — 2,6 s de
// decaimento rápido — como "curto e baixo", e para quem largou o celular e
// está lendo, isso passa despercebido.
//
// O decaimento cai de 1.5 para 0.5: a nota sustenta em vez de sumir. As
// entradas a cada 1,4 s renovam a energia antes de a anterior morrer, que é o
// que faz o conjunto soar contínuo. A guarda de duração e de energia no
// quarto segundo está em __tests__/features/session/sons.test.ts.
const fim = misturar([
  { amostras: nota({ frequencia: 261.63, duracao: 2.2, decaimento: 1.1 }), atrasoSegundos: 0 },
  { amostras: nota({ frequencia: 196.00, duracao: 2.4, decaimento: 0.9 }), atrasoSegundos: 1.4 },
  { amostras: nota({ frequencia: 130.81, duracao: 2.6, decaimento: 0.5 }), atrasoSegundos: 2.8 },
], 5.2);

// Encerrar: o início de trás para frente (dó e fá abaixo), curto. "Parou
// aqui", distinto do fim, que é o tempo acabando sozinho.
const encerrar = misturar([
  { amostras: nota({ frequencia: 523.25, duracao: 0.9, decaimento: 4.6 }), atrasoSegundos: 0 },
  { amostras: nota({ frequencia: 349.23, duracao: 1.0, decaimento: 4.2 }), atrasoSegundos: 0.14 },
], 1.2);

for (const [nome, amostras] of [['inicio', inicio], ['fim', fim], ['encerrar', encerrar]]) {
  const caminho = join(DESTINO, `${nome}.wav`);
  const wav = paraWav(amostras);
  writeFileSync(caminho, wav);
  console.log(`${nome}.wav — ${(wav.length / 1024).toFixed(0)} KB`);
}
