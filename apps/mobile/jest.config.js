/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Le premier rendu d'un écran compile expo-image et les icônes : 5 s (défaut)
  // est trop juste sur une machine chargée.
  testTimeout: 20000,
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  moduleNameMapper: {
    // Stockage en mémoire fourni par la bibliothèque : pas de module natif dans les tests.
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
};
