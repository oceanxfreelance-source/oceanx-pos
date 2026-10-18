import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageSquareHeart, Send, Star } from 'lucide-react';
import { PRODUCTS, type Product } from '@oceanx/shared';
import { qs, saApi } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { useToastError } from '../../lib/useApiError';
import { Badge, Card, CardHeader, EmptyState, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { Input, Select } from '../../components/ui/Form';
import { Pagination } from '../../components/ui/Table';

interface ReviewRequest {
  id: string;
  product: Product | null;
  message: string | null;
  createdAt: string;
  closedAt: string | null;
  answered: number;
  later: number;
}
interface Review {
  id: string;
  product: Product;
  businessName: string;
  userName: string;
  rating: number;
  comment: string | null;
  asked: boolean;
  createdAt: string;
}
interface ReviewList {
  items: Review[];
  total: number;
  summary: { count: number; average: number | null; byRating: Record<string, number> };
}

const PAGE = 50;

/** The apps' names as people know them. */
function useAppName() {
  const { t } = useTranslation();
  return (p: Product | null) => (p === null ? t('superadmin.reviews.all_apps') : p === 'pos' ? t('review.pos_name') : t(`${p}.name`));
}

function StarsText({ rating }: { rating: number }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={t('review.star_n', { count: rating })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className={n <= rating ? 'size-4 fill-amber-400 text-amber-400' : 'size-4 text-slate-300 dark:text-slate-600'} />
      ))}
    </span>
  );
}

/** Ask an app's users for a review (a popup in the app), see who answered, and read every review. */
export default function ReviewsPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const appName = useAppName();
  const [askProduct, setAskProduct] = useState<Product | ''>('');
  const [message, setMessage] = useState('');
  const [stopping, setStopping] = useState<ReviewRequest | null>(null);
  const [product, setProduct] = useState<Product | ''>('');
  const [rating, setRating] = useState('');
  const [page, setPage] = useState(1);

  const requests = useQuery({ queryKey: ['sa', 'review-requests'], queryFn: () => saApi.get<{ items: ReviewRequest[] }>('/review-requests') });
  const list = useQuery({
    queryKey: ['sa', 'reviews', product, rating, page],
    queryFn: () => saApi.get<ReviewList>(`/reviews${qs({ product: product || undefined, rating: rating || undefined, page, pageSize: PAGE })}`),
    placeholderData: keepPreviousData,
  });
  const ask = useMutation({
    mutationFn: () => saApi.post('/review-requests', { product: askProduct || null, message }),
    onSuccess: () => {
      toast.success(t('superadmin.reviews.sent'));
      setMessage('');
      void qc.invalidateQueries({ queryKey: ['sa', 'review-requests'] });
    },
    onError: toastErr,
  });
  const stop = useMutation({
    mutationFn: (id: string) => saApi.post(`/review-requests/${id}/stop`),
    onSuccess: () => {
      setStopping(null);
      void qc.invalidateQueries({ queryKey: ['sa', 'review-requests'] });
    },
    onError: toastErr,
  });
  const summary = list.data?.summary;

  return (
    <div>
      <PageHeader title={t('superadmin.reviews.title')} description={t('superadmin.reviews.subtitle')} />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('superadmin.reviews.ask_title')} description={t('superadmin.reviews.ask_hint')} />
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask.mutate();
            }}
          >
            <Select label={t('superadmin.reviews.app')} value={askProduct} onChange={(e) => setAskProduct(e.target.value as Product | '')}>
              <option value="">{appName(null)}</option>
              {PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {appName(p)}
                </option>
              ))}
            </Select>
            <Input label={t('superadmin.reviews.message')} hint={t('superadmin.reviews.message_hint')} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} dir="auto" />
            <Button type="submit" icon={<Send className="size-4" />} loading={ask.isPending}>
              {t('superadmin.reviews.send')}
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title={t('superadmin.reviews.requests')} />
          {!requests.data ? (
            <SkeletonRows rows={3} />
          ) : requests.data.items.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{t('superadmin.reviews.no_requests')}</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {requests.data.items.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {appName(r.product)}
                      {r.closedAt ? <Badge tone="gray">{t('superadmin.reviews.stopped')}</Badge> : <Badge tone="green" dot>{t('superadmin.reviews.asking')}</Badge>}
                    </p>
                    {r.message && (
                      <p className="truncate text-xs text-slate-500" dir="auto">
                        {r.message}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">
                      {f.dateTime(r.createdAt)} · {t('superadmin.reviews.answered', { count: r.answered })} · {t('superadmin.reviews.later', { count: r.later })}
                    </p>
                  </div>
                  {!r.closedAt && (
                    <Button size="sm" variant="secondary" onClick={() => setStopping(r)}>
                      {t('superadmin.reviews.stop')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="me-auto">
            <p className="text-sm text-slate-500">{t('superadmin.reviews.average')}</p>
            <p className="flex items-center gap-2 text-2xl font-semibold">
              {summary?.average != null ? summary.average.toFixed(1) : '—'}
              {summary?.average != null && <StarsText rating={Math.round(summary.average)} />}
              <span className="text-sm font-normal text-slate-500">{t('superadmin.reviews.count', { count: summary?.count ?? 0 })}</span>
            </p>
          </div>
          <div className="w-40">
            <Select
              label={t('superadmin.reviews.app')}
              value={product}
              onChange={(e) => {
                setProduct(e.target.value as Product | '');
                setPage(1);
              }}
            >
              <option value="">{appName(null)}</option>
              {PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {appName(p)}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-36">
            <Select
              label={t('superadmin.reviews.rating')}
              value={rating}
              onChange={(e) => {
                setRating(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('superadmin.reviews.all_ratings')}</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {t('review.star_n', { count: n })} ({summary?.byRating[n] ?? 0})
                </option>
              ))}
            </Select>
          </div>
        </div>
        {!list.data ? (
          <SkeletonRows rows={5} />
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={<MessageSquareHeart className="size-6" />} title={t('superadmin.reviews.none')} />
        ) : (
          <>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.data.items.map((r) => (
                <li key={r.id} className="space-y-1 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarsText rating={r.rating} />
                    <Badge tone="blue">{appName(r.product)}</Badge>
                    <span className="text-xs text-slate-500">{r.asked ? t('superadmin.reviews.from_request') : t('superadmin.reviews.own')}</span>
                    <span className="ms-auto text-xs text-slate-500">{f.dateTime(r.createdAt)}</span>
                  </div>
                  {r.comment && (
                    <p className="text-sm whitespace-pre-line text-slate-800 dark:text-slate-200" dir="auto">
                      {r.comment}
                    </p>
                  )}
                  <p className="text-xs text-slate-500" dir="auto">
                    {r.userName} · {r.businessName}
                  </p>
                </li>
              ))}
            </ul>
            <div className="p-4">
              <Pagination page={page} pageSize={PAGE} total={list.data.total} onPage={setPage} />
            </div>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!stopping}
        onClose={() => setStopping(null)}
        title={t('superadmin.reviews.stop')}
        message={t('superadmin.reviews.stop_confirm')}
        confirmLabel={t('superadmin.reviews.stop')}
        loading={stop.isPending}
        onConfirm={() => stopping && stop.mutate(stopping.id)}
      />
    </div>
  );
}
