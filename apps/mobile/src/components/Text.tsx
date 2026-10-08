import { Text as RNText, type TextProps } from 'react-native';

import { colors, fontFamily } from '../theme';

type Variant = 'title' | 'section' | 'amount' | 'body' | 'button' | 'caption';

const variants: Record<Variant, object> = {
  title: { fontFamily: fontFamily.syne, fontSize: 28, lineHeight: 31 },
  section: { fontFamily: fontFamily.syne, fontSize: 20, lineHeight: 24 },
  amount: { fontFamily: fontFamily.syneExtra, fontSize: 20, lineHeight: 24 },
  body: { fontFamily: fontFamily.inter, fontSize: 15, lineHeight: 22 },
  button: { fontFamily: fontFamily.interSemi, fontSize: 16, lineHeight: 20 },
  caption: { fontFamily: fontFamily.inter, fontSize: 13, lineHeight: 18 },
};

type Props = TextProps & { variant?: Variant; muted?: boolean };

export function Text({ variant = 'body', muted = false, style, ...rest }: Props) {
  return (
    <RNText
      {...rest}
      style={[variants[variant], { color: muted ? colors.textMuted : colors.text }, style]}
    />
  );
}
