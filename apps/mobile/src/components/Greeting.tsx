import { StyleSheet } from 'react-native';

import { useSession } from '../state/session';
import { spacing } from '../theme';
import { Text } from './Text';

/** « Bonjour, Awa » : premier mot du nom du compte. */
export function Greeting() {
  const name = useSession((s) => s.user?.name);
  const first = name?.trim().split(/\s+/)[0];
  return (
    <Text variant="title" style={styles.title}>
      {first ? `Bonjour, ${first}` : 'Bonjour'}
    </Text>
  );
}

const styles = StyleSheet.create({ title: { marginBottom: spacing.sm } });
