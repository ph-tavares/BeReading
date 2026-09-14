// src/components/QuizMessageScreen.tsx
// BER-67: extraído de app/quiz/[chapterId].tsx, que tinha ultrapassado 640 linhas
// somando um bloco de markup quase idêntico para cada estado "de mensagem"
// (polling, still-generating, no-content, failed/vazio). É puro reposicionamento
// de JSX — nenhum dos quatro estados mudou de aparência ou de comportamento.
import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { colors, fonts } from '../theme/tokens';

interface QuizMessageIconBadgeProps {
  background: string;
  borderColor: string;
  children: ReactNode;
}

/** Círculo colorido com ícone, usado no topo dos estados polling/still-generating/no-content. */
export function QuizMessageIconBadge({ background, borderColor, children }: QuizMessageIconBadgeProps) {
  return (
    <View style={{
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: background,
      borderBottomWidth: 4,
      borderBottomColor: borderColor,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    }}>
      {children}
    </View>
  );
}

interface QuizMessageScreenProps {
  icon: ReactNode;
  title: string;
  description: string;
  /** Conteúdo extra entre a descrição e as ações (ex: indicador de progresso do polling). */
  extra?: ReactNode;
  /** 'space-between' empurra `children` para o rodapé; 'center' mantém tudo agrupado. */
  justify?: 'space-between' | 'center';
  paddingTop: number;
  paddingBottom: number;
  titleSize?: number;
  titleMarginBottom?: number;
  descriptionSize?: number;
  descriptionMarginBottom?: number;
  /** Ações da tela (botões/links), já montadas pelo chamador com seu próprio layout. */
  children?: ReactNode;
}

export function QuizMessageScreen({
  icon,
  title,
  description,
  extra,
  justify = 'space-between',
  paddingTop,
  paddingBottom,
  titleSize = 22,
  titleMarginBottom = 12,
  descriptionSize = 15,
  descriptionMarginBottom = 0,
  children,
}: QuizMessageScreenProps) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: colors.bg,
      paddingTop,
      paddingBottom,
      paddingHorizontal: 32,
      alignItems: 'center',
      justifyContent: justify,
    }}>
      <View style={{ alignItems: 'center' }}>
        {icon}
        <Text style={{
          fontFamily: fonts.black,
          fontSize: titleSize,
          color: colors.text,
          marginBottom: titleMarginBottom,
          textAlign: 'center',
          letterSpacing: -0.3,
        }}>{title}</Text>
        <Text style={{
          fontFamily: fonts.medium,
          fontSize: descriptionSize,
          color: colors.textSoft,
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: descriptionMarginBottom,
        }}>{description}</Text>
        {extra}
      </View>
      {children}
    </View>
  );
}
