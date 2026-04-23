import { useRef, useCallback } from 'react';
import { View } from 'react-native';
import LottieView from 'lottie-react-native';
import { useFocusEffect } from 'expo-router';

const SOURCES: Record<string, any> = {
  'flame-streak': require('../../assets/lottie/flame-streak.json'),
  'confetti':     require('../../assets/lottie/confetti.json'),
  'pulse-ring':   require('../../assets/lottie/pulse-ring.json'),
  'level-up':     require('../../assets/lottie/level-up.json'),
};

type RenderMode = 'HARDWARE' | 'SOFTWARE' | 'AUTOMATIC';

interface Props {
  name: 'flame-streak' | 'confetti' | 'pulse-ring' | 'level-up';
  size: number;
  loop?: boolean;
  /** Se false, a animação não toca automaticamente — só quando a tela ganha foco (one-shot). Default: true. */
  autoplay?: boolean;
  /** Fallback visual quando o JSON está ausente ou vazio. */
  fallback?: React.ReactNode;
  /**
   * 'HARDWARE' é acelerado por GPU (default); use 'AUTOMATIC' em devices Android
   * antigos se a animação tem mask/matte e glitcha.
   */
  renderMode?: RenderMode;
}

export function LottieSlot({
  name,
  size,
  loop = true,
  autoplay = true,
  fallback,
  renderMode = 'HARDWARE',
}: Props) {
  const src = SOURCES[name];
  const isEmpty = !src || (typeof src === 'object' && Object.keys(src).length === 0);
  const ref = useRef<LottieView>(null);

  // Foco: pausa/resume para loops, replay para one-shots.
  useFocusEffect(
    useCallback(() => {
      if (isEmpty) return;
      if (loop) {
        ref.current?.play();
      } else if (!autoplay) {
        // One-shot com replay on focus — reset + play para garantir recomeço.
        ref.current?.reset();
        ref.current?.play();
      }
      return () => {
        ref.current?.pause();
      };
    }, [loop, autoplay, isEmpty]),
  );

  if (isEmpty) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <View style={{ width: size, height: size }}>
      <LottieView
        ref={ref}
        source={src}
        autoPlay={autoplay && loop}
        loop={loop}
        renderMode={renderMode}
        style={{ width: size, height: size }}
      />
    </View>
  );
}
