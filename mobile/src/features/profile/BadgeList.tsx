// Conquistas com progresso (spec 7.9). Toque abre o sheet com descricao e data.
import { View } from 'react-native';
import { ListRow } from '../../ui';
import { color } from '../../theme/tokens';
import { iconForCriteria, type DecoratedBadge } from '../../game/badges';
import { badgeStatusLine } from './logic';

interface Props {
  badges: DecoratedBadge[];
  onPressBadge: (badge: DecoratedBadge) => void;
}

export function BadgeList({ badges, onPressBadge }: Props) {
  return (
    <View>
      {badges.map((badge, i) => {
        const Icon = iconForCriteria(badge.criteria_type);
        const status = badgeStatusLine(badge);
        return (
          <ListRow
            key={badge.id}
            title={badge.name}
            subtitle={status}
            leading={<Icon size={22} color={badge.earned ? color.accent : color.text3} strokeWidth={2} />}
            onPress={() => onPressBadge(badge)}
            accessibilityLabel={`${badge.name}. ${status}.`}
            last={i === badges.length - 1}
          />
        );
      })}
    </View>
  );
}
