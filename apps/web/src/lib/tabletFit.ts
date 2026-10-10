import { android } from './desktop';

/** Tablets show the system as a 1280-wide screen when sideways, scaled to fit: the POS fits without big tiles. */
const TABLET_WIDTH = 1280;
const DEFAULT_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover';

const installedApp = () => window.matchMedia?.('(display-mode: standalone)').matches;

/**
 * Inside the Android tablet app (or the installed app on a tablet), a sideways tablet narrower than 1280
 * points lays the page out at 1280 and scales it down to fit. Phones (short side under 600), PCs and
 * upright tablets keep the normal layout.
 */
export function installTabletFit() {
  if (!android && !installedApp()) return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) return;
  const apply = () => {
    const short = Math.min(window.screen.width, window.screen.height);
    const long = Math.max(window.screen.width, window.screen.height);
    const landscape = window.matchMedia?.('(orientation: landscape)').matches;
    const fit = short >= 600 && landscape && long < TABLET_WIDTH;
    // An explicit scale, so every tablet zooms out by the same amount right away.
    const scale = Math.round((long / TABLET_WIDTH) * 1000) / 1000;
    const content = fit
      ? `width=${TABLET_WIDTH}, initial-scale=${scale}, minimum-scale=${scale}, maximum-scale=${scale}, user-scalable=no, viewport-fit=cover`
      : DEFAULT_VIEWPORT;
    if (meta.content !== content) meta.content = content;
  };
  apply();
  window.matchMedia?.('(orientation: landscape)').addEventListener?.('change', apply);
  window.addEventListener('orientationchange', apply);
}
