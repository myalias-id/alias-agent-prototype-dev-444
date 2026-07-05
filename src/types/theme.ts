export type Theme = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  theme: Theme;
  systemTheme?: 'light' | 'dark';
}

export interface ThemeContextType {
  theme: Theme;
  systemTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

export interface ThemeColors {
  // Background colors
  background: string;
  backgroundSecondary: string;
  backgroundStart: string; // for gradients/legacy vars
  backgroundEnd: string; // for gradients/legacy vars

  // Foreground colors
  foreground: string;
  foregroundSecondary: string;

  // Primary colors
  primary: string;
  primaryForeground: string;
  primaryMuted: string;

  // Border colors
  border: string;
  borderSecondary: string;

  // Muted colors
  muted: string;
  mutedForeground: string;

  // Accent colors
  accent: string;
  accentForeground: string;

  // Destructive colors
  destructive: string;
  destructiveForeground: string;

  // Success colors
  success: string;
  successForeground: string;

  // Warning colors
  warning: string;
  warningForeground: string;

  // Info colors
  info: string;
  infoForeground: string;
}
