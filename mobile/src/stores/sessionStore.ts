import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startSession, type ActiveSession, type SessionMode } from '../features/session/logic';

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
}

interface SessionState {
  active: ActiveSession | null;
  /** O ultimo modo usado, para a tela ja abrir com ele marcado (BER-122). */
  lastMode: SessionMode;
  /** Se `hydrate` ja rodou. A tela nao decide nada antes disso. */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  begin: (params: { mode: SessionMode; bookId: string; now?: Date }) => Promise<ActiveSession>;
}

async function gravar(dados: Persistido): Promise<void> {
  await AsyncStorage.setItem(CHAVE, JSON.stringify(dados));
}

export const useSessionStore = create<SessionState>((set, get) => ({
  active: null,
  lastMode: MODO_PADRAO,
  hydrated: false,

  hydrate: async () => {
    const bruto = await AsyncStorage.getItem(CHAVE);
    if (bruto === null) {
      set({ hydrated: true });
      return;
    }
    const dados = JSON.parse(bruto) as Persistido;
    set({ active: dados.active, lastMode: dados.lastMode, hydrated: true });
  },

  begin: async ({ mode, bookId, now }) => {
    const sessao = startSession({ mode, bookId, now });
    await gravar({ active: sessao, lastMode: mode });
    set({ active: sessao, lastMode: mode });
    return sessao;
  },
}));
