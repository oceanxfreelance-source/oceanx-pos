/** Present only inside the OceanX POS Windows app (see /desktop). */
interface OceanxDesktop {
  isDesktop: true;
  version: string;
  print: () => Promise<{ ok: boolean; reason: string | null }>;
  openSettings: () => void;
}

export const desktop = (window as unknown as { oceanxDesktop?: OceanxDesktop }).oceanxDesktop ?? null;

/**
 * Every printed document is A4, so printing always opens the normal print dialog (the page asks for A4),
 * also in the desktop app — its silent print goes to the narrow receipt printer chosen in its Settings.
 */
export function printPage() {
  window.print();
}
