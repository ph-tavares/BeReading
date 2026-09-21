import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guarda contra erro engolido em silencio no caminho da sessao de leitura.
 *
 * Em 21/09 o som de inicio nao tocava e a notificacao nunca chegava, e o log
 * do Metro estava LIMPO: as quatro chamadas do caminho — configurar audio,
 * tocar inicio, armar o alarme, tocar fim — usavam `.catch(() => {})`. A
 * investigacao so andou depois de trocar os quatro por log.
 *
 * Nao derrubar a sessao quando o som falha continua certo: o fim e um
 * instante absoluto gravado (BER-122) e a corretude nao depende de audio.
 * Engolir sem dizer nada e que nao.
 */
const RAIZ = join(__dirname, '..', '..');

const ARQUIVOS = [
  'app/session/start.tsx',
  'app/session/index.tsx',
];

describe.each(ARQUIVOS)('%s', (relativo) => {
  const fonte = readFileSync(join(RAIZ, relativo), 'utf8');

  it('nao engole erro com catch vazio', () => {
    const vazios = fonte.match(/\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g) ?? [];

    expect(vazios).toEqual([]);
  });
});
