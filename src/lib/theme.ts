import { resolveAccentColorHex } from '@/lib/constants/ui';
import type { Theme, ThemeColors } from '@/types/theme';

export const lightColors: ThemeColors = {
  // Background colors
  background: '#F5F5F5',
  backgroundSecondary: '#09090999',
  backgroundStart: '#F8F8F400',
  backgroundEnd: '#F8F8F4',

  // Foreground colors
  foreground: '#000000',
  foregroundSecondary: '#374151',

  // Primary colors
  primary: '#F4F4F4',
  primaryForeground: '#000000',
  primaryMuted: 'rgba(59, 226, 190, 0.1)',

  // Border colors
  border: '#F8F8F400',
  borderSecondary: 'rgba(0, 0, 0, 0.05)',

  // Muted colors
  muted: 'rgba(0, 0, 0, 0.4)',
  mutedForeground: '#6b7280',

  // Accent colors
  accent: '#3BE2BE',
  accentForeground: '#ffffff',

  // Destructive colors
  destructive: '#ef4444',
  destructiveForeground: '#ffffff',

  // Success colors
  success: '#10b981',
  successForeground: '#ffffff',

  // Warning colors
  warning: '#f59e0b',
  warningForeground: '#ffffff',

  // Info colors
  info: '#3b82f6',
  infoForeground: '#ffffff',
};

export const darkColors: ThemeColors = {
  // Background colors
  background: '#FFFFFF0D',
  backgroundSecondary: '#FFFFFF05',
  backgroundStart: '#F8F8F400',
  backgroundEnd: '#F8F8F4',

  // Foreground colors
  foreground: '#FFFFFF',
  foregroundSecondary: '#e5e7eb',

  // Primary colors
  primary: '#0B0B0B',
  primaryForeground: '#FFFFFF',
  primaryMuted: 'rgba(59, 226, 190, 0.2)',

  // Border colors
  border: '#F8F8F400',
  borderSecondary: '#F8F8F4',

  // Muted colors
  muted: 'rgba(255, 255, 255, 0.4)',
  mutedForeground: '#9ca3af',

  // Accent colors
  accent: '#3BE2BE',
  accentForeground: '#0c0c0c',

  // Destructive colors
  destructive: '#ef4444',
  destructiveForeground: '#ffffff',

  // Success colors
  success: '#10b981',
  successForeground: '#ffffff',

  // Warning colors
  warning: '#f59e0b',
  warningForeground: '#ffffff',

  // Info colors
  info: '#3b82f6',
  infoForeground: '#ffffff',
};

export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function applyThemeToDOM(
  theme: Theme,
  systemTheme: 'light' | 'dark',
  accentColorHex?: string | null
): void {
  if (typeof window === 'undefined') return;

  const isDark =
    theme === 'dark' || (theme === 'system' && systemTheme === 'dark');
  const colors = isDark ? darkColors : lightColors;
  const resolvedAccentColorHex = resolveAccentColorHex(accentColorHex);

  // Apply theme class to document
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(isDark ? 'dark' : 'light');

  // Apply CSS custom properties
  Object.entries(colors).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--color-${key}`, value);
  });
  document.documentElement.style.setProperty(
    '--color-alias',
    resolvedAccentColorHex
  );

  // Apply legacy variables for backward compatibility
  document.documentElement.style.setProperty('--color-primary', colors.primary);
  document.documentElement.style.setProperty(
    '--color-foreground',
    colors.foreground
  );
  document.documentElement.style.setProperty(
    '--color-background-start',
    colors.backgroundStart
  );
  document.documentElement.style.setProperty(
    '--color-background-end',
    colors.backgroundEnd
  );

  // Apply Privy theme variables
  document.documentElement.style.setProperty(
    '--privy-color-background',
    colors.background
  );
  document.documentElement.style.setProperty(
    '--privy-color-background-2',
    isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
  );
  document.documentElement.style.setProperty(
    '--privy-color-accent-light',
    colors.primary
  );
  document.documentElement.style.setProperty(
    '--privy-color-accent',
    colors.primary
  );
  document.documentElement.style.setProperty(
    '--privy-color-foreground',
    colors.foreground
  );
  document.documentElement.style.setProperty(
    '--privy-color-foreground-1',
    colors.foreground
  );
  document.documentElement.style.setProperty(
    '--privy-color-foreground-2',
    colors.foregroundSecondary
  );
  document.documentElement.style.setProperty(
    '--privy-color-foreground-4',
    colors.primary
  );
  document.documentElement.style.setProperty(
    '--privy-color-accent-dark',
    colors.primaryMuted
  );
}

export function createThemeObserver(
  callback: (theme: 'light' | 'dark') => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handleChange = (e: MediaQueryListEvent) => {
    callback(e.matches ? 'dark' : 'light');
  };

  mediaQuery.addEventListener('change', handleChange);

  return () => mediaQuery.removeEventListener('change', handleChange);
}
