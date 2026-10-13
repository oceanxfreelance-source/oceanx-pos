import { android, posTablet } from './desktop';
import { HOST_PRODUCT } from './product';

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
  if (!posTablet && !installedApp()) return;
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

/**
 * Gravity and Gravity Flow phone apps: the screens are made for the phone, so pinch-zoom is off (no accidental
 * zooming or sideways scrolling). Only an A4 document (/print/...) can be zoomed, to read it in detail.
 */
export function installPhoneAppZoomLock(router: { state: { location: { pathname: string } }; subscribe: (fn: (s: { location: { pathname: string } }) => void) => unknown }) {
  if (!android || HOST_PRODUCT === 'pos') return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) return;
  const apply = (pathname: string) => {
    const content = pathname.startsWith('/print/') ? DEFAULT_VIEWPORT : 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
    if (meta.content !== content) meta.content = content;
  };
  apply(router.state.location.pathname);
  router.subscribe((s) => apply(s.location.pathname));
}
