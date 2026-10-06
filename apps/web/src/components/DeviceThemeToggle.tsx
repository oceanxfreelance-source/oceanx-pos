import { useState } from 'react';
import { applyPreferences, readStoredTheme, type ThemeChoice } from '../lib/theme';
import { ThemeToggle } from './ThemeToggle';

/** Theme switch for screens without a business profile to save to (sign-in pages, Super Admin console). */
export function DeviceThemeToggle() {
  const [value, setValue] = useState<ThemeChoice>(readStoredTheme());
  return (
    <ThemeToggle
      value={value}
      onChange={(t) => {
        setValue(t);
        applyPreferences({ theme: t });
      }}
    />
  );
}
