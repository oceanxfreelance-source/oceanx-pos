import QRCode from 'qrcode';

/** Public menu link. The QR only holds this address, so menu changes never need a new QR code. */
export const menuUrl = (slug: string, table?: string) => `${window.location.origin}/menu/${slug}${table ? `?table=${encodeURIComponent(table)}` : ''}`;

/** High-resolution PNG (data URL) — generated in the browser, no outside service. */
export const qrPng = (text: string, width = 1024) => QRCode.toDataURL(text, { margin: 1, width, errorCorrectionLevel: 'M' });
