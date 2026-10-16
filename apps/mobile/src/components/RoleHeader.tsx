import { StyleSheet, View } from 'react-native';

import { useSession } from '../state/session';
import { spacing } from '../theme';
import { RoleSwitcher } from './RoleSwitcher';

/** Sélecteur de rôle en haut de l'écran principal de chaque vue. */
export function RoleHeader() {
  const activeRole = useSession((s) => s.activeRole);
  const roles = useSession((s) => s.roles);
  const switchRole = useSession((s) => s.switchRole);
  // Le sélecteur n'existe que pour un compte qui a les deux rôles (CDC 3.1).
  if (!activeRole || roles.length < 2) return null;
  return (
    <View style={styles.root}>
      <RoleSwitcher active={activeRole} onSelect={switchRole} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { marginBottom: spacing.xl } });
