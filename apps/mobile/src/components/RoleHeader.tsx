import { StyleSheet, View } from 'react-native';

import { useSession } from '../state/session';
import { spacing } from '../theme';
import { RoleSwitcher } from './RoleSwitcher';

/** Sélecteur de rôle en haut de l'écran principal de chaque vue. */
export function RoleHeader() {
  const activeRole = useSession((s) => s.activeRole);
  const switchRole = useSession((s) => s.switchRole);
  if (!activeRole) return null;
  return (
    <View style={styles.root}>
      <RoleSwitcher active={activeRole} onSelect={switchRole} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { marginBottom: spacing.xl } });
