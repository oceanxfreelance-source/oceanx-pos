/**
 * Prepare a photo for upload in the browser: decode any format the browser understands
 * (JPEG, PNG, WebP, and HEIC on Safari), scale it down and re-encode as JPEG. Keeps uploads
 * small and fast on café Wi-Fi; the server still verifies the bytes are a real image.
 */
export async function preparePhoto(file: File, maxSide = 1024, quality = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('invalid_image'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('invalid_image');
    ctx.fillStyle = '#fff'; // transparent PNGs get a white background in JPEG
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('invalid_image');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
