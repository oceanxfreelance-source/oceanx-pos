import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, Send } from 'lucide-react';
import clsx from 'clsx';
import { MAIL_MAX_RECIPIENTS, MAIL_SEGMENTS } from '@oceanx/shared';
import { saApi } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { useToastError } from '../../lib/useApiError';
import { Alert, Badge, Card, CardHeader, EmptyState, Ltr, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Checkbox, Input, Select, Textarea } from '../../components/ui/Form';
import { ConfirmDialog } from '../../components/ui/Dialog';

type Product = 'pos' | 'gravity' | 'flow' | 'budget' | 'all';
type Segment = (typeof MAIL_SEGMENTS)[number];
interface Recipient {
  businessId: string;
  business: string;
  product: string;
  name: string;
  email: string;
  periodEnd: string | null;
}
interface Preview {
  count: number;
  max: number;
  recipients: Recipient[];
  sample: { to: string; subject: string; text: string } | null;
}
interface SentMail {
  id: string;
  subject: string;
  body: string;
  recipients: { email: string; business: string; ok: boolean }[];
  sentCount: number;
  failedCount: number;
  sentByName: string;
  createdAt: string;
}

/** Ready-made messages (emails go out in English); every one can be edited before sending. */
const TEMPLATES: Record<string, { subject: string; body: string; segment?: Segment }> = {
  trial_ending: {
    segment: 'trial_ending',
    subject: 'Your free trial ends in {{time_left}}',
    body: 'Hello {{name}},\n\nYour free trial for {{business}} ends on {{ends}} ({{time_left}} left).\n\nTo keep using it without a break, pay {{price}} a month by bank transfer and upload the slip in the app:\n{{link}}\n\nThank you,\nOceanX team',
  },
  trial_ended: {
    segment: 'expired',
    subject: 'Your free trial has ended',
    body: 'Hello {{name}},\n\nThe free trial for {{business}} ended on {{ends}}. Your data is safe.\n\nPay {{price}} a month by bank transfer and upload the slip in the app to continue:\n{{link}}\n\nThank you,\nOceanX team',
  },
  renewal: {
    segment: 'active',
    subject: 'Your plan renews on {{ends}}',
    body: 'Hello {{name}},\n\nThe plan for {{business}} runs until {{ends}}. To renew, pay {{price}} a month by bank transfer and upload the slip in the app:\n{{link}}\n\nThank you,\nOceanX team',
  },
  custom: { subject: '', body: 'Hello {{name}},\n\n\n\nThank you,\nOceanX team' },
};
const PLACEHOLDERS = ['name', 'business', 'ends', 'time_left', 'price', 'link'] as const;

/** Wait until typing stops before asking who would get the email. */
function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Email business owners from the office: trial reminders, notices, or a message of your own. */
export default function MailPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const toastError = useToastError();
  const [product, setProduct] = useState<Product>('gravity');
  const [segment, setSegment] = useState<Segment>('trial_ending');
  const [hours, setHours] = useState('24');
  const [chosen, setChosen] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [template, setTemplate] = useState('trial_ending');
  const [subject, setSubject] = useState(TEMPLATES.trial_ending!.subject);
  const [body, setBody] = useState(TEMPLATES.trial_ending!.body);
  const [confirm, setConfirm] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const audience = { product, segment, hours: Math.min(720, Math.max(1, Number(hours) || 24)), businessIds: chosen };
  const message = { audience, subject: subject.trim() || '—', body: body.trim() || '—' };
  const debounced = useDebounced(JSON.stringify(message), 400);
  const preview = useQuery({ queryKey: ['sa', 'mail', 'preview', debounced], queryFn: () => saApi.post<Preview>('/mail/preview', JSON.parse(debounced)) });
  // "Choose accounts": everyone of the product to tick from.
  const all = useQuery({
    queryKey: ['sa', 'mail', 'accounts', product],
    queryFn: () => saApi.post<Preview>('/mail/preview', { audience: { product, segment: 'all' }, subject: '—', body: '—' }),
    enabled: segment === 'selected',
  });
  const history = useQuery({ queryKey: ['sa', 'mail', 'history'], queryFn: () => saApi.get<{ items: SentMail[] }>('/mail') });

  const send = useMutation({
    mutationFn: () => saApi.post<{ sent: number; failed: number }>('/mail/send', message),
    onSuccess: (r) => {
      setConfirm(false);
      toast.success(t('superadmin.mail.sent_toast', { count: r.sent }));
      if (r.failed) toast.error(t('superadmin.mail.failed_toast', { count: r.failed }));
      void qc.invalidateQueries({ queryKey: ['sa', 'mail', 'history'] });
    },
    onError: (e) => {
      setConfirm(false);
      toastError(e);
    },
  });

  const pickTemplate = (key: string) => {
    const tpl = TEMPLATES[key]!;
    setTemplate(key);
    setSubject(tpl.subject);
    setBody(tpl.body);
    if (tpl.segment) setSegment(tpl.segment);
  };
  const accounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (all.data?.recipients ?? []).filter((r) => !q || `${r.business} ${r.name} ${r.email}`.toLowerCase().includes(q));
  }, [all.data, search]);
  const count = preview.data?.count ?? 0;
  const tooMany = count > MAIL_MAX_RECIPIENTS;
  const ready = !!subject.trim() && !!body.trim() && count > 0 && !tooMany;

  return (
    <div className="space-y-6">
      <PageHeader title={t('superadmin.mail.title')} description={t('superadmin.mail.subtitle')} />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <div className="space-y-5">
            {/* Who */}
            <div>
              <p className="mb-2 text-sm font-medium">{t('superadmin.mail.send_to')}</p>
              <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
                {(['pos', 'gravity', 'flow', 'budget', 'all'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={product === p}
                    onClick={() => {
                      setProduct(p);
                      setChosen([]);
                    }}
                    className={clsx('rounded-lg px-4 py-1.5 text-sm font-medium transition', product === p ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white')}
                  >
                    {t(`superadmin.mail.product_${p}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <Select label={t('superadmin.mail.who')} value={segment} onChange={(e) => setSegment(e.target.value as Segment)}>
                {MAIL_SEGMENTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`superadmin.mail.seg_${s}`)}
                  </option>
                ))}
              </Select>
              {segment === 'trial_ending' && <Input label={t('superadmin.mail.within_hours')} type="number" min={1} max={720} value={hours} onChange={(e) => setHours(e.target.value)} />}
            </div>
            {segment === 'selected' && (
              <div className="rounded-xl ring-1 ring-slate-200 dark:ring-slate-800">
                <div className="border-b border-slate-200 p-3 dark:border-slate-800">
                  <Input aria-label={t('superadmin.mail.search')} placeholder={t('superadmin.mail.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto p-3">
                  {all.isLoading ? (
                    <SkeletonRows rows={3} />
                  ) : accounts.length === 0 ? (
                    <p className="text-sm text-slate-500">{t('superadmin.mail.nobody')}</p>
                  ) : (
                    accounts.map((r) => (
                      <Checkbox
                        key={r.businessId}
                        checked={chosen.includes(r.businessId)}
                        onChange={(v) => setChosen((c) => (v ? [...c, r.businessId] : c.filter((x) => x !== r.businessId)))}
                        label={
                          <span dir="auto">
                            {r.business} <span className="text-slate-500">· {r.email}</span>
                          </span>
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* What */}
            <Select label={t('superadmin.mail.template')} value={template} onChange={(e) => pickTemplate(e.target.value)}>
              {Object.keys(TEMPLATES).map((k) => (
                <option key={k} value={k}>
                  {t(`superadmin.mail.tpl_${k}`)}
                </option>
              ))}
            </Select>
            <Input label={t('superadmin.mail.subject')} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} required />
            <div>
              <Textarea label={t('superadmin.mail.body')} rows={11} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} required />
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span>{t('superadmin.mail.placeholders_hint')}</span>
                {PLACEHOLDERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setBody((b) => `${b}{{${p}}}`)}
                    title={t(`superadmin.mail.ph_${p}`)}
                    className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 hover:bg-brand-100 hover:text-brand-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-brand-900"
                    dir="ltr"
                  >
                    {`{{${p}}}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <p className="text-sm text-slate-500">{preview.data ? t('superadmin.mail.recipients', { count }) : ''}</p>
              <Button icon={<Send className="size-4" />} disabled={!ready} onClick={() => setConfirm(true)}>
                {t('superadmin.mail.send')}
              </Button>
            </div>
          </div>
        </Card>

        {/* Who gets it, and how it reads */}
        <div className="space-y-6">
          <Card>
            <CardHeader title={t('superadmin.mail.preview')} description={preview.data?.sample ? t('superadmin.mail.preview_for', { email: preview.data.sample.to }) : undefined} />
            {!preview.data ? (
              <SkeletonRows rows={4} />
            ) : !preview.data.sample ? (
              <p className="text-sm text-slate-500">{t('superadmin.mail.nobody')}</p>
            ) : (
              <div className="rounded-xl bg-white p-4 text-slate-900 shadow-inner ring-1 ring-slate-200 dark:bg-slate-950/40 dark:text-slate-100 dark:ring-slate-800">
                <p className="text-xs text-slate-500" dir="ltr">
                  {t('superadmin.mail.to')}: {preview.data.sample.to}
                </p>
                <p className="mt-1 font-semibold" dir="auto">
                  {preview.data.sample.subject}
                </p>
                <pre className="mt-3 font-sans text-sm whitespace-pre-wrap" dir="auto">
                  {preview.data.sample.text}
                </pre>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title={t('superadmin.mail.recipients', { count })} />
            {tooMany && <Alert tone="amber">{t('superadmin.mail.too_many', { max: MAIL_MAX_RECIPIENTS })}</Alert>}
            {preview.data && preview.data.recipients.length > 0 && (
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto text-sm dark:divide-slate-800">
                {preview.data.recipients.map((r) => (
                  <li key={r.businessId} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium" dir="auto">
                        {r.business}
                      </span>
                      <span className="block truncate text-xs text-slate-500" dir="ltr">
                        {r.email}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {r.periodEnd && <span className="text-xs text-slate-500">{f.dateTime(r.periodEnd)}</span>}
                      <Badge tone={r.product === 'gravity' ? 'violet' : r.product === 'flow' ? 'green' : r.product === 'budget' ? 'amber' : 'blue'}>{r.product === 'gravity' ? 'Gravity' : r.product === 'flow' ? 'Gravity Flow' : r.product === 'budget' ? 'Gravity Budget' : 'POS'}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* History */}
      <Card padded={false}>
        <div className="p-5 pb-3">
          <CardHeader title={t('superadmin.mail.history')} />
        </div>
        {!history.data ? (
          <SkeletonRows rows={3} />
        ) : history.data.items.length === 0 ? (
          <EmptyState icon={<Mail className="size-6" />} title={t('superadmin.mail.history_empty')} />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {history.data.items.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => setOpen(open === m.id ? null : m.id)} className="flex w-full items-center gap-4 px-5 py-3 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <span className="w-40 shrink-0 text-slate-500">{f.dateTime(m.createdAt)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium" dir="auto">
                    {m.subject}
                  </span>
                  <Badge tone={m.failedCount ? 'amber' : 'green'}>{t('superadmin.mail.delivered', { sent: m.sentCount, total: m.sentCount + m.failedCount })}</Badge>
                  <span className="w-32 shrink-0 truncate text-end text-slate-500">{m.sentByName}</span>
                </button>
                {open === m.id && (
                  <div className="grid gap-4 bg-slate-50 px-5 py-4 text-sm lg:grid-cols-2 dark:bg-slate-900/40">
                    <pre className="font-sans whitespace-pre-wrap text-slate-700 dark:text-slate-300" dir="auto">
                      {m.body}
                    </pre>
                    <ul className="space-y-1">
                      {m.recipients.map((r) => (
                        <li key={r.email} className="flex items-center justify-between gap-2">
                          <span className="truncate" dir="auto">
                            {r.business} · <Ltr>{r.email}</Ltr>
                          </span>
                          <Badge tone={r.ok ? 'green' : 'red'}>{r.ok ? t('superadmin.mail.ok') : t('superadmin.mail.not_sent')}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => send.mutate()}
        loading={send.isPending}
        title={t('superadmin.mail.confirm_title')}
        message={t('superadmin.mail.confirm_body', { count })}
        confirmLabel={t('superadmin.mail.send')}
      />
    </div>
  );
}
