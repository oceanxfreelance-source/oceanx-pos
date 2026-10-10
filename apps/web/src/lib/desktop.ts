/** Present only inside the OceanX POS Windows app (see /desktop). */
interface OceanxDesktop {
  isDesktop: true;
  version: string;
  print: () => Promise<{ ok: boolean; reason: string | null }>;
  openSettings: () => void;
}

export const desktop = (window as unknown as { oceanxDesktop?: OceanxDesktop }).oceanxDesktop ?? null;

/** Present only inside the OceanX POS Android tablet app (see /android). */
interface OceanxAndroid {
  print: (jobName: string) => void;
  saveFile: (base64: string, filename: string, mime: string) => void;
}
export const android = (window as unknown as { OceanXAndroid?: OceanxAndroid }).OceanXAndroid ?? null;

/** Leave a print page: close the tab, or go back inside the tablet app (it has no tabs). */
export function closePrintPage() {
  if (android) {
    if (window.history.length > 1) window.history.back();
    else window.location.assign('/');
    return;
  }
  window.close();
}

/**
 * Every printed document is A4, so printing always opens the normal print dialog (the page asks for A4),
 * also in the desktop app — its silent print goes to the narrow receipt printer chosen in its Settings.
 */
export function printPage() {
  if (android) android.print(document.title || 'OceanX');
  else window.print();
}
