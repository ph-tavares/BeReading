import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pauseSession, resumeSession, startSession, type ActiveSession, type SessionMode } from '../features/session/logic';

/**
 * A sessao ativa vive no aparelho, nao no servidor.
 *
 * A tabela de sessoes e a BER-127, fora do escopo do MVP do ritual. Duas
 * consequencias que valem ser ditas em voz alta: neste ciclo a sessao NAO
 * sincroniza entre aparelhos, e o historico do Voce so existe depois da
 * BER-127.
 *
 * O que ja existe aqui e o que sustenta a recuperacao (BER-126): gravar em
 * disco no instante do inicio e a unica forma de a sessao sobreviver ao app
 * ser derrubado — quando ele morre, nao ha ninguem vivo para gravar.
 */
const CHAVE = '@bereading/active-session';

/** Preset inicial de quem nunca abriu a tela. Um meio-termo entre 10 e 30. */
const MODO_PADRAO: SessionMode = { kind: 'timed', minutes: 20 };

interface Persistido {
  active: ActiveSession | null;
  lastMode: SessionMode;
  keepAwake: boolean;
  showTimer?: boolean;
}

interface SessionState {
  active: ActiveSession | null;
  /** O ultimo modo usado, para a tela ja abrir com ele marcado (BER-122). */
  lastMode: SessionMode;
  /**
   * Terceira camada do som (BER-124): a garantia de quem nao quer depender de
   * sino nenhum. Com a tela acesa, o app nunca e congelado e o fim chega na
   * hora, custe bateria. E preferencia do leitor, entao atravessa a morte do
   * app junto com o resto.
   */
  keepAwake: boolean;
  /**
   * Cronometro na tela ou tela calma (BER-123, spec S17). O padrao mostra: a
   * tela calma e escolha de quem prefere que a leitura nao pareca trabalho.
   */
  showTimer: boolean;
  /** Se `hydrate` ja rodou. A tela nao decide nada antes disso. */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  begin: (params: { mode: SessionMode; bookId: string; now?: Date }) => Promise<ActiveSession>;
  setKeepAwake: (valor: boolean) => Promise<void>;
  setShowTimer: (valor: boolean) => Promise<void>;
  pause: () => Promise<ActiveSession | null>;
  resume: () => Promise<ActiveSession | null>;
  /** Encerra a sessao ativa: some da memoria e do aparelho. */
  end: () => Promise<void>;
}

async function gravar(dados: Persistido): Promise<void> {
  await AsyncStorage.setItem(CHAVE, JSON.stringify(dados));
}

export const useSessionStore = create<SessionState>((set, get) => ({
  active: null,
  lastMode: MODO_PADRAO,
  keepAwake: false,
  showTimer: true,
  hydrated: false,

  hydrate: async () => {
    const bruto = await AsyncStorage.getItem(CHAVE);
    if (bruto === null) {
      set({ hydrated: true });
      return;
    }
    const dados = JSON.parse(bruto) as Persistido;
    set({
      active: dados.active,
      lastMode: dados.lastMode,
      // `?? false` e nao `!`: quem gravou antes da BER-124 nao tem o campo, e
      // undefined nao pode virar "ligado" sem a pessoa ter pedido.
      keepAwake: dados.keepAwake ?? false,
      showTimer: dados.showTimer ?? true,
      hydrated: true,
    });
  },

  begin: async ({ mode, bookId, now }) => {
    const sessao = startSession({ mode, bookId, now });
    await gravar({ active: sessao, lastMode: mode, keepAwake: get().keepAwake, showTimer: get().showTimer });
    set({ active: sessao, lastMode: mode });
    return sessao;
  },

  setKeepAwake: async (valor) => {
    set({ keepAwake: valor });
    await gravar({ active: get().active, lastMode: get().lastMode, keepAwake: valor, showTimer: get().showTimer });
  },

  setShowTimer: async (valor) => {
    set({ showTimer: valor });
    await gravar({ active: get().active, lastMode: get().lastMode, keepAwake: get().keepAwake, showTimer: valor });
  },

  pause: async () => {
    const atual = get().active;
    if (!atual) return null;
    const pausada = pauseSession(atual);
    set({ active: pausada });
    await gravar({ active: pausada, lastMode: get().lastMode, keepAwake: get().keepAwake, showTimer: get().showTimer });
    return pausada;
  },

  resume: async () => {
    const atual = get().active;
    if (!atual) return null;
    const retomada = resumeSession(atual);
    set({ active: retomada });
    await gravar({ active: retomada, lastMode: get().lastMode, keepAwake: get().keepAwake, showTimer: get().showTimer });
    return retomada;
  },

  end: async () => {
    set({ active: null });
    await gravar({ active: null, lastMode: get().lastMode, keepAwake: get().keepAwake, showTimer: get().showTimer });
  },
}));
