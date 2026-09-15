// Detalhe da conquista (spec 7.9): nome, descricao e data ou progresso.
import { StyleSheet, View } from 'react-native';
import { Button, Sheet, Text } from '../../ui';
import { color, space } from '../../theme/tokens';
import { iconForCriteria, type DecoratedBadge } from '../../game/badges';
import { badgeStatusLine } from './logic';

interface Props {
  badge: DecoratedBadge | null;
  onDismiss: () => void;
}

export function BadgeSheet({ badge, onDismiss }: Props) {
  const Icon = badge ? iconForCriteria(badge.criteria_type) : null;
  return (
    <Sheet visible={badge !== null} onDismiss={onDismiss} accessibilityLabel={badge?.name ?? 'Conquista'}>
      {badge && Icon ? (
        <View style={styles.corpo}>
          <Icon size={36} color={badge.earned ? color.accent : color.text3} strokeWidth={1.8} />
          <Text variant="heading">{badge.name}</Text>
          <Text variant="body" tone="secondary">{badge.description}</Text>
          {badge.earned || badge.progress ? (
            <Text variant="callout" tone={badge.earned ? 'accent' : 'tertiary'}>{badgeStatusLine(badge)}</Text>
          ) : null}
          <Button variant="secondary" onPress={onDismiss}>Fechar</Button>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  corpo: { gap: space.md },
});
