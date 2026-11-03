import type { OrganizerContactDto } from '@noise/shared';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../../components/Button';
import { Text } from '../../components/Text';
import { colors, spacing } from '../../theme';
import { hasContact, socialEntries, whatsappUrl } from './organizer-contact';

type Props = {
  organizerName: string;
  eventTitle: string;
  contact: OrganizerContactDto;
  /** Ouverture d'un lien (WhatsApp, réseau) ; remplaçable dans les tests. */
  openUrl?: (url: string) => Promise<unknown>;
};

/**
 * Contacter l'organisateur depuis la page d'un événement (NOISE-061) : WhatsApp avec un message
 * prérempli, et ses réseaux. Rien n'est affiché s'il n'a renseigné aucun contact.
 */
export function OrganizerContact({
  organizerName,
  eventTitle,
  contact,
  openUrl = Linking.openURL,
}: Props) {
  if (!hasContact(contact)) return null;
  const open = (url: string) => void openUrl(url).catch(() => undefined);
  const socials = socialEntries(contact);

  return (
    <View style={styles.root}>
      <Text variant="section">Organisateur</Text>
      <Text muted>{organizerName}</Text>
      {contact.whatsapp ? (
        <Button
          variant="secondary"
          label="Contacter l’organisateur"
          onPress={() => open(whatsappUrl(contact.whatsapp ?? '', eventTitle))}
        />
      ) : null}
      {socials.length > 0 ? (
        <View style={styles.links}>
          {socials.map((entry) => (
            <Pressable
              key={entry.key}
              accessibilityRole="link"
              accessibilityLabel={`${entry.label} de l’organisateur`}
              onPress={() => open(entry.url)}
              hitSlop={8}
            >
              <Text variant="button" style={styles.link}>
                {entry.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm, marginTop: spacing.xl },
  links: { flexDirection: 'row', gap: spacing.lg },
  link: { color: colors.secondary },
});
