import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Star } from 'lucide-react';
import { api } from '../lib/api';
import { useToastError } from '../lib/useApiError';
import { useBizSession } from '../auth/business';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Textarea } from './ui/Form';

/** How long after opening the app Super Admin's review request pops up. */
const PROMPT_DELAY_MS = 6000;

interface ReviewRequest {
  id: string;
  message: string | null;
}

/** This app's name, as people know it. */
function useAppName() {
  const { t } = useTranslation();
  const product = useBizSession().business.product;
  return product === 'pos' ? t('review.pos_name') : t(`${product}.name`);
}

/** 1–5 stars, as a radio group (arrow keys work too). */
function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div>
      <div role="radiogroup" aria-label={t('review.stars_label')} className="flex justify-center gap-1.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t('review.star_n', { count: n })}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            className="rounded-lg p-1 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <Star className={clsx('size-10', n <= shown ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600')} />
          </button>
        ))}
      </div>
      <p className="mt-2 h-5 text-center text-sm font-medium text-slate-600 dark:text-slate-300">{shown ? t(`review.word_${shown}`) : t('review.pick_stars')}</p>
    </div>
  );
}

/** The review form, in a dialog: from Super Admin's request (requestId, with "Later") or written on one's own. */
function ReviewForm({ open, request, onLater, onDone }: { open: boolean; request: ReviewRequest | null; onLater: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const app = useAppName();
  const toastErr = useToastError();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const send = useMutation({
    mutationFn: () => api.post('/reviews', { rating, comment, ...(request ? { requestId: request.id } : {}) }),
    onSuccess: () => {
      toast.success(t('review.thanks'));
      setRating(0);
      setComment('');
      onDone();
    },
    onError: toastErr,
  });
  return (
    <Dialog
      open={open}
      onClose={onLater}
      size="sm"
      title={t('review.title', { app })}
      description={request?.message || t('review.subtitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onLater}>
            {request ? t('review.later') : t('common.cancel')}
          </Button>
          <Button disabled={!rating} loading={send.isPending} onClick={() => send.mutate()}>
            {t('review.send')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Stars value={rating} onChange={setRating} />
        <Textarea label={t('review.comment')} placeholder={t('review.comment_placeholder')} rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
    </Dialog>
  );
}

/**
 * Super Admin's review request: pops up a few seconds after the app opens. "Later" (or closing it) asks
 * again in a few days; sending a review ends it.
 */
export function ReviewPrompt() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['review-prompt'], queryFn: () => api.get<{ request: ReviewRequest | null }>('/reviews/prompt'), staleTime: 10 * 60_000 });
  const request = data?.request ?? null;
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!request) return;
    const id = setTimeout(() => setShow(true), PROMPT_DELAY_MS);
    return () => clearTimeout(id);
  }, [request]);
  const close = () => {
    setShow(false);
    qc.setQueryData(['review-prompt'], { request: null });
  };
  const later = useMutation({ mutationFn: (id: string) => api.post(`/reviews/prompt/${id}/later`) });
  if (!request) return null;
  return (
    <ReviewForm
      open={show}
      request={request}
      onLater={() => {
        later.mutate(request.id);
        close();
      }}
      onDone={close}
    />
  );
}

/** "Write a review" from the user menu: any time, without being asked. */
export function WriteReviewDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <ReviewForm open={open} request={null} onLater={onClose} onDone={onClose} />;
}
