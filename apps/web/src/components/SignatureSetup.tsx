import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eraser, ImageUp, PenLine, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { inkToPng } from '../lib/ink';
import { useToastError } from '../lib/useApiError';
import { Button } from './ui/Button';
import { Tabs } from './ui/Tabs';

/**
 * Add or change an ink image (my signature / company stamp): draw it with mouse or finger, or upload a
 * photo or scan. Paper is made transparent so it sits cleanly on documents.
 */
export function InkSetup({
  current,
  uploadPath,
  allowDraw,
  onChanged,
  previewClass,
}: {
  current: string | null;
  uploadPath: string;
  allowDraw: boolean;
  onChanged: () => void;
  previewClass: string;
}) {
  const { t } = useTranslation();
  const toastErr = useToastError();
  const [mode, setMode] = useState<'draw' | 'upload'>(allowDraw ? 'draw' : 'upload');
  const [version, setVersion] = useState(0);
  const save = useMutation({
    mutationFn: (blob: Blob) => api.upload(uploadPath, blob),
    onSuccess: () => {
      toast.success(t('common.saved'));
      setVersion((v) => v + 1);
      onChanged();
    },
    onError: toastErr,
  });
  const remove = useMutation({
    mutationFn: () => api.delete(uploadPath),
    onSuccess: () => {
      toast.success(t('common.saved'));
      onChanged();
    },
    onError: toastErr,
  });
  const fromFile = async (file?: File) => {
    if (!file) return;
    try {
      save.mutate(await inkToPng(file));
    } catch {
      toast.error(t('validation.invalid_image'));
    }
  };
  return (
    <div className="space-y-4">
      {current && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <img src={`${current}?v=${version}`} alt="" className={previewClass} />
          </div>
          <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => remove.mutate()} loading={remove.isPending} className="text-rose-600">
            {t('branding.remove')}
          </Button>
        </div>
      )}
      {allowDraw && (
        <Tabs
          tabs={[
            { value: 'draw', label: t('branding.draw') },
            { value: 'upload', label: t('branding.upload') },
          ]}
          value={mode}
          onChange={setMode}
        />
      )}
      {mode === 'draw' ? (
        <SignaturePad onSave={async (c) => save.mutate(await inkToPng(c))} saving={save.isPending} />
      ) : (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-600 hover:border-brand-500 dark:border-slate-700 dark:text-slate-300">
          <ImageUp className="size-6 text-brand-600" />
          <span className="font-medium">{current ? t('branding.replace_photo') : t('branding.choose_photo')}</span>
          <span className="text-xs text-slate-500">{t('branding.photo_hint')}</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => void fromFile(e.target.files?.[0])} />
        </label>
      )}
    </div>
  );
}

/** Draw a signature with mouse, pen or finger (dark ink on a white pad). */
function SignaturePad({ onSave, saving }: { onSave: (c: HTMLCanvasElement) => void; saving: boolean }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLCanvasElement>(null);
  const [empty, setEmpty] = useState(true);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const clear = () => {
    const c = ref.current!;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    setEmpty(true);
  };
  useEffect(clear, []);
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * e.currentTarget.width, y: ((e.clientY - r.top) / r.height) * e.currentTarget.height };
  };
  const line = (to: { x: number; y: number }) => {
    const g = ref.current!.getContext('2d')!;
    g.strokeStyle = '#0f2a5c';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    const from = last.current ?? to;
    g.moveTo(from.x, from.y);
    g.lineTo(to.x + 0.01, to.y);
    g.stroke();
    last.current = to;
    setEmpty(false);
  };
  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        width={900}
        height={300}
        aria-label={t('branding.pad_label')}
        className="aspect-[3/1] w-full max-w-xl touch-none rounded-xl bg-white ring-1 ring-slate-300"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          last.current = null;
          line(pos(e));
        }}
        onPointerMove={(e) => drawing.current && line(pos(e))}
        onPointerUp={() => {
          drawing.current = false;
          last.current = null;
        }}
      />
      <p className="text-xs text-slate-500">{t('branding.pad_hint')}</p>
      <div className="flex gap-2">
        <Button icon={<PenLine className="size-4" />} onClick={() => onSave(ref.current!)} disabled={empty} loading={saving}>
          {t('branding.save_signature')}
        </Button>
        <Button variant="secondary" icon={<Eraser className="size-4" />} onClick={clear} disabled={empty}>
          {t('branding.clear')}
        </Button>
      </div>
    </div>
  );
}
