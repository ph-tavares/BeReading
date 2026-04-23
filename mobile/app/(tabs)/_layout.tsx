import { Tabs } from 'expo-router';
import { CustomTabBar } from '../../src/components/CustomTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Remove o fundo branco padrão do wrapper da tab bar que o framework adiciona.
        // O CustomTabBar já pinta seu próprio fundo (bgSunk) via SVG e safe-area fill.
        tabBarStyle: { backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0, shadowOpacity: 0 },
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="livros" options={{ title: 'Estante' }} />
      <Tabs.Screen name="catalogo" options={{ title: 'Explorar' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
