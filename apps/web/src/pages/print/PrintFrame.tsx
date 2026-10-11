import { closePrintPage, printPage } from '../../lib/desktop';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download, Printer, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { downloadPdf } from '../../lib/pdf';

/**
 * Shared print/PDF chrome: Close, Print and "Download PDF". Documents always render on white
 * (light mode is forced while open). `?download=1` starts the PDF download as soon as it is ready.
 */
export function PrintFrame({ ready, filename, landscape, width = '210mm', children }: { ready: boolean; filename: string; landscape?: boolean; width?: string; children: ReactNode }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [params] = useSearchParams();
  const auto = useRef(params.get('download') === '1');

  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    root.classList.remove('dark');
    return () => {
      if (wasDark) root.classList.add('dark');
    };
  }, []);

  // A phone shows the whole A4 page made smaller (like a PDF), never a squeezed page with things cut off.
  const fit = useFitWidth(width);

  const download = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      // The PDF is taken from the page at its real size.
      await new Promise((r) => setTimeout(r, 60));
      await document.fonts?.ready;
      await downloadPdf(ref.current, filename, { landscape });
    } catch {
      toast.error(t('print.pdf_failed'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (ready && auto.current) {
      auto.current = false;
      // Give images (logo, photos) a moment to finish decoding.
      const id = setTimeout(() => void download(), 400);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <div className="min-h-screen bg-slate-100 py-6 text-slate-900 print:bg-white print:py-0">
      {/* Every printed document is A4; wide sheets (rota, salary sheet, wide reports) turn it sideways. */}
      {landscape && <style>{'@page { size: A4 landscape; }'}</style>}
      <div className="mx-auto mb-4 flex flex-wrap justify-end gap-2 px-4 print:hidden" style={{ maxWidth: width }}>
        <Button variant="ghost" icon={<X className="size-4" />} onClick={closePrintPage}>
          {t('common.close')}
        </Button>
        <Button variant="secondary" icon={<Printer className="size-4" />} onClick={printPage} disabled={!ready}>
          {t('print.print')}
        </Button>
        <Button icon={<Download className="size-4" />} onClick={() => void download()} loading={busy} disabled={!ready}>
          {t('print.download_pdf')}
        </Button>
      </div>
      <div className="print-fit mx-auto shadow-sm print:shadow-none" style={{ width, zoom: fit < 1 && !busy ? fit : undefined }}>
        <div ref={ref} className="bg-white">
          {children}
        </div>
      </div>
    </div>
  );
}

/** How much to shrink a sheet `width` wide (e.g. "210mm") so it fits the screen; 1 when it already fits. */
function useFitWidth(width: string) {
  const px = width.endsWith('mm') ? (parseFloat(width) * 96) / 25.4 : parseFloat(width);
  const measure = () => (px > 0 ? Math.min(1, (window.innerWidth - 16) / px) : 1);
  const [fit, setFit] = useState(measure);
  useEffect(() => {
    const onResize = () => setFit(measure());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [px]);
  return fit;
}
