import { Tabs } from 'expo-router';
import { useRouter } from 'expo-router';
import { TabBar } from '../../src/ui/TabBar';

export default function TabsLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Remove o fundo branco padrão do wrapper da tab bar que o framework adiciona.
        // O TabBar novo (Tarefa 3) já pinta o próprio fundo (color.surface1) e a
        // borda superior, com insets reais — ver src/ui/TabBar.tsx.
        tabBarStyle: { backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0, shadowOpacity: 0 },
      }}
      // O destino do botão central mora aqui, e não dentro do TabBar: o
      // design system não importa `expo-router` (ver o cabeçalho de
      // src/ui/TabBar.tsx e o CI vermelho que produziu essa regra).
      tabBar={(props) => <TabBar {...props} onPressSessao={() => router.push('/session/start')} />}
    >
      {/* Nomes de arquivo de rota (index, livros, catalogo, perfil) não mudam:
          deep link depende deles. O rótulo visível sai daqui: o TabBar lê
          `title` (via resolveLabel) e só cai no fallback dele se a rota não
          declarar nenhum. O ícone é o oposto, fixo por route.name, porque é
          ativo de marca e não configuração de tela. */}
      <Tabs.Screen name="index" options={{ title: 'Hoje' }} />
      <Tabs.Screen name="livros" options={{ title: 'Estante' }} />
      <Tabs.Screen name="catalogo" options={{ title: 'Explorar' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Você' }} />
    </Tabs>
  );
}
