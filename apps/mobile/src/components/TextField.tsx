import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fontFamily, minTouchTarget, radii, spacing } from '../theme';
import { Text } from './Text';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  hint?: string;
  /** Préfixe fixe (ex. « +229 »), affiché dans un bloc à gauche. */
  prefix?: string;
  /** Champ mot de passe : ajoute le bouton Afficher / Masquer. */
  secret?: boolean;
};

/** Champ de saisie des maquettes : libellé, hauteur 52 dp, bordure rouge si erreur. */
export function TextField({ label, error, hint, prefix, secret = false, ...input }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.group}>
      <Text variant="caption" muted style={styles.label}>
        {label}
      </Text>
      <View style={styles.row}>
        {prefix ? (
          <View style={[styles.box, styles.prefix]}>
            <Text style={styles.value}>{prefix}</Text>
          </View>
        ) : null}
        <View style={[styles.box, styles.field, error ? styles.invalid : null]}>
          <TextInput
            {...input}
            accessibilityLabel={label}
            secureTextEntry={secret && !visible}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          {secret ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              onPress={() => setVisible((v) => !v)}
              style={styles.toggle}
            >
              <Text variant="caption" style={{ color: colors.secondary }}>
                {visible ? 'Masquer' : 'Afficher'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {error ? (
        <Text variant="caption" accessibilityRole="alert" style={{ color: colors.errorText }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  label: { fontFamily: fontFamily.interMedium },
  row: { flexDirection: 'row', gap: spacing.sm },
  box: {
    minHeight: 52,
    borderRadius: radii.field,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefix: { paddingHorizontal: 14 },
  field: { flex: 1, paddingLeft: 14 },
  invalid: { borderColor: colors.error },
  value: { fontFamily: fontFamily.interMedium, fontSize: 16 },
  input: { flex: 1, color: colors.text, fontFamily: fontFamily.inter, fontSize: 16, minHeight: 50 },
  toggle: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
});
