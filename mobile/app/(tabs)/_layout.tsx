import { Tabs } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { BookOpenCheck, Timer } from 'lucide-react-native';
import { TabBar } from '../../src/ui/TabBar';
import { ActionMenu } from '../../src/ui/ActionMenu';
import { AssistantBubble } from '../../src/features/assistant';
import { useReadingStore } from '../../src/stores/readingStore';

export default function TabsLayout() {
  const router = useRouter();
  const { currentBook } = useReadingStore();
  const [menuAberto, setMenuAberto] = useState(false);
  const fecharMenu = useCallback(() => setMenuAberto(false), []);

  return (
    // A bolinha do assistente (BER-100) vive aqui, e nao dentro da Hoje, porque
    // ela segue o leitor pelas quatro abas — e a nota do artboard `B1` do canvas.
    // `box-none` deixa o toque passar para a tela inteira atras dela.
    <View style={{ flex: 1 }}>
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
        //
        // ADR 0016 (substitui a 0014): o botão abre um menu com as duas
        // ações, sessão de leitura e registrar leitura. A 0014 tinha
        // descartado o menu por custar um toque a mais; o time escolheu o
        // menu mesmo assim, para quem nunca usa sessão não perder o atalho
        // de registrar que a barra dá em toda tela.
        tabBar={(props) => <TabBar {...props} onPressCentral={() => setMenuAberto(true)} />}
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

      {/* Sem livro em leitura não há página para fotografar, e a bolinha some em
          vez de abrir uma câmera que não sabe de que livro está falando. */}
      <AssistantBubble
        visible={Boolean(currentBook)}
        onPress={() => router.push({
          pathname: '/assistant/scan',
          params: currentBook
            ? { bookId: currentBook.book.id, bookTitle: currentBook.book.title }
            : {},
        })}
      />

      {/* Por último, para ficar por cima das abas, da barra e da bolinha. */}
      <ActionMenu
        visible={menuAberto}
        title="O que vamos fazer?"
        onClose={fecharMenu}
        actions={[
          {
            key: 'sessao',
            icon: Timer,
            title: 'Sessão de leitura',
            description: 'Escolhe o tempo, larga o celular e lê.',
            primary: true,
            onPress: () => router.push('/session/start'),
          },
          {
            key: 'registrar',
            icon: BookOpenCheck,
            title: 'Registrar leitura',
            description: 'Já leu? Anota até que página foi.',
            onPress: () => router.push('/register-reading'),
          },
        ]}
      />
    </View>
  );
}
