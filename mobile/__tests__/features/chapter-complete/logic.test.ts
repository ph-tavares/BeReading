import {
  parseParams,
  chapterTargets,
  closedTitle,
  xpGained,
  xpPlan,
  xpAt,
  xpTagLabel,
  streakTagLabel,
  ringLabel,
  ringCaption,
} from '../../../src/features/chapter-complete/logic';
import { successToast } from '../../../src/features/register/logic';
import { levelFor } from '../../../src/game/xp';

describe('parseParams (contrato F4-7: tudo chega como string)', () => {
  it('separa os ids na ordem em que chegaram e converte os numeros', () => {
    expect(parseParams({ chapterIds: 'c-5,c-4', bookId: 'b1', pagesRead: '28', streak: '5', xpBefore: '1840' }))
      .toEqual({ chapterIds: ['c-5', 'c-4'], pagesRead: 28, streak: 5, xpBefore: 1840 });
  });

  it('xpBefore ausente vira null, e nao zero', () => {
    expect(parseParams({ chapterIds: 'c-4', pagesRead: '28', streak: '5' }).xpBefore).toBeNull();
  });

  it('xpBefore "0" e dado: o leitor novo de verdade fechando o primeiro capitulo', () => {
    expect(parseParams({ chapterIds: 'c-4', pagesRead: '28', streak: '1', xpBefore: '0' }).xpBefore).toBe(0);
  });

  it('numero malformado nao vira numero', () => {
    expect(parseParams({ chapterIds: 'c-4', pagesRead: 'abc', streak: '-1', xpBefore: '12.5' }))
      .toEqual({ chapterIds: ['c-4'], pagesRead: null, streak: null, xpBefore: null });
  });

  it('id vazio ou virgula sobrando e descartado', () => {
    expect(parseParams({ chapterIds: ',c-4,,' }).chapterIds).toEqual(['c-4']);
    expect(parseParams({}).chapterIds).toEqual([]);
  });
});

describe('chapterTargets (F4-15)', () => {
  it('ordena por numero, porque .in() nao preserva ordem, e o quiz abre pelo menor', () => {
    // Nem a ordem dos ids (c-6 primeiro) nem a da resposta (c-5 primeiro) e a certa.
    const r = chapterTargets(
      ['c-6', 'c-4', 'c-5'],
      [{ id: 'c-5', number: 5 }, { id: 'c-6', number: 6 }, { id: 'c-4', number: 4 }],
    );
    expect(r).toEqual({ numbers: [4, 5, 6], quizChapterId: 'c-4' });
  });

  it('um capitulo', () => {
    expect(chapterTargets(['c-4'], [{ id: 'c-4', number: 4 }])).toEqual({ numbers: [4], quizChapterId: 'c-4' });
  });

  it('consulta falhou: nenhum numero, e o quiz abre pelo primeiro id', () => {
    expect(chapterTargets(['c-6', 'c-4'], null)).toEqual({ numbers: null, quizChapterId: 'c-6' });
  });

  it('resposta sem todos os ids: trata como falha, em vez de um titulo com a contagem errada', () => {
    expect(chapterTargets(['c-6', 'c-4'], [{ id: 'c-4', number: 4 }]))
      .toEqual({ numbers: null, quizChapterId: 'c-6' });
  });

  it('sem id nenhum, nao ha quiz pra abrir', () => {
    expect(chapterTargets([], [])).toEqual({ numbers: null, quizChapterId: null });
  });
});

describe('closedTitle', () => {
  it('com os numeros, o titulo da spec', () => {
    expect(closedTitle([4], 1)).toBe('Capítulo 4, fechado.');
    expect(closedTitle([4, 5], 2)).toBe('2 capítulos, fechados.');
  });

  it('sem os numeros, titulo sem numero de capitulo, contando os ids', () => {
    expect(closedTitle(null, 1)).toBe('Capítulo fechado.');
    expect(closedTitle(null, 2)).toBe('2 capítulos, fechados.');
  });
});

describe('xpGained (F4-14)', () => {
  it('paginas vezes XP por pagina', () => {
    expect(xpGained(28)).toBe(140);
  });

  it('sem paginas validas, nenhum ganho inventado', () => {
    expect(xpGained(null)).toBeNull();
  });
});

const carregado = (xp: number) => ({ storeXp: xp, storeLevel: levelFor(xp), loaded: true });

describe('xpPlan (F4-14)', () => {
  it('sem subida de nivel: um trecho so, de xpBefore ate xpBefore + ganho', () => {
    const plan = xpPlan({ xpBefore: 1840, gained: 140, ...carregado(1980) });
    expect(plan).toEqual({
      finalXp: 1980,
      finalLevel: levelFor(1980),
      leveledUp: false,
      segments: [{
        fromProgress: levelFor(1840).progress,
        toProgress: levelFor(1980).progress,
        fromXp: 1840,
        toXp: 1980,
        level: levelFor(1980),
      }],
    });
  });

  it('refresh falhou (store ainda com o XP antigo): o alvo e xpBefore + ganho, e o ganho nao some', () => {
    const plan = xpPlan({ xpBefore: 1840, gained: 140, ...carregado(1840) });
    expect(plan?.finalXp).toBe(1980);
    expect(plan?.segments[0]).toMatchObject({ fromXp: 1840, toXp: 1980 });
    expect(plan?.segments[0].toProgress).toBeGreaterThan(plan?.segments[0].fromProgress ?? 1);
  });

  it('store a frente do ganho (XP de medalha): o alvo e o store', () => {
    const plan = xpPlan({ xpBefore: 1840, gained: 140, ...carregado(2000) });
    expect(plan?.finalXp).toBe(2000);
    expect(plan?.segments[0]).toMatchObject({ fromXp: 1840, toXp: 2000 });
  });

  it('subiu de nivel: completa ate o limiar, zera e continua ate o progresso do nivel novo', () => {
    // Premissa: 2100 e nivel 4 (proximo em 2200); 2300 e nivel 5.
    expect(levelFor(2100)).toMatchObject({ level: 4, next: 2200 });
    expect(levelFor(2300).level).toBe(5);

    const plan = xpPlan({ xpBefore: 2100, gained: 200, ...carregado(2300) });
    expect(plan?.leveledUp).toBe(true);
    expect(plan?.finalLevel).toEqual(levelFor(2300));
    expect(plan?.segments).toEqual([
      { fromProgress: levelFor(2100).progress, toProgress: 1, fromXp: 2100, toXp: 2200, level: levelFor(2100) },
      { fromProgress: 0, toProgress: levelFor(2300).progress, fromXp: 2200, toXp: 2300, level: levelFor(2300) },
    ]);
  });

  it('subiu mais de um nivel de uma vez: uma volta so, e o segundo trecho sai do piso do nivel final (F4-25)', () => {
    // Premissa: 600 e nivel 2 (proximo em 660); 1400 e nivel 4 (piso 1320).
    expect(levelFor(600)).toMatchObject({ level: 2, next: 660 });
    expect(levelFor(1400)).toMatchObject({ level: 4, floor: 1320 });

    const plan = xpPlan({ xpBefore: 600, gained: 800, ...carregado(1400) });
    expect(plan?.segments).toHaveLength(2);
    expect(plan?.segments[0]).toMatchObject({ fromXp: 600, toXp: 660, toProgress: 1 });
    // O centro mostra o nivel 4 no segundo trecho: contar de 660 poria o numero
    // abaixo do piso desse nivel. O numero salta junto com o arco que zera.
    expect(plan?.segments[1]).toMatchObject({ fromXp: 1320, toXp: 1400, fromProgress: 0 });
    expect(plan?.segments[1].level.level).toBe(4);
  });

  it('o caso da revisao: de 0 a 750 XP, o segundo trecho nao mostra XP abaixo do piso do nivel 3', () => {
    expect(levelFor(750)).toMatchObject({ level: 3, floor: 660, next: 1320 });

    const plan = xpPlan({ xpBefore: 0, gained: 750, ...carregado(750) });
    expect(plan?.segments[1]).toMatchObject({ fromXp: 660, toXp: 750, level: levelFor(750) });
  });

  it('alvo exatamente no piso do nivel novo: sem trecho de comprimento zero, termina direto', () => {
    expect(levelFor(2200)).toMatchObject({ level: 5, floor: 2200, progress: 0 });

    const plan = xpPlan({ xpBefore: 2100, gained: 100, ...carregado(2200) });
    expect(plan?.leveledUp).toBe(true);
    expect(plan?.finalLevel).toEqual(levelFor(2200));
    expect(plan?.segments).toEqual([
      { fromProgress: levelFor(2100).progress, toProgress: 1, fromXp: 2100, toXp: 2200, level: levelFor(2100) },
    ]);
  });

  it('do piso do nivel 7 ao topo: dois trechos com o mesmo arco, que o Ring precisa distinguir (F4-25)', () => {
    expect(levelFor(4620)).toMatchObject({ level: 7, floor: 4620, progress: 0 });
    expect(levelFor(6160)).toMatchObject({ level: 8, next: null, progress: 1 });

    const plan = xpPlan({ xpBefore: 4620, gained: 1540, ...carregado(6160) });
    expect(plan?.leveledUp).toBe(true);
    expect(plan?.segments.map((s) => [s.fromProgress, s.toProgress])).toEqual([[0, 1], [0, 1]]);
  });

  it('sem xpBefore: parado no store, sem trecho e sem subida, mesmo com store menos ganho cruzando nivel', () => {
    // 2300 - 200 = 2100 (nivel 4): quem deduzisse o "antes" do store diria que subiu.
    const plan = xpPlan({ xpBefore: null, gained: 200, ...carregado(2300) });
    expect(plan).toEqual({ finalXp: 2300, finalLevel: levelFor(2300), segments: [], leveledUp: false });
  });

  it('sem xpBefore e store que nunca carregou: nao ha XP pra mostrar', () => {
    expect(xpPlan({ xpBefore: null, gained: 200, storeXp: 0, storeLevel: levelFor(0), loaded: false })).toBeNull();
  });
});

describe('xpAt', () => {
  const trecho = { fromProgress: 0.5, toProgress: 0.75, fromXp: 1840, toXp: 1980, level: levelFor(1980) };

  it('nas pontas, os valores exatos', () => {
    expect(xpAt(trecho, 0)).toBe(1840);
    expect(xpAt(trecho, 1)).toBe(1980);
  });

  it('no meio, um inteiro entre os dois', () => {
    expect(xpAt(trecho, 0.5)).toBe(1910);
  });
});

describe('rotulos das tags', () => {
  it('"+X XP" e paginas vezes XP por pagina', () => {
    expect(xpTagLabel(28)).toBe('+140 XP');
    expect(xpTagLabel(250)).toBe('+1.250 XP');
  });

  it('o mesmo registro mostra o mesmo XP que o toast do caminho sem capitulo fechado', () => {
    expect(successToast(28, 5).detail.startsWith(`${xpTagLabel(28)} ·`)).toBe(true);
  });

  it('sem paginas validas, sem tag de XP', () => {
    expect(xpTagLabel(null)).toBeNull();
  });

  it('sequencia no singular e no plural', () => {
    expect(streakTagLabel(1)).toBe('1 dia seguido');
    expect(streakTagLabel(5)).toBe('5 dias seguidos');
  });

  it('sequencia zero ou ausente nao vira tag', () => {
    expect(streakTagLabel(0)).toBeNull();
    expect(streakTagLabel(null)).toBeNull();
  });
});

describe('centro e rotulo do anel', () => {
  it('rotulo do leitor de tela: nivel, titulo e XP ate o proximo', () => {
    expect(ringLabel(levelFor(1980), 1980)).toBe('Nível 4 · Constante. 1.980 de 2.200 XP');
  });

  it('rotulo no topo, sem proximo nivel: so o XP', () => {
    expect(ringLabel(levelFor(7000), 7000)).toBe('Nível 8 · Lenda da estante. 7.000 XP');
  });

  it('legenda sob o numero', () => {
    expect(ringCaption(levelFor(1980))).toBe('de 2.200 XP');
    expect(ringCaption(levelFor(7000))).toBe('XP');
  });
});
