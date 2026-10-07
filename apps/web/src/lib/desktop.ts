/** Present only inside the OceanX POS Windows app (see /desktop). */
interface OceanxDesktop {
  isDesktop: true;
  version: string;
  print: () => Promise<{ ok: boolean; reason: string | null }>;
  openSettings: () => void;
}

export const desktop = (window as unknown as { oceanxDesktop?: OceanxDesktop }).oceanxDesktop ?? null;

/** In the desktop app: straight to the receipt printer chosen in its Settings. In a browser: the print dialog. */
export function printPage() {
  if (desktop) void desktop.print();
  else window.print();
}
