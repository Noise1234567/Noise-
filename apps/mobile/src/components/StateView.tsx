import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

type Props =
  | { kind: 'loading'; message?: string }
  | { kind: 'error'; message: string; onRetry: () => void }
  | { kind: 'empty'; title: string; message: string };

/** Les trois états d'un écran de liste : chargement, erreur avec « Réessayer », liste vide. */
export function StateView(props: Props) {
  return (
    <View style={styles.root} accessibilityLiveRegion="polite">
      {props.kind === 'loading' ? (
        <>
          <ActivityIndicator color={colors.secondary} accessibilityLabel="Chargement" />
          <Text muted>{props.message ?? 'Chargement…'}</Text>
        </>
      ) : null}
      {props.kind === 'error' ? (
        <>
          <Text variant="section">Impossible de charger</Text>
          <Text muted style={styles.center}>
            {props.message}
          </Text>
          <Button variant="secondary" label="Réessayer" onPress={props.onRetry} />
        </>
      ) : null}
      {props.kind === 'empty' ? (
        <>
          <Text variant="section">{props.title}</Text>
          <Text muted style={styles.center}>
            {props.message}
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  center: { textAlign: 'center' },
});
