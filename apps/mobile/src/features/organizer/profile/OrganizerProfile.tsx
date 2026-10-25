import type { MyIdentityResponse, PublicUser } from '@noise/shared';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import type { OrganizerProfileApi } from '../../../api/organizer-profile';
import { toApiError } from '../../../api/errors';
import { formatLocalPhone, type FieldErrors } from '../../../auth/forms';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { StateView } from '../../../components/StateView';
import { Text } from '../../../components/Text';
import { TextField } from '../../../components/TextField';
import { colors, radii, spacing } from '../../../theme';
import {
  displayPhone,
  identitySummary,
  toForm,
  validateContactForm,
  type ContactField,
  type ContactForm,
} from './profile-rules';

type Props = {
  api: Pick<OrganizerProfileApi, 'get' | 'save' | 'identity'>;
  user: PublicUser | null;
  onLogout: () => void;
};

const EMPTY_FORM: ContactForm = { whatsapp: '', instagram: '', facebook: '', tiktok: '' };

/**
 * Écran 26 : Profil organisateur (NOISE-061). Compte, état de la pièce d'identité, contacts
 * publics (WhatsApp, réseaux) affichés aux participants, déconnexion confirmée.
 */
export function OrganizerProfile({ api, user, onLogout }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<MyIdentityResponse | null>(null);
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors<ContactField>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [profile, mine] = await Promise.all([api.get(), api.identity()]);
      setForm(toForm(profile));
      setIdentity(mine);
    } catch (e) {
      setLoadError(toApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (field: ContactField) => (value: string) => {
    setForm((current) => ({
      ...current,
      [field]: field === 'whatsapp' ? formatLocalPhone(value) : value,
    }));
    setFeedback(null);
  };

  async function save() {
    const { errors: found, input } = validateContactForm(form);
    setErrors(found);
    if (!input) return;
    setSaving(true);
    setFeedback(null);
    try {
      setForm(toForm(await api.save(input)));
      setFeedback({ kind: 'info', text: 'Contacts enregistrés.' });
    } catch (e) {
      setFeedback({ kind: 'error', text: toApiError(e).message });
    } finally {
      setSaving(false);
    }
  }

  const confirmLogout = () =>
    Alert.alert('Se déconnecter ?', 'Vous devrez vous reconnecter avec votre numéro.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: onLogout },
    ]);

  if (loading) return <StateView kind="loading" />;
  if (loadError) return <StateView kind="error" message={loadError} onRetry={() => void load()} />;

  const summary = identity ? identitySummary(identity) : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="title">Profil</Text>

        <View style={styles.card}>
          <Text variant="button">{user?.name ?? ''}</Text>
          <Text muted>{user ? displayPhone(user.phone) : ''}</Text>
          {user?.email ? <Text muted>{user.email}</Text> : null}
        </View>

        {summary ? (
          <View style={styles.section}>
            <Text variant="section">Pièce d’identité</Text>
            <Text variant="button" style={styles.status}>
              {summary.label}
            </Text>
            <Banner kind={summary.kind}>{summary.detail}</Banner>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text variant="section">Contacts publics</Text>
          <Text muted>
            Facultatifs. Les participants les voient sur la page de vos événements pour vous
            contacter.
          </Text>
          <TextField
            label="WhatsApp"
            prefix="+229"
            value={form.whatsapp}
            onChangeText={set('whatsapp')}
            error={errors.whatsapp}
            keyboardType="phone-pad"
            placeholder="01 97 45 21 38"
          />
          <TextField
            label="Instagram"
            value={form.instagram}
            onChangeText={set('instagram')}
            error={errors.instagram}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="@votre.compte ou lien"
          />
          <TextField
            label="Facebook"
            value={form.facebook}
            onChangeText={set('facebook')}
            error={errors.facebook}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="Lien de votre page"
          />
          <TextField
            label="TikTok"
            value={form.tiktok}
            onChangeText={set('tiktok')}
            error={errors.tiktok}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="@votre.compte ou lien"
          />
          {feedback ? <Banner kind={feedback.kind}>{feedback.text}</Banner> : null}
          <Button label="Enregistrer mes contacts" loading={saving} onPress={() => void save()} />
        </View>

        <View style={styles.section}>
          <Button variant="secondary" label="Se déconnecter" onPress={confirmLogout} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  card: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  section: { gap: spacing.md },
  status: { color: colors.secondary },
});
