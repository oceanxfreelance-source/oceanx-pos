/**
 * Download a rendered page section as a real PDF file (A4). The browser renders the text with the
 * same fonts as the screen, so every language — including Thaana/RTL, Devanagari, Bengali and
 * Sinhala — prints correctly. Pages break between table rows / marked blocks, never through a line.
 * The PDF libraries are loaded only when a download is requested.
 */
export async function downloadPdf(el: HTMLElement, filename: string, opts: { landscape?: boolean } = {}) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
  const scale = 2;
  const canvas = await html2canvas(el, { scale, backgroundColor: '#ffffff', useCORS: true, logging: false });
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: opts.landscape ? 'landscape' : 'portrait', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 28;
  const ptPerPx = (pageW - margin * 2) / canvas.width;
  const sliceMax = Math.floor((pageH - margin * 2 - 14) / ptPerPx); // leave room for the page number

  // Safe break points (canvas px): bottoms of table rows and blocks marked data-pdf-block.
  const top = el.getBoundingClientRect().top;
  const breaks = [...el.querySelectorAll('tr, [data-pdf-block]')]
    .map((n) => Math.round((n.getBoundingClientRect().bottom - top) * scale))
    .filter((b) => b > 0)
    .sort((a, b) => a - b);

  const slices: [number, number][] = [];
  let y = 0;
  while (y < canvas.height) {
    let end = Math.min(y + sliceMax, canvas.height);
    if (end < canvas.height) {
      const candidates = breaks.filter((b) => b > y + sliceMax * 0.4 && b <= end);
      if (candidates.length) end = candidates[candidates.length - 1]!;
    }
    slices.push([y, end]);
    y = end;
  }

  slices.forEach(([from, to], i) => {
    const part = document.createElement('canvas');
    part.width = canvas.width;
    part.height = to - from;
    const ctx = part.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, part.width, part.height);
    ctx.drawImage(canvas, 0, from, canvas.width, to - from, 0, 0, canvas.width, to - from);
    if (i > 0) pdf.addPage();
    pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, pageW - margin * 2, (to - from) * ptPerPx);
    pdf.setFontSize(8);
    pdf.setTextColor(140);
    pdf.text(`${i + 1} / ${slices.length}`, pageW - margin, pageH - margin / 2, { align: 'right' });
  });
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/** Safe file name from user text (business/customer names may contain any script). */
export const pdfName = (...parts: (string | null | undefined)[]) =>
  parts
    .filter(Boolean)
    .join('_')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .slice(0, 120);
