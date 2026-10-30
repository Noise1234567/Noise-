import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
};

/**
 * Invitation affichée à la place d'un écran réservé aux comptes (Mes billets, Profil) quand le
 * visiteur n'est pas connecté (NOISE-075). La connexion s'ouvre par-dessus : une fois connecté,
 * on retombe sur l'écran d'où l'on vient.
 */
export function GuestGate({ icon, title, message }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={28} color={colors.textMuted} />
      </View>
      <Text variant="section">{title}</Text>
      <Text muted style={styles.center}>
        {message}
      </Text>
      <View style={styles.actions}>
        <Button label="Se connecter" onPress={() => router.push('/login')} />
        <Button variant="text" label="Créer un compte" onPress={() => router.push('/')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center', paddingHorizontal: spacing.xl },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.md },
});
