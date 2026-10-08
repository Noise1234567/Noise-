import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '../theme';

/** Fond d'écran sombre avec les marges de sécurité et la marge latérale de 16 dp. */
export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
});
