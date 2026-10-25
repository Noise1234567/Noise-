import type { ScannerLinkDto } from '@noise/shared';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ScannerLinksApi } from '../../../api/scanner-links';
import { toApiError } from '../../../api/errors';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Text } from '../../../components/Text';
import { TextField } from '../../../components/TextField';
import { colors, radii, spacing } from '../../../theme';
import { formatCotonouDateTime } from '../my-events/group';
import {
  LINK_DURATIONS,
  LINK_STATUS_LABELS,
  scannerShareMessage,
  scannerShareUrl,
} from './event-detail-rules';

type Props = {
  eventId: string;
  eventTitle: string;
  /** Événement publié et pas terminé : sinon on liste les liens sans en créer. */
  canCreate: boolean;
  api: ScannerLinksApi;
  apiBaseUrl: string;
  /** Ouvre le partage du téléphone (WhatsApp, SMS…) ; injecté pour les tests. */
  share: (message: string) => Promise<void>;
};

type Load =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; links: ScannerLinkDto[] };

/**
 * Liens scanner (NOISE-054, API NOISE-024) : un lien par membre du staff, partagé aussitôt
 * créé (son jeton n'est montré qu'une fois), révocable si le téléphone est perdu.
 */
export function ScannerLinks({ eventId, eventTitle, canCreate, api, apiBaseUrl, share }: Props) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [label, setLabel] = useState('');
  const [hours, setHours] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ message: string; label: string | null } | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoad({ kind: 'ready', links: await api.list(eventId) });
    } catch (e) {
      setLoad({ kind: 'error', message: toApiError(e).message });
    }
  }, [api, eventId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createLink() {
    setError(null);
    setBusy(true);
    try {
      const name = label.trim() || undefined;
      const result = await api.create({ eventId, label: name, durationHours: hours });
      const message = scannerShareMessage(
        eventTitle,
        scannerShareUrl(result, apiBaseUrl),
        result.link.label,
      );
      setCreated({ message, label: result.link.label });
      setLabel('');
      await refresh();
      await share(message).catch(() => undefined);
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(linkId: string) {
    setError(null);
    try {
      await api.revoke(linkId);
      setConfirmRevoke(null);
      await refresh();
    } catch (e) {
      setError(toApiError(e).message);
    }
  }

  return (
    <View style={styles.root}>
      <Text variant="section">Liens scanner</Text>
      <Text variant="caption" muted>
        Un lien par membre du staff : il ouvre le scanner sur son téléphone, sans compte.
      </Text>

      {canCreate ? (
        <View style={styles.form}>
          <TextField
            label="Nom du membre du staff"
            value={label}
            onChangeText={setLabel}
            placeholder="Porte A — Koffi"
            maxLength={60}
          />
          <View style={styles.row}>
            {LINK_DURATIONS.map((d) => (
              <Pressable
                key={d.label}
                accessibilityRole="button"
                accessibilityState={{ selected: hours === d.hours }}
                onPress={() => setHours(d.hours)}
                style={[styles.chip, hours === d.hours ? styles.chipSelected : null]}
              >
                <Text variant="caption">{d.label}</Text>
              </Pressable>
            ))}
          </View>
          <Button
            variant="secondary"
            label="Créer et partager un lien"
            loading={busy}
            onPress={() => void createLink()}
          />
        </View>
      ) : (
        <Text variant="caption" muted>
          Publiez l’événement pour créer des liens scanner.
        </Text>
      )}

      {created ? (
        <View style={styles.created}>
          <Text variant="caption">
            Lien créé{created.label ? ` pour ${created.label}` : ''}. Il n’est affiché qu’une fois :
            partagez-le maintenant.
          </Text>
          <Button
            variant="text"
            label="Partager à nouveau"
            onPress={() => void share(created.message)}
          />
        </View>
      ) : null}
      {error ? <Banner kind="error">{error}</Banner> : null}

      {load.kind === 'loading' ? (
        <Text variant="caption" muted>
          Chargement des liens…
        </Text>
      ) : null}
      {load.kind === 'error' ? (
        <View style={styles.row}>
          <Text variant="caption" muted style={styles.flex}>
            {load.message}
          </Text>
          <Button variant="text" label="Réessayer" onPress={() => void refresh()} />
        </View>
      ) : null}
      {load.kind === 'ready'
        ? load.links.map((link) => (
            <View key={link.id} style={styles.link}>
              <View style={styles.flex}>
                <Text variant="button">{link.label ?? 'Lien sans nom'}</Text>
                <Text variant="caption" muted>
                  {LINK_STATUS_LABELS[link.status]} · valable jusqu’au{' '}
                  {formatCotonouDateTime(link.expiresAt)}
                </Text>
              </View>
              {link.status === 'ACTIVE' ? (
                confirmRevoke === link.id ? (
                  <Button
                    variant="secondary"
                    label="Confirmer"
                    onPress={() => void revoke(link.id)}
                  />
                ) : (
                  <Text
                    variant="caption"
                    accessibilityRole="button"
                    accessibilityLabel={`Révoquer ${link.label ?? 'le lien'}`}
                    onPress={() => setConfirmRevoke(link.id)}
                    style={{ color: colors.error }}
                  >
                    Révoquer
                  </Text>
                )
              ) : null}
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  form: { gap: spacing.md },
  flex: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { borderColor: colors.secondary },
  created: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.field,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
});
