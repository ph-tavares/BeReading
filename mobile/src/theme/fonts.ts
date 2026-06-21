import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

export function useLuminousFonts(): boolean {
  const [fontsLoaded] = useFonts({
    PlusJakarta_500Medium: PlusJakartaSans_500Medium,
    PlusJakarta_600SemiBold: PlusJakartaSans_600SemiBold,
    PlusJakarta_700Bold: PlusJakartaSans_700Bold,
    PlusJakarta_800ExtraBold: PlusJakartaSans_800ExtraBold,
  });
  return fontsLoaded;
}
