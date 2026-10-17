import { HOST_PRODUCT } from './product';

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
  /** OceanX Admin app only: background checks for payments waiting, with a notification (key from /alerts/keys). */
  enableAlerts?: (key: string) => void;
  disableAlerts?: () => void;
  alertsOn?: () => boolean;
  /** POS app 1.0.5+: the signed-in business is a takeaway shop; on a phone the app becomes a normal upright phone app. */
  phoneTill?: (takeaway: boolean) => void;
}
export const android = (window as unknown as { OceanXAndroid?: OceanxAndroid }).OceanXAndroid ?? null;
/**
 * The POS tablet app (POS only, sideways, 1280 layout). The Gravity phone app uses the same bridge for
 * printing and saving PDFs, but on Gravity's or Gravity Flow's address it is a normal phone app.
 */
export const posTablet = !!android && HOST_PRODUCT === 'pos';

/** The POS app on a phone (short side under 600 points), not a tablet. */
export const posPhone = posTablet && Math.min(window.screen.width, window.screen.height) < 600;

/**
 * The POS-only tablet app, for this business. A takeaway shop on a phone uses the app as a phone app with
 * the whole system (POS, customers, invoices…); cafés, restaurants and shops keep the POS-only tablet app.
 */
export function posTabletFor(businessType: string | undefined) {
  return posTablet && !(posPhone && businessType === 'takeaway');
}

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
