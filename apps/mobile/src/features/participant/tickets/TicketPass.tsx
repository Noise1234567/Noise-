import type { TicketDto } from '@noise/shared';
import * as Brightness from 'expo-brightness';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '../../../components/Button';
import { Text } from '../../../components/Text';
import { colors, radii, spacing } from '../../../theme';
import { formatEventRange } from '../format';
import { TICKET_STATUS_LABELS, canShowQr } from './ticket-list';

/** Taille maximale du QR : au-delà, il ne se lit pas mieux et déborde des petits écrans. */
const QR_MAX = 320;

/**
 * Luminosité au maximum tant que le QR est affiché (lecture par le scanner, même en plein
 * soleil), puis retour au réglage du système. Seule la fenêtre de l'app est concernée :
 * aucune permission n'est demandée. Un échec n'empêche jamais l'affichage du QR.
 */
function useMaxBrightness(active: boolean) {
  useEffect(() => {
    if (!active) return;
    void Brightness.setBrightnessAsync(1).catch(() => undefined);
    return () => {
      void Brightness.restoreSystemBrightnessAsync().catch(() => undefined);
    };
  }, [active]);
}

/** Écran 15 : billet en plein écran avec son QR (NOISE-022), affiché depuis le cache. */
export function TicketPass({ ticket, onClose }: { ticket: TicketDto; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const showQr = canShowQr(ticket);
  useMaxBrightness(showQr);
  const size = Math.min(width - spacing.xl * 2 - spacing.lg * 2, QR_MAX);

  return (
    <View style={styles.root}>
      <Text variant="title" style={styles.center}>
        {ticket.eventTitle}
      </Text>
      <Text muted style={styles.center}>
        {formatEventRange(ticket.eventStartsAt, ticket.eventEndsAt)}
      </Text>
      <Text muted style={styles.center}>
        {ticket.venue}, {ticket.city}
      </Text>

      {showQr ? (
        // Fond blanc et marge : le contraste dont ont besoin les lecteurs de QR.
        <View style={styles.qr} accessibilityLabel="QR code du billet">
          <QRCode value={ticket.qrPayload} size={size} ecl="M" backgroundColor="#FFFFFF" />
        </View>
      ) : (
        <View style={[styles.qr, styles.qrOff, { width: size + spacing.lg * 2 }]}>
          <Text variant="section" style={styles.center}>
            Billet {TICKET_STATUS_LABELS[ticket.status].toLowerCase()}
          </Text>
          <Text muted style={styles.center}>
            {ticket.status === 'CANCELLED'
              ? 'Cet événement a été annulé : ce billet ne permet plus d’entrer.'
              : 'Ce billet a déjà été scanné à l’entrée.'}
          </Text>
        </View>
      )}

      <View style={styles.details}>
        <Text variant="button">{ticket.holderName}</Text>
        <Text muted>{ticket.ticketTypeName}</Text>
      </View>
      <Text variant="caption" muted style={styles.center}>
        Présentez ce QR à l’entrée. Il fonctionne sans réseau.
      </Text>
      <Button variant="secondary" label="Fermer" onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.md, justifyContent: 'center' },
  center: { textAlign: 'center' },
  qr: {
    alignSelf: 'center',
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: '#FFFFFF',
    marginVertical: spacing.md,
  },
  qrOff: {
    backgroundColor: colors.surface,
    aspectRatio: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  details: { alignItems: 'center', gap: spacing.xs },
});
