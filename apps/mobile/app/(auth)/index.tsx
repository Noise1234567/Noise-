import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Logo } from '../../src/components/Logo';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { RoleCard } from '../../src/components/RoleCard';
import { Button } from '../../src/components/Button';
import { useSession } from '../../src/state/session';
import { spacing } from '../../src/theme';

/** Écran 2 : Bienvenue. Le rôle choisi est mémorisé et pré-remplit l'inscription. */
export default function Welcome() {
  const router = useRouter();
  const setPendingRole = useSession((s) => s.setPendingRole);

  return (
    <Screen>
      <Logo />
      <View style={styles.spacer} />
      <Text variant="title" style={styles.headline}>
        Toutes les soirées de Cotonou, dans votre poche.
      </Text>
      <View style={styles.cards}>
        <RoleCard
          title="Je suis participant"
          subtitle="J'achète mes billets"
          onPress={() => {
            setPendingRole('PARTICIPANT');
            router.push('/signup');
          }}
        />
        <RoleCard
          title="Je suis organisateur"
          subtitle="Je vends des billets pour mes soirées"
          onPress={() => {
            setPendingRole('ORGANIZER');
            router.push('/signup');
          }}
        />
      </View>
      <Button variant="text" label="J'ai déjà un compte" onPress={() => router.push('/login')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  spacer: { flex: 1 },
  headline: { marginBottom: spacing.xl },
  cards: { gap: spacing.md, marginBottom: spacing.lg },
});
