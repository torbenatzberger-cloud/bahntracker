// BahnTracker Design System - Inspiriert von Copilot Money

export const colors = {
  // Hintergrund (Dark Theme)
  background: {
    primary: '#0D1117',      // Haupthintergrund
    secondary: '#161B22',    // Cards, elevated surfaces
    tertiary: '#21262D',     // Input-Felder, Buttons
  },

  // Border/Divider
  border: {
    default: '#30363D',
    subtle: 'rgba(48, 54, 61, 0.6)',
    hover: 'rgba(88, 166, 255, 0.3)',
  },

  // Akzentfarben
  accent: {
    green: '#3FB950',
    greenLight: '#2EA043',
    red: '#F85149',
    orange: '#D29922',
    blue: '#58A6FF',
    purple: '#A371F7',
  },

  // Text
  text: {
    primary: '#F0F6FC',
    secondary: '#8B949E',
    tertiary: '#6E7681',
    disabled: '#484F58',
  },

  // Zugtyp-Badges
  trainType: {
    ICE: '#DC2626',
    IC: '#9333EA',
    EC: '#9333EA',
    RE: '#2563EB',
    RB: '#0891B2',
    S: '#16A34A',
    default: '#6E7681',
  },

  // Verspätungs-Farben
  delay: {
    onTime: '#22C55E',      // 0-5 min
    slight: '#EAB308',      // 6-15 min
    moderate: '#F97316',    // 16-30 min
    severe: '#EF4444',      // 30+ min
  },

  // Kategorie-Badges
  category: {
    distance: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6' },
    co2: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22C55E' },
    time: { bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7' },
    delay: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444' },
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 999,
};

export const typography = {
  // Hero Zahlen
  hero: {
    fontSize: 48,
    fontWeight: '800' as const,
    letterSpacing: -2,
  },
  // Section Headers
  header: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  // Card Titles
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  // Body Text
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
  },
  // Labels/Captions
  caption: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  // Badge Text
  badge: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
  },
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  cardHover: {
    shadowColor: '#58A6FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 12,
  },
};

// Utility-Funktion für Zugtyp-Farbe
export function getTrainTypeColor(trainType: string): string {
  const type = trainType.toUpperCase();
  return colors.trainType[type as keyof typeof colors.trainType] || colors.trainType.default;
}

// Utility-Funktion für Verspätungs-Farbe
export function getDelayColor(delayMinutes: number): string {
  if (delayMinutes <= 5) return colors.delay.onTime;
  if (delayMinutes <= 15) return colors.delay.slight;
  if (delayMinutes <= 30) return colors.delay.moderate;
  return colors.delay.severe;
}

// Card Style Helper
export const cardStyle = {
  backgroundColor: colors.background.secondary,
  borderRadius: borderRadius.xl,
  borderWidth: 1,
  borderColor: colors.border.subtle,
  padding: spacing.xl,
};

// Gradient für Charts (als String für SVG)
export const gradients = {
  spending: ['#EAB308', '#22C55E'],
  progress: ['#3B82F6', '#8B5CF6'],
};
