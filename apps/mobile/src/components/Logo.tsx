import { View } from 'react-native';

import { colors, fontFamily } from '../theme';
import { Text } from './Text';

/** Logotype : « noise » en Syne 800 minuscule suivi d'un point violet. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <Text style={{ fontFamily: fontFamily.syneExtra, fontSize: size, lineHeight: size * 1.1 }}>
        noise
      </Text>
      <Text
        style={{
          fontFamily: fontFamily.syneExtra,
          fontSize: size,
          lineHeight: size * 1.1,
          color: colors.accent,
        }}
      >
        .
      </Text>
    </View>
  );
}
