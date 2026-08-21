import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeApi {
  preference: ThemePreference;
  setPreference(preference: ThemePreference): void;
}

const storageKey = 'ottlib-theme-preference';
const ThemeContext = createContext<ThemeApi | undefined>(undefined);

function readPreference(): ThemePreference {
  try {
    const preference = window.localStorage.getItem(storageKey);
    return preference === 'light' || preference === 'dark' || preference === 'system' ? preference : 'dark';
  } catch {
    return 'dark';
  }
}

function resolvedTheme(preference: ThemePreference): 'light' | 'dark' {
  return preference === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : preference === 'system' ? 'light' : preference;
}

function applyTheme(preference: ThemePreference): void {
  const theme = resolvedTheme(preference);
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#020617' : '#f8fafc');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);

  useEffect(() => {
    applyTheme(preference);
    if (preference !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => applyTheme(preference);
    mediaQuery.addEventListener('change', updateTheme);
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, [preference]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    try { window.localStorage.setItem(storageKey, nextPreference); } catch { /* Theme still applies for this session. */ }
  }, []);
  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeApi {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used within a ThemeProvider');
  return theme;
}
