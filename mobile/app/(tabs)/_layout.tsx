import { Tabs } from 'expo-router';
import { CustomTabBar } from '../../src/components/CustomTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="livros" options={{ title: 'Estante' }} />
      <Tabs.Screen name="catalogo" options={{ title: 'Explorar' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
