/** Apply theme + animation preferences to <html>. */
export function applyPreferences(prefs: { theme?: string; reduceAnimations?: boolean }) {
  const root = document.documentElement;
  const dark = prefs.theme === 'dark' || (prefs.theme !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', !!dark);
  root.classList.toggle('reduce-motion', !!prefs.reduceAnimations);
}
