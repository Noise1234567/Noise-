import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { toApiError } from '../../src/api/errors';
import { authApi, completeSignIn } from '../../src/auth/session-service';
import {
  formatLocalPhone,
  toApiPhone,
  validateLogin,
  type FieldErrors,
  type LoginField,
} from '../../src/auth/forms';
import { formatClock, useCountdown } from '../../src/auth/useCountdown';
import { Banner } from '../../src/components/Banner';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { useSession } from '../../src/state/session';
import { spacing } from '../../src/theme';

/** Valeur de repli quand l'API ne précise pas le délai : la fenêtre de 15 minutes (docs/security.md). */
const DEFAULT_LOCK_SECONDS = 15 * 60;

/** Écran 4 (et variantes 4b–4d) : connexion. */
export default function Login() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<LoginField>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const sessionExpired = useSession((s) => s.sessionExpired);
  const lock = useCountdown();
  const locked = lock.remaining > 0;

  async function submit() {
    setBanner(null);
    const found = validateLogin({ phone, password });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      const session = await authApi.login({ phone: toApiPhone(phone), password });
      await completeSignIn(session);
    } catch (e) {
      const error = toApiError(e);
      if (error.status === 429) {
        lock.start(error.retryAfterSeconds ?? DEFAULT_LOCK_SECONDS);
      } else if (error.status === 401) {
        const left = error.remainingAttempts;
        setBanner(
          left !== undefined && left > 0
            ? `Numéro ou mot de passe incorrect. Il vous reste ${left} ${left > 1 ? 'essais' : 'essai'}.`
            : 'Numéro ou mot de passe incorrect.',
        );
      } else if (error.status === 403) {
        setBanner('Ce compte est suspendu. Contactez le support de Noise.');
      } else {
        setBanner(error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="title">Bon retour</Text>
          <Text muted style={styles.subtitle}>
            Connectez-vous avec votre numéro.
          </Text>

          {sessionExpired ? (
            <View style={styles.notice}>
              <Banner kind="info">Votre session a expiré. Reconnectez-vous pour continuer.</Banner>
            </View>
          ) : null}

          <View style={styles.form}>
            <TextField
              label="Numéro de téléphone"
              prefix="+229"
              value={phone}
              onChangeText={(value) => setPhone(formatLocalPhone(value))}
              error={errors.phone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              placeholder="01 66 08 31 74"
            />
            <TextField
              label="Mot de passe"
              secret
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
            />
            {banner ? <Banner kind="error">{banner}</Banner> : null}
            {locked ? (
              <Banner kind="warning">
                {`Trop d'essais. Par sécurité, patientez ${formatClock(lock.remaining)} avant de réessayer.`}
              </Banner>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Button
              label={locked ? `Patientez ${formatClock(lock.remaining)}` : 'Se connecter'}
              disabled={locked}
              loading={loading}
              onPress={submit}
            />
            <Button
              variant="text"
              label="Pas encore de compte ? Créer un compte"
              onPress={() => router.replace('/signup')}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: spacing.xl },
  subtitle: { marginTop: 6 },
  notice: { marginTop: spacing.lg },
  form: { gap: spacing.lg, marginTop: spacing.xl },
  actions: { gap: spacing.md, marginTop: spacing.xl },
});
