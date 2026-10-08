import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSession } from '../state/session';
import { spacing } from '../theme';
import { RoleSwitcher } from './RoleSwitcher';
import { Screen } from './Screen';
import { Text } from './Text';

type Props = {
  title: string;
  note: string;
  /** Affiche le sélecteur de rôle (écran principal de chaque vue). */
  withRoleSwitcher?: boolean;
  children?: ReactNode;
};

/** Écran provisoire : sert de point d'ancrage à la navigation jusqu'à la tâche qui le remplit. */
export function Placeholder({ title, note, withRoleSwitcher = false, children }: Props) {
  const activeRole = useSession((s) => s.activeRole);
  const switchRole = useSession((s) => s.switchRole);

  return (
    <Screen>
      {withRoleSwitcher && activeRole ? (
        <View style={styles.switcher}>
          <RoleSwitcher
            active={activeRole}
            onSelect={(role) => {
              // Rôle non activé : la feuille d'activation (maquette 16b) arrive avec le profil.
              switchRole(role);
            }}
          />
        </View>
      ) : null}
      <Text variant="title">{title}</Text>
      <Text muted style={styles.note}>
        {note}
      </Text>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switcher: { marginBottom: spacing.xl },
  note: { marginTop: spacing.sm },
});
