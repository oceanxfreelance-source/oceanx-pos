/**
 * Turn a photo/scan of a signature or stamp (ink on light paper) into a transparent PNG:
 * light paper pixels become transparent, the ink is kept, and the image is cropped to the ink and scaled down.
 * Works the same for drawings made on the signature pad.
 */
export async function inkToPng(source: Blob | HTMLCanvasElement, maxSide = 900): Promise<Blob> {
  let img: CanvasImageSource;
  let w: number;
  let h: number;
  if (source instanceof HTMLCanvasElement) {
    img = source;
    w = source.width;
    h = source.height;
  } else {
    const bmp = await createImageBitmap(source);
    img = bmp;
    w = bmp.width;
    h = bmp.height;
  }
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, cw, ch);
  const data = g.getImageData(0, 0, cw, ch);
  const px = data.data;
  let minX = cw,
    minY = ch,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = (y * cw + x) * 4;
      const light = 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
      // Paper (light) → transparent; soft edge between 200 and 235 keeps strokes smooth.
      const alpha = px[i + 3]! * Math.max(0, Math.min(1, (235 - light) / 35));
      px[i + 3] = alpha;
      if (alpha > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  g.putImageData(data, 0, 0);
  if (maxX < 0) throw new Error('empty');
  const pad = 6;
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const out = document.createElement('canvas');
  out.width = Math.min(cw, maxX + pad) - x0 + 1;
  out.height = Math.min(ch, maxY + pad) - y0 + 1;
  out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
}
