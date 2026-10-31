import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toApiError } from '../../src/api/errors';
import type { IdentityPhoto } from '../../src/api/identity';
import { Banner } from '../../src/components/Banner';
import { Button } from '../../src/components/Button';
import { StateView } from '../../src/components/StateView';
import { Text } from '../../src/components/Text';
import { IdentityStatusCard } from '../../src/features/identity/IdentityStatusCard';
import { identityApi } from '../../src/features/identity/identity-api';
import {
  canSubmitIdentity,
  identityView,
  submitErrorMessage,
} from '../../src/features/identity/identity-status';
import { type PhotoSource, pickIdentityPhoto } from '../../src/features/identity/pick-photo';
import { useIdentity } from '../../src/features/identity/useIdentity';
import { colors, radii, spacing } from '../../src/theme';

const PROMISES = [
  'Une photo lisible de votre pièce d’identité',
  'Seule l’équipe Noise la consulte',
  'Elle est supprimée au bout de 12 mois',
];

const leave = () => (router.canGoBack() ? router.back() : router.replace('/organizer'));

/**
 * Envoi de la pièce d'identité (DEC-018, NOISE-048). Mise en page de la feuille 16b : titre Syne,
 * trois lignes à coche cyan, bouton principal violet, lien cyan « Plus tard ».
 * La pièce envoyée ouvre déjà la création et la publication : l'équipe Noise valide ensuite.
 */
export default function OrganizerIdentity() {
  const insets = useSafeAreaInsets();
  const { identity, loading, error, retry, update } = useIdentity(identityApi.get);
  const [photo, setPhoto] = useState<IdentityPhoto | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const pick = async (source: PhotoSource) => {
    setProblem(null);
    try {
      const outcome = await pickIdentityPhoto(source);
      if (!outcome) return;
      if (outcome.ok) setPhoto(outcome.photo);
      else setProblem(outcome.message);
    } catch {
      setProblem('Impossible d’ouvrir la photo. Réessayez.');
    }
  };

  const send = async () => {
    if (!photo || sending) return;
    setSending(true);
    setProblem(null);
    try {
      update(await identityApi.submit(photo));
      leave();
    } catch (caught) {
      setProblem(submitErrorMessage(toApiError(caught)));
    } finally {
      setSending(false);
    }
  };

  const top = { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg };

  if (!identity) {
    return (
      <View style={[styles.root, top]}>
        {loading ? (
          <StateView kind="loading" />
        ) : (
          <StateView
            kind="error"
            message={error ?? 'Connexion impossible. Vérifiez votre réseau.'}
            onRetry={() => void retry()}
          />
        )}
      </View>
    );
  }

  // Pièce déjà envoyée ou vérifiée : rien à envoyer, on montre seulement le statut.
  if (!canSubmitIdentity(identity)) {
    return (
      <View style={[styles.root, top, styles.content]}>
        <Text variant="title">Votre pièce d’identité</Text>
        <IdentityStatusCard view={identityView(identity)} />
        <Button variant="secondary" label="Retour" onPress={leave} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, top]}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="title">Vérifiez votre identité</Text>

      {identity.status === 'REFUSED' ? <IdentityStatusCard view={identityView(identity)} /> : null}

      <View style={styles.promises}>
        {PROMISES.map((line) => (
          <View key={line} style={styles.promise}>
            <Ionicons name="checkmark-circle" size={22} color={colors.secondary} />
            <Text style={styles.promiseText}>{line}</Text>
          </View>
        ))}
      </View>
      <Text variant="caption" muted>
        Vous pouvez créer vos soirées dès l’envoi : l’équipe Noise valide ensuite votre pièce.
      </Text>

      <View
        style={styles.preview}
        accessibilityLabel={photo ? 'Aperçu de votre pièce' : 'Aucune photo choisie'}
      >
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.image} contentFit="contain" />
        ) : (
          <>
            <Ionicons name="id-card-outline" size={40} color={colors.textMuted} />
            <Text variant="caption" muted>
              Carte d’identité, passeport ou permis
            </Text>
          </>
        )}
      </View>

      <View style={styles.pickers}>
        <View style={styles.picker}>
          <Button
            variant="secondary"
            label="Prendre une photo"
            onPress={() => void pick('camera')}
          />
        </View>
        <View style={styles.picker}>
          <Button
            variant="secondary"
            label="Choisir dans la galerie"
            onPress={() => void pick('library')}
          />
        </View>
      </View>

      {problem ? <Banner kind="error">{problem}</Banner> : null}

      <Button
        label={sending ? 'Envoi en cours…' : 'Envoyer ma pièce'}
        loading={sending}
        disabled={!photo}
        onPress={() => void send()}
      />
      <Button variant="text" label="Plus tard" onPress={leave} disabled={sending} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  promises: { gap: spacing.md },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  promiseText: { flex: 1 },
  preview: {
    height: 200,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  pickers: { flexDirection: 'row', gap: spacing.sm },
  picker: { flex: 1 },
});
