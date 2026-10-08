import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { toApiError } from '../../src/api/errors';
import { authApi, completeSignIn } from '../../src/auth/session-service';
import {
  formatLocalPhone,
  passwordHint,
  toApiPhone,
  validateSignup,
  type FieldErrors,
  type SignupField,
} from '../../src/auth/forms';
import { Banner } from '../../src/components/Banner';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { useSession, type AppRole } from '../../src/state/session';
import { colors, spacing } from '../../src/theme';

const roleLabel: Record<AppRole, string> = {
  PARTICIPANT: 'Participant',
  ORGANIZER: 'Organisateur',
};

/** Écran 3 (et variantes 3b–3d) : inscription. */
export default function Signup() {
  const router = useRouter();
  const pendingRole = useSession((s) => s.pendingRole);
  const signIn = useSession((s) => s.signIn);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<SignupField>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [phoneTaken, setPhoneTaken] = useState(false);
  const [loading, setLoading] = useState(false);

  const role: AppRole = pendingRole ?? 'PARTICIPANT';

  async function submit() {
    setBanner(null);
    setPhoneTaken(false);
    const found = validateSignup({ name, phone, password });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      const session = await authApi.register({
        name: name.trim(),
        phone: toApiPhone(phone),
        password,
        role,
      });
      await completeSignIn(session, role);
    } catch (e) {
      const error = toApiError(e);
      if (error.status === 409) {
        setPhoneTaken(true);
        setErrors({ phone: 'Ce numéro a déjà un compte.' });
      } else if (error.status === 429) {
        setBanner(
          'Trop de tentatives. Par sécurité, patientez quelques minutes avant de réessayer.',
        );
      } else if (error.status === 400) {
        setBanner('Certaines informations sont invalides. Vérifiez le formulaire.');
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
          <Text variant="title">Créer votre compte</Text>
          <View style={styles.profile}>
            <Text variant="caption" muted>
              Profil choisi : {roleLabel[role]} ·{' '}
            </Text>
            <Text
              variant="caption"
              accessibilityRole="button"
              onPress={() => router.back()}
              style={{ color: colors.secondary }}
            >
              Modifier
            </Text>
          </View>

          <View style={styles.form}>
            <TextField
              label="Nom complet"
              value={name}
              onChangeText={setName}
              error={errors.name}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
            />
            <View style={styles.phoneGroup}>
              <TextField
                label="Numéro de téléphone"
                prefix="+229"
                value={phone}
                onChangeText={(value) => setPhone(formatLocalPhone(value))}
                error={errors.phone}
                hint="10 chiffres, commençant par 01"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                placeholder="01 97 45 21 38"
              />
              {phoneTaken ? (
                <Text
                  variant="caption"
                  accessibilityRole="button"
                  onPress={() => router.replace('/login')}
                  style={{ color: colors.secondary }}
                >
                  Se connecter
                </Text>
              ) : null}
            </View>
            <TextField
              label="Mot de passe"
              secret
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              hint={passwordHint}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
            />
            {banner ? <Banner kind="error">{banner}</Banner> : null}
          </View>

          <View style={styles.actions}>
            <Button
              label={loading ? 'Création du compte…' : 'Créer mon compte'}
              loading={loading}
              onPress={submit}
            />
            <Button
              variant="text"
              label="Déjà un compte ? Se connecter"
              onPress={() => router.replace('/login')}
            />
            {/* Mode démo, développement uniquement : parcourir la navigation sans API. */}
            {__DEV__ ? (
              <Button
                variant="secondary"
                label="Mode démo (développement)"
                onPress={() => signIn(['PARTICIPANT', 'ORGANIZER'], role)}
              />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: spacing.xl },
  profile: { flexDirection: 'row', marginTop: spacing.sm },
  form: { gap: spacing.lg, marginTop: spacing.xl },
  phoneGroup: { gap: spacing.sm },
  actions: { gap: spacing.md, marginTop: spacing.xl },
});
