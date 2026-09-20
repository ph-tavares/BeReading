// BER-100: fotografar a pagina e ver o que perguntar.
//
// A tela e a porta de entrada do assistente de leitura. Ela cobre os artboards
// `3. A foto da pagina` e `4. O que perguntar` do canvas do assistente: sao dois
// estados da mesma rota, porque a folha das sugestoes sobe sobre o mesmo fundo
// escuro da camera.
//
// A foto nao e guardada. Ela existe como arquivo temporario do
// expo-image-manipulator e vai em base64 na chamada; nem o app nem o servidor
// gravam a imagem (spec, secao 4.1).
//
// Tocar numa sugestao ainda nao responde nada: quem recebe a pergunta e manda a
// resposta e a `ask-assistant`, da BER-101. Por isso as sugestoes aparecem aqui
// como o que sao nesta entrega, uma lista do que da pra perguntar, e nao como
// botao que nao faz nada.
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { X } from 'lucide-react-native';
import { Button, Glyph, IconButton, Text } from '../../src/ui';
import {
  resizeTarget, scanChipLabel, scanFailureLine, type ScanFailure,
} from '../../src/features/assistant';
import { scanPage, ScanPageError, type ScanPageResult } from '../../src/api/edgeFunctions';
import { color, radius, space } from '../../src/theme/tokens';

/**
 * Compressao do JPEG que sobe. 0.8 e o ponto em que o texto da pagina continua
 * legivel para o modelo e o arquivo cai para algo em torno de um terco.
 */
const JPEG_QUALITY = 0.8;
const MEDIA_TYPE = 'image/jpeg';

type Estado =
  | { fase: 'camera' }
  | { fase: 'enviando' }
  | { fase: 'resultado'; scan: ScanPageResult }
  | { fase: 'erro'; falha: ScanFailure };

export default function AssistantScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bookId, bookTitle } = useLocalSearchParams<{ bookId?: string; bookTitle?: string }>();
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [estado, setEstado] = useState<Estado>({ fase: 'camera' });
  const camera = useRef<CameraView>(null);

  const fechar = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const fotografar = useCallback(async () => {
    if (!camera.current) return;
    setEstado({ fase: 'enviando' });
    try {
      const foto = await camera.current.takePictureAsync({ skipProcessing: false });
      if (!foto) throw new ScanPageError('unknown');

      // O corte acontece no aparelho, antes de subir: a pagina fica legivel e a
      // conta de tokens da imagem nao cresce sem motivo (criterio de aceite da issue).
      const contexto = ImageManipulator.manipulate(foto.uri);
      const alvo = resizeTarget(foto.width, foto.height);
      if (alvo) contexto.resize(alvo);
      const imagem = await contexto.renderAsync();
      const salva = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true });
      if (!salva.base64) throw new ScanPageError('unknown');

      const scan = await scanPage({
        imageBase64: salva.base64,
        imageMediaType: MEDIA_TYPE,
        bookId,
        bookTitle,
      });
      setEstado({ fase: 'resultado', scan });
    } catch (err) {
      setEstado({ fase: 'erro', falha: err instanceof ScanPageError ? err.code : 'unknown' });
    }
  }, [bookId, bookTitle]);

  const cabecalho = (
    <View style={[styles.topo, { paddingTop: insets.top + space.md }]}>
      <IconButton icon={X} accessibilityLabel="Fechar o assistente" onPress={fechar} variant="ghost" />
      <Text variant="callout" tone="secondary" numberOfLines={1} style={styles.tituloTopo}>
        {bookTitle ?? ''}
      </Text>
      <View style={styles.espacoTopo} />
    </View>
  );

  // A permissao ainda nao foi respondida: nao da para mostrar camera nem erro.
  if (!permissao) {
    return (
      <View style={styles.fundo}>
        <Stack.Screen options={{ animation: 'fade' }} />
        {cabecalho}
        <View style={styles.centro}>
          <ActivityIndicator color={color.accent} />
        </View>
      </View>
    );
  }

  // Sem permissao o assistente nao vira beco sem saida: o pedido continua a um
  // toque, e o texto diz para que serve a camera antes de pedir.
  if (!permissao.granted) {
    return (
      <View style={styles.fundo}>
        {cabecalho}
        <View style={[styles.centro, styles.aviso]}>
          <Glyph size={40} />
          <Text variant="heading" align="center">Preciso da câmera pra ver sua página</Text>
          <Text variant="body" tone="secondary" align="center">
            A foto serve só pra eu entender o trecho que você está lendo. Ela não fica salva em lugar nenhum.
          </Text>
          <Button onPress={() => { void pedirPermissao(); }}>Permitir a câmera</Button>
          <Button variant="ghost" onPress={fechar}>Agora não</Button>
        </View>
      </View>
    );
  }

  if (estado.fase === 'resultado') {
    const chip = scanChipLabel(
      estado.scan.book?.title ?? estado.scan.book_title_text,
      estado.scan.detected_page,
    );
    return (
      <View style={styles.fundo}>
        {cabecalho}
        <ScrollView
          style={styles.folha}
          contentContainerStyle={[styles.folhaConteudo, { paddingBottom: insets.bottom + space.xxl }]}
        >
          <View style={styles.identidade}>
            <Glyph size={22} />
            <Text variant="label">Assistente</Text>
            <View style={styles.flex} />
            {chip ? (
              <View style={styles.chip}>
                <Text variant="caption" tone="secondary">{chip}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.transcricao}>
            <Text variant="caption" tone="tertiary">O que eu li na sua foto</Text>
            <Text variant="reading" tone="secondary">{estado.scan.page_text}</Text>
          </View>

          <Text variant="subhead">Sobre o que você quer falar?</Text>
          <View style={styles.sugestoes}>
            {estado.scan.suggestions.map((sugestao) => (
              <View key={sugestao} style={styles.sugestao}>
                <Text variant="body">{sugestao}</Text>
              </View>
            ))}
          </View>

          <Button variant="ghost" onPress={fechar}>Fechar e voltar pro livro</Button>
        </ScrollView>
      </View>
    );
  }

  if (estado.fase === 'erro') {
    return (
      <View style={styles.fundo}>
        {cabecalho}
        <View style={[styles.centro, styles.aviso]}>
          <Glyph size={40} />
          <Text variant="body" align="center">{scanFailureLine(estado.falha)}</Text>
          <Button onPress={() => setEstado({ fase: 'camera' })}>Tirar outra foto</Button>
          <Button variant="ghost" onPress={fechar}>Agora não</Button>
        </View>
      </View>
    );
  }

  const enviando = estado.fase === 'enviando';

  return (
    <View style={styles.fundo}>
      {cabecalho}

      <View style={styles.visor}>
        <CameraView ref={camera} style={styles.flex} facing="back">
          <View style={styles.guia} />
        </CameraView>
      </View>

      <Text variant="body" align="center" style={styles.dica}>
        {enviando ? 'Lendo sua página...' : 'Enquadre a página inteira, com o número dela.'}
      </Text>

      <View style={[styles.rodape, { paddingBottom: insets.bottom + space.xl }]}>
        {enviando ? (
          <ActivityIndicator color={color.accent} size="large" />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fotografar a página"
            onPress={() => { void fotografar(); }}
            style={({ pressed }) => [styles.obturador, pressed ? styles.obturadorPressionado : null]}
          >
            <View style={styles.obturadorMiolo} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const OBTURADOR = 74;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fundo: { flex: 1, backgroundColor: color.bg },
  centro: { flex: 1, justifyContent: 'center' },
  aviso: { paddingHorizontal: space.gutter, gap: space.lg, alignItems: 'center' },

  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingBottom: space.md,
    gap: space.md,
  },
  tituloTopo: { flex: 1, textAlign: 'center' },
  espacoTopo: { width: space.huge },

  visor: {
    flex: 1,
    marginHorizontal: space.gutter,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: color.surface2,
  },
  // A moldura nao recorta nada: ela so diz onde a pagina cabe inteira.
  guia: {
    flex: 1,
    margin: space.lg,
    borderWidth: 2,
    borderColor: color.text2,
    borderRadius: radius.chip,
  },
  dica: { paddingHorizontal: space.xl, paddingTop: space.lg },

  rodape: { alignItems: 'center', paddingTop: space.lg, minHeight: OBTURADOR + space.xxl },
  obturador: {
    width: OBTURADOR,
    height: OBTURADOR,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: color.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  obturadorPressionado: { borderColor: color.accent },
  obturadorMiolo: {
    width: OBTURADOR - 16,
    height: OBTURADOR - 16,
    borderRadius: radius.pill,
    backgroundColor: color.text,
  },

  folha: {
    flex: 1,
    backgroundColor: color.surface1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    marginTop: space.xxl,
  },
  folhaConteudo: { padding: space.gutter, gap: space.lg },
  identidade: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chip: {
    backgroundColor: color.surface2,
    borderRadius: radius.tag,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  transcricao: {
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.control,
    padding: space.lg,
    gap: space.xs,
  },
  sugestoes: { gap: space.sm },
  sugestao: {
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.line2,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
});
