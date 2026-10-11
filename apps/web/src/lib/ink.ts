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

/**
 * A round company stamp drawn from the business name, for businesses that have no stamp image to upload:
 * the name runs around the top of a double ring, with the initials in the middle. Returns a transparent PNG.
 */
export async function makeStamp(name: string, subtitle = ''): Promise<Blob> {
  const S = 600;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;
  const ink = '#1e3a8a';
  const mid = S / 2;
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineWidth = 14;
  g.beginPath();
  g.arc(mid, mid, mid - 12, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 5;
  g.beginPath();
  g.arc(mid, mid, mid - 105, 0, Math.PI * 2);
  g.stroke();

  // Text along an arc, one character at a time, centred on `centre` (radians; -π/2 is the top).
  const font = '700 50px Inter, "Segoe UI", Arial, sans-serif';
  const arcText = (text: string, radius: number, centre: number, inward: boolean) => {
    g.font = font;
    const chars = [...text];
    const widths = chars.map((ch) => g.measureText(ch).width + 4);
    const total = widths.reduce((a, b) => a + b, 0);
    const maxArc = Math.PI * 1.15;
    const scale = Math.min(1, (maxArc * radius) / total);
    if (scale < 1) g.font = `700 ${Math.floor(50 * scale)}px Inter, "Segoe UI", Arial, sans-serif`;
    let angle = centre - ((inward ? -1 : 1) * (total * scale)) / radius / 2;
    chars.forEach((ch, i) => {
      const w = widths[i]! * scale;
      const a = angle + ((inward ? -1 : 1) * w) / radius / 2;
      g.save();
      g.translate(mid + radius * Math.cos(a), mid + radius * Math.sin(a));
      g.rotate(a + (inward ? -Math.PI / 2 : Math.PI / 2));
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(ch, 0, 0);
      g.restore();
      angle += ((inward ? -1 : 1) * w) / radius;
    });
  };
  const clean = name.trim().toUpperCase();
  arcText(clean, mid - 58, -Math.PI / 2, false);
  arcText(subtitle ? `★ ${subtitle.trim().toUpperCase()} ★` : '★ ★ ★', mid - 58, Math.PI / 2, true);

  const initials = clean
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w))
    .slice(0, 3)
    .map((w) => [...w][0])
    .join('');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 ${initials.length > 2 ? 110 : 140}px Inter, "Segoe UI", Arial, sans-serif`;
  g.fillText(initials || '★', mid, mid + 6);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('stamp'))), 'image/png'));
}

export type StampInk = 'blue' | 'red';
const INK_RGB: Record<StampInk, [number, number, number]> = { blue: [29, 63, 158], red: [200, 16, 46] };

/** Small fixed-seed random numbers, so the same logo always gets the same ink texture. */
function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/**
 * Turn a logo (any colours, transparent background, as made by inkToPng) into a rubber-stamp impression in
 * one ink colour: darker parts take more ink, light parts stay clear, and the ink is uneven like a real
 * stamp (grain, a few worn patches, slightly soft edges). Returns a transparent PNG of the same size.
 */
export async function inkStamp(png: Blob, ink: StampInk): Promise<Blob> {
  const bmp = await createImageBitmap(png);
  const w = bmp.width;
  const h = bmp.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(bmp, 0, 0);
  const data = g.getImageData(0, 0, w, h);
  const px = data.data;
  const [r, gr, b] = INK_RGB[ink];
  const rand = seeded(w * 7919 + h * 104729);
  // Mottled ink: a coarse random grid, smoothly blended (rubber never inks evenly).
  const cell = Math.max(4, Math.round(Math.max(w, h) / 90));
  const gw = Math.ceil(w / cell) + 2;
  const gh = Math.ceil(h / cell) + 2;
  const grid = Array.from({ length: gw * gh }, () => rand());
  const mottle = (x: number, y: number) => {
    const gx = x / cell;
    const gy = y / cell;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const at = (i: number, j: number) => grid[j * gw + i]!;
    const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
    const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
  // A few small worn spots where the stamp pressed lightly.
  const patches = Array.from({ length: 12 }, () => ({ x: rand() * w, y: rand() * h, r: (0.03 + rand() * 0.06) * Math.max(w, h), k: 0.5 + rand() * 0.3 }));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = px[i + 3]! / 255;
      if (a === 0) continue;
      const light = (0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!) / 255;
      // How much ink this spot takes: dark → full, light → clear (white parts of the logo stay paper).
      const dark = 1 - light;
      let amount = (dark <= 0.12 ? 0 : dark >= 0.45 ? 1 : (dark - 0.12) / 0.33) * a;
      if (amount === 0) {
        px[i + 3] = 0;
        continue;
      }
      for (const p of patches) {
        const d = Math.hypot(x - p.x, y - p.y) / p.r;
        if (d < 1) amount *= 1 - (1 - d) * (1 - p.k);
      }
      amount *= 0.72 + 0.28 * mottle(x, y);
      // Fine grain, and a few specks the ink missed.
      const n = rand();
      amount *= n < 0.035 ? 0.1 : 0.86 + n * 0.14;
      px[i] = r;
      px[i + 1] = gr;
      px[i + 2] = b;
      px[i + 3] = Math.round(Math.min(1, amount) * 245);
    }
  }
  g.putImageData(data, 0, 0);
  // Slightly soft edges, as ink spreads a little into paper.
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const og = out.getContext('2d')!;
  og.filter = 'blur(0.6px)';
  og.drawImage(c, 0, 0);
  og.filter = 'none';
  og.globalAlpha = 0.55;
  og.drawImage(c, 0, 0);
  return new Promise((resolve, reject) => out.toBlob((bl) => (bl ? resolve(bl) : reject(new Error('png'))), 'image/png'));
}
