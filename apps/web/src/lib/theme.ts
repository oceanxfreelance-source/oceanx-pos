export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'ox_theme';
let current: { theme: ThemeChoice; reduceAnimations: boolean } = { theme: readStoredTheme(), reduceAnimations: false };

/** Last theme used on this device, so the sign-in screen and public pages match before a session loads. */
export function readStoredTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

function render() {
  const root = document.documentElement;
  const dark = current.theme === 'dark' || (current.theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', !!dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  root.classList.toggle('reduce-motion', current.reduceAnimations);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#020617' : '#ffffff');
}

/** Apply theme + animation preferences to <html> and remember the theme on this device. */
export function applyPreferences(prefs: { theme?: string; reduceAnimations?: boolean }) {
  const theme: ThemeChoice = prefs.theme === 'light' || prefs.theme === 'dark' ? prefs.theme : 'system';
  current = { theme, reduceAnimations: !!prefs.reduceAnimations };
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
  render();
}

/** Follow the operating system live when the user chose "system". */
export function initTheme() {
  render();
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => current.theme === 'system' && render());
}
