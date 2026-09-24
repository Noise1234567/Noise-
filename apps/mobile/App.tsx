import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

// Écran temporaire. Thème, navigation et écrans d'auth : NOISE-008.
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Noise</Text>
      <Text style={styles.subtitle}>Billetterie Cotonou — en construction</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#00FF87', fontSize: 40, fontWeight: '800' },
  subtitle: { color: '#E8E8E8', marginTop: 8 },
});
