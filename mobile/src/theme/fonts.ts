import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  useFonts as useAppFontLoader,
  Unbounded_700Bold,
  Unbounded_800ExtraBold,
} from '@expo-google-fonts/unbounded';
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';

export function useLuminousFonts(): boolean {
  const [fontsLoaded] = useFonts({
    PlusJakarta_500Medium: PlusJakartaSans_500Medium,
    PlusJakarta_600SemiBold: PlusJakartaSans_600SemiBold,
    PlusJakarta_700Bold: PlusJakartaSans_700Bold,
    PlusJakarta_800ExtraBold: PlusJakartaSans_800ExtraBold,
  });
  return fontsLoaded;
}

/**
 * As fontes do redesign, com a chave igual ao valor de `fontFamily` em tokens.ts.
 * O teste garante que as duas listas não se separem: peso citado no token e não
 * carregado vira texto no fallback do sistema, que é o tipo de falha que só
 * aparece no aparelho.
 */
export const APP_FONT_MAP = {
  Unbounded_700Bold,
  Unbounded_800ExtraBold,
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} as const;

export function useAppFonts(): boolean {
  // O segundo elemento e o erro da carga. Descarta-lo fazia `loaded` nunca
  // virar `true` numa falha de rede/CDN, e o `_layout.tsx` retorna `null`
  // enquanto isso — a splash ficava presa para sempre. Falha de fonte deve
  // degradar para o fallback do sistema, nao travar o app: por isso o erro
  // tambem libera a splash.
  const [loaded, erro] = useAppFontLoader(APP_FONT_MAP);
  return loaded || !!erro;
}
