import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { spacing } from '../theme';
import { Screen } from './Screen';
import { Text } from './Text';

type Props = {
  title: string;
  note: string;
  children?: ReactNode;
};

/** Écran provisoire : sert de point d'ancrage à la navigation jusqu'à la tâche qui le remplit. */
export function Placeholder({ title, note, children }: Props) {
  return (
    <Screen>
      <Text variant="title">{title}</Text>
      <Text muted style={styles.note}>
        {note}
      </Text>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: spacing.sm },
});
