// Jetons de design tirés de la planche de maquettes (système de design).
// Un seul endroit pour les couleurs, espacements et rayons : aucun écran n'écrit de valeur en dur.

export const colors = {
  background: '#0A0A0A',
  surface: '#1A1A1A',
  /** Une seule action principale par écran, et les validations. */
  accent: '#00FF87',
  /** Liens, informations, éléments actifs (onglet, minuteur, jauge). */
  secondary: '#00C4FF',
  text: '#E8E8E8',
  textMuted: 'rgba(232,232,232,0.6)',
  border: 'rgba(255,255,255,0.1)',
  /** Erreurs et états uniquement. */
  error: '#FF5A5F',
  /** Message d'erreur sous un champ (rouge adouci, lisible sur fond sombre). */
  errorText: '#FF8A8E',
  /** Attente et états uniquement. */
  warning: '#FFB547',
  /** Élévation au-dessus des cartes (toasts). */
  toast: '#262626',
  /** Texte posé sur un fond vert. */
  onAccent: '#0A0A0A',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  chip: 6,
  field: 12,
  button: 14,
  card: 16,
  sheet: 24,
} as const;

/** Zone tactile minimale (dp). */
export const minTouchTarget = 48;
