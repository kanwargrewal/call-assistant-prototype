'use client';

import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';
import { settingsAPI } from '@/lib/api';

type Theme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: Theme;
  actualTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  isClient: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');
  const [isClient, setIsClient] = useState(false);

  // Check system preference
  const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  // Resolve the actual theme to apply
  const resolveTheme = (themeValue: Theme): 'light' | 'dark' => {
    if (themeValue === 'auto') {
      return getSystemTheme();
    }
    return themeValue;
  };

  // Apply theme to document
  const applyTheme = (resolvedTheme: 'light' | 'dark') => {
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      const body = window.document.body;
      
      // Remove all theme classes
      root.classList.remove('light', 'dark');
      body.classList.remove('light', 'dark');
      
      // Add new theme class to both html and body
      root.classList.add(resolvedTheme);
      body.classList.add(resolvedTheme);
      
      // Add data attribute for additional targeting
      root.setAttribute('data-theme', resolvedTheme);
      body.setAttribute('data-theme', resolvedTheme);
      
      console.log('Applied theme:', resolvedTheme);
      console.log('HTML classes:', root.className);
      console.log('Body classes:', body.className);
      
      // Force a style recalculation
      window.getComputedStyle(body).color;
    }
  };

  // Set theme and save to settings
  const setTheme = async (newTheme: Theme) => {
    console.log('Setting theme to:', newTheme);
    
    const resolved = resolveTheme(newTheme);
    setThemeState(newTheme);
    setActualTheme(resolved);
    applyTheme(resolved);

    // Save to localStorage for immediate access
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
    }

    // Save to settings (non-blocking)
    settingsAPI.update({ theme: newTheme })
      .then(() => console.log('Theme saved to settings'))
      .catch(error => console.error('Failed to save theme preference:', error));
  };

  // Set client flag after hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize theme immediately after hydration to avoid flash
  useLayoutEffect(() => {
    if (!isClient) return;

    const initializeTheme = async () => {
      try {
        // First check localStorage
        const localTheme = localStorage.getItem('theme') as Theme | null;
        
        if (localTheme) {
          console.log('Found theme in localStorage:', localTheme);
          const resolved = resolveTheme(localTheme);
          setThemeState(localTheme);
          setActualTheme(resolved);
          applyTheme(resolved);
        } else {
          // No localStorage, use system preference
          const systemTheme = getSystemTheme();
          setThemeState('auto');
          setActualTheme(systemTheme);
          applyTheme(systemTheme);
          localStorage.setItem('theme', 'auto');
        }
        
        // Then try to sync with settings (non-blocking)
        try {
          const settings = await settingsAPI.getMy();
          const savedTheme = settings.theme;
          console.log('Loaded theme from settings:', savedTheme);
          
          if (savedTheme !== localTheme) {
            const resolved = resolveTheme(savedTheme);
            setThemeState(savedTheme);
            setActualTheme(resolved);
            applyTheme(resolved);
            localStorage.setItem('theme', savedTheme);
          }
        } catch {
          // Settings not available, that's fine
          console.log('Settings not available, using localStorage/system default');
        }
      } catch (error) {
        console.error('Error initializing theme:', error);
        // Fallback to system theme
        const systemTheme = getSystemTheme();
        setThemeState('auto');
        setActualTheme(systemTheme);
        applyTheme(systemTheme);
      }
    };

    initializeTheme();
  }, [isClient]);

  // Listen for system theme changes in auto mode
  useEffect(() => {
    if (!isClient || theme !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      console.log('System theme changed');
      const systemTheme = getSystemTheme();
      setActualTheme(systemTheme);
      applyTheme(systemTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, isClient]);

  const isDark = actualTheme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, actualTheme, setTheme, isDark, isClient }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 