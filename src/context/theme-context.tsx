'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

import {
  applyThemeToDOM,
  createThemeObserver,
  getSystemTheme,
} from '@/lib/theme';
import useAgentStore from '@/store/useAgentStore';
import type { Theme, ThemeContextType } from '@/types/theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [agentThemeApplied, setAgentThemeApplied] = useState(false);

  const agent = useAgentStore((state) => state.agent);

  // Initialize theme on mount
  useEffect(() => {
    const currentSystemTheme = getSystemTheme();
    setSystemTheme(currentSystemTheme);
    setMounted(true);

    // Apply theme to DOM
    applyThemeToDOM('light', currentSystemTheme);
  }, []);

  // Apply agent's default theme when agent is loaded
  useEffect(() => {
    if (mounted && agent?.defaults?.defaultTheme && !agentThemeApplied) {
      const agentTheme = agent.defaults.defaultTheme as Theme;
      setThemeState(agentTheme);
      applyThemeToDOM(agentTheme, systemTheme, agent.defaults.accentColorHex);
      setAgentThemeApplied(true);
    }
  }, [
    agent?.defaults?.accentColorHex,
    agent?.defaults?.defaultTheme,
    mounted,
    agentThemeApplied,
    systemTheme,
  ]);

  useEffect(() => {
    if (!mounted) return;

    applyThemeToDOM(theme, systemTheme, agent?.defaults?.accentColorHex);
  }, [agent?.defaults?.accentColorHex, mounted, systemTheme, theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (!mounted) return;

    const cleanup = createThemeObserver((newSystemTheme) => {
      setSystemTheme(newSystemTheme);
      if (theme === 'system') {
        applyThemeToDOM(theme, newSystemTheme, agent?.defaults?.accentColorHex);
      }
    });

    return cleanup;
  }, [agent?.defaults?.accentColorHex, theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyThemeToDOM(newTheme, systemTheme, agent?.defaults?.accentColorHex);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  const isDark =
    theme === 'dark' || (theme === 'system' && systemTheme === 'dark');

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <ThemeContext.Provider
        value={{
          theme: 'light',
          systemTheme: 'light',
          setTheme: () => {},
          toggleTheme: () => {},
          isDark: false,
        }}>
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        systemTheme,
        setTheme,
        toggleTheme,
        isDark,
      }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
