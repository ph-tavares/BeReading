import {
  MAX_IMAGE_EDGE, resizeTarget, scanChipLabel, scanFailureLine, scanInviteLine,
  showsDeepenInvite,
} from '../../../src/features/assistant/logic';

describe('resizeTarget', () => {
  // Criterio de aceite da BER-100: a borda maior da imagem enviada nao passa da
  // ordem de 1.500 px.
  it('reduz pela borda maior, em retrato e em paisagem', () => {
    expect(resizeTarget(3024, 4032)).toEqual({ height: MAX_IMAGE_EDGE });
    expect(resizeTarget(4032, 3024)).toEqual({ width: MAX_IMAGE_EDGE });
  });

  it('quadrada grande reduz pela largura', () => {
    expect(resizeTarget(3000, 3000)).toEqual({ width: MAX_IMAGE_EDGE });
  });

  it('foto que ja cabe nao e reduzida', () => {
    expect(resizeTarget(1200, 900)).toBeNull();
    expect(resizeTarget(MAX_IMAGE_EDGE, 900)).toBeNull();
  });

  it('medida invalida nao vira reducao', () => {
    expect(resizeTarget(0, 0)).toBeNull();
    expect(resizeTarget(-10, 2000)).toBeNull();
    expect(resizeTarget(Number.NaN, 2000)).toBeNull();
  });

  // O que a reducao garante: depois dela, a borda maior cabe no teto.
  it('a borda maior depois da reducao nunca passa do teto', () => {
    const casos: [number, number][] = [[4032, 3024], [3024, 4032], [2000, 2000], [6000, 100]];
    for (const [largura, altura] of casos) {
      const alvo = resizeTarget(largura, altura);
      if (!alvo) continue;
      const escala = 'width' in alvo ? alvo.width / largura : alvo.height / altura;
      expect(Math.max(largura * escala, altura * escala)).toBeLessThanOrEqual(MAX_IMAGE_EDGE);
    }
  });
});

describe('scanChipLabel', () => {
  it('junta livro e pagina quando os dois existem', () => {
    expect(scanChipLabel('1984', 220)).toBe('1984 · pag. 220');
  });

  it('mostra so o que se sabe', () => {
    expect(scanChipLabel('1984', null)).toBe('1984');
    expect(scanChipLabel(null, 220)).toBe('pag. 220');
    expect(scanChipLabel(null, null)).toBeNull();
  });
});

describe('scanFailureLine', () => {
  // Spec secao 7: cada falha tem a propria fala, e nenhuma e tela de erro generica.
  it('a foto que nao e livro nao acusa o leitor de nada', () => {
    const fala = scanFailureLine('not_a_book_page');
    expect(fala).toMatch(/livro aberto/);
    expect(fala).not.toMatch(/erro|falha|inválid/i);
  });

  it('sem internet fala de internet, nao de erro do app', () => {
    expect(scanFailureLine('offline')).toMatch(/sem internet/i);
  });

  it('falha nossa nao pede pro leitor reportar nada', () => {
    for (const falha of ['ai_unavailable', 'ai_image_unsupported', 'scan_failed', 'unknown'] as const) {
      expect(scanFailureLine(falha)).toBe('Não consegui ler essa foto agora. Tenta de novo daqui a pouco.');
    }
  });

  it('nenhuma fala fica sem texto', () => {
    const todas = [
      'not_a_book_page', 'image_too_large', 'offline',
      'ai_image_unsupported', 'ai_unavailable', 'scan_failed', 'unknown',
    ] as const;
    for (const falha of todas) expect(scanFailureLine(falha).length).toBeGreaterThan(0);
  });
});

describe('scanInviteLine', () => {
  it('cita o livro quando ele e conhecido', () => {
    expect(scanInviteLine('1984')).toBe('Travou em alguma página de 1984?');
    expect(scanInviteLine(null)).toBe('Travou em alguma página?');
  });
});

describe('showsDeepenInvite (BER-101)', () => {
  const fala = (role: 'reader' | 'assistant', kind?: 'direct' | 'invite' | 'refusal' | 'unknown') =>
    ({ id: 'x', role, text: 'oi', kind });

  it('aparece depois de uma resposta direta', () => {
    expect(showsDeepenInvite(fala('assistant', 'direct'))).toBe(true);
  });

  // Nao ha o que aprofundar depois de uma recusa ou de um "nao sei": oferecer seria
  // prometer o que o assistente acabou de dizer que nao faz.
  it('nao aparece depois de recusa nem de "nao sei"', () => {
    expect(showsDeepenInvite(fala('assistant', 'refusal'))).toBe(false);
    expect(showsDeepenInvite(fala('assistant', 'unknown'))).toBe(false);
  });

  // Depois de um convite a pensar, a bola esta com o leitor. Empurrar "quer que eu
  // aprofunde?" atropelaria a pergunta que o assistente acabou de fazer a ele.
  it('nao aparece depois de um convite a pensar', () => {
    expect(showsDeepenInvite(fala('assistant', 'invite'))).toBe(false);
  });

  it('nao aparece na fala do leitor nem numa conversa vazia', () => {
    expect(showsDeepenInvite(fala('reader'))).toBe(false);
    expect(showsDeepenInvite(undefined)).toBe(false);
  });
});
