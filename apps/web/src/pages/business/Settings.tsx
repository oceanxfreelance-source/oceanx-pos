import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { ImageUp, Lock } from 'lucide-react';
import { BUSINESS_TYPES, formatDocumentNumber, LANGUAGES, type BusinessSettings, type NumberingSettings } from '@oceanx/shared';
import { api } from '../../lib/api';
import { useBiz, useBizSession } from '../../auth/business';
import { useFieldErrors, useToastError } from '../../lib/useApiError';
import { Alert, Card, CardHeader, Ltr, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Switch, Textarea } from '../../components/ui/Form';
import { Tabs } from '../../components/ui/Tabs';
import { InkSetup } from '../../components/SignatureSetup';
import { ViberCreditSettings } from './ViberCreditSettings';

interface SettingsResponse {
  profile: { name: string; businessType: string; email: string; phone: string; address: string; hasLogo: boolean } | null;
  profileEditable: boolean;
  sections: Partial<BusinessSettings>;
  editable: string[];
}

type Tab = 'profile' | 'viber' | keyof BusinessSettings;

export default function SettingsPage() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const q = useQuery({ queryKey: ['biz', 'settings'], queryFn: () => api.get<SettingsResponse>('/settings') });
  const [tab, setTab] = useState<Tab | null>(null);
  const tabs: { value: Tab; label: string }[] = [];
  if (q.data?.profile) tabs.push({ value: 'profile', label: t('settings.tabs.profile') });
  for (const s of ['regional', 'tax', 'receipt', 'invoice', 'quotation', 'branding', 'pos', 'loyalty', 'online'] as const) if (q.data?.sections[s]) tabs.push({ value: s, label: t(`settings.tabs.${s}`) });
  if (can('settings.view')) tabs.push({ value: 'viber', label: t('viber.tab') });
  const active = tab ?? tabs[0]?.value ?? null;

  return (
    <div>
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />
      {q.isLoading || !q.data ? (
        <Card padded={false}>
          <SkeletonRows />
        </Card>
      ) : (
        <div className="space-y-6">
          <Tabs tabs={tabs} value={active as Tab} onChange={setTab} />
          {active === 'profile' && q.data.profile && <ProfileSection profile={q.data.profile} editable={q.data.profileEditable} />}
          {active === 'viber' && <ViberCreditSettings />}
          {active && active !== 'profile' && active !== 'viber' && q.data.sections[active] && (
            <SectionForm key={active} section={active} initial={q.data.sections[active] as never} editable={q.data.editable.includes(active)} />
          )}
        </div>
      )}
    </div>
  );
}

function ReadOnlyNote({ editable }: { editable: boolean }) {
  const { t } = useTranslation();
  if (editable) return null;
  return (
    <Alert tone="gray" icon={<Lock className="size-4" />}>
      {t('settings.read_only')}
    </Alert>
  );
}

function ProfileSection({ profile, editable }: { profile: NonNullable<SettingsResponse['profile']>; editable: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { refresh } = useBiz();
  const toastErr = useToastError();
  const [form, setForm] = useState(profile);
  const [logoVersion, setLogoVersion] = useState(Date.now());
  const fileRef = useRef<HTMLInputElement>(null);
  const save = useMutation({
    mutationFn: () => api.patch('/settings/profile', { name: form.name, businessType: form.businessType, email: form.email, phone: form.phone, address: form.address }),
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['biz', 'settings'] });
      void refresh();
    },
  });
  const upload = useMutation({
    mutationFn: (file: File) => api.upload('/settings/logo', file),
    onSuccess: () => {
      toast.success(t('settings.logo_updated'));
      setForm((f) => ({ ...f, hasLogo: true }));
      setLogoVersion(Date.now());
    },
    onError: toastErr,
  });
  const fieldErr = useFieldErrors(save.error);
  return (
    <Card>
      <CardHeader title={t('settings.tabs.profile')} description={t('settings.profile_hint')} />
      <div className="space-y-6">
        <ReadOnlyNote editable={editable} />
        <div className="flex items-center gap-4">
          <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
            {form.hasLogo ? <img src={`/api/settings/logo?v=${logoVersion}`} alt={t('settings.logo')} className="size-full object-contain" /> : <ImageUp className="size-7 text-slate-400" />}
          </div>
          {editable && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 1_048_576) toast.error(t('settings.logo_too_large'));
                    else upload.mutate(file);
                  }
                  e.target.value = '';
                }}
              />
              <Button variant="secondary" size="sm" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
                {t('settings.upload_logo')}
              </Button>
              <p className="mt-1.5 text-xs text-slate-500">{t('settings.logo_hint')}</p>
            </div>
          )}
        </div>
        <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
          <Input label={t('auth.business_name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fieldErr('name')} required />
          <Select label={t('auth.business_type')} value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })} hint={t('settings.business_type_hint')}>
            {BUSINESS_TYPES.map((b) => (
              <option key={b} value={b}>
                {t(`business_types.${b}`)}
              </option>
            ))}
          </Select>
          <Input type="email" label={t('auth.email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={fieldErr('email')} />
          <Input type="tel" label={t('common.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={fieldErr('phone')} />
          <Textarea className="sm:col-span-2" label={t('common.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} error={fieldErr('address')} />
        </fieldset>
        {editable && (
          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} loading={save.isPending}>
              {t('common.save_changes')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function SectionForm<S extends keyof BusinessSettings>({ section, initial, editable }: { section: S; initial: BusinessSettings[S]; editable: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { refresh } = useBiz();
  const [value, setValue] = useState<BusinessSettings[S]>(initial);
  useEffect(() => setValue(initial), [initial]);
  const save = useMutation({
    mutationFn: () => api.patch(`/settings/${section}`, value),
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['biz', 'settings'] });
      if (section === 'regional' || section === 'pos' || section === 'tax') void refresh();
    },
  });
  const fieldErr = useFieldErrors(save.error);
  const set = (patch: Partial<BusinessSettings[S]>) => setValue((v) => ({ ...v, ...patch }));
  const v = value as Record<string, unknown>;

  let body: ReactNode = null;
  if (section === 'regional') {
    const r = value as BusinessSettings['regional'];
    body = (
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('settings.currency')} value={r.currency} maxLength={3} dir="ltr" onChange={(e) => set({ currency: e.target.value.toUpperCase() } as never)} error={fieldErr('currency')} />
        <Input label={t('settings.currency_symbol')} value={r.currencySymbol} maxLength={6} onChange={(e) => set({ currencySymbol: e.target.value } as never)} error={fieldErr('currencySymbol')} />
        <Select label={t('settings.currency_decimals')} value={r.currencyDecimals} onChange={(e) => set({ currencyDecimals: Number(e.target.value) } as never)}>
          {[0, 1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
        <Input label={t('settings.timezone')} value={r.timezone} dir="ltr" onChange={(e) => set({ timezone: e.target.value } as never)} error={fieldErr('timezone')} />
        <Select label={t('settings.date_format')} value={r.dateFormat} onChange={(e) => set({ dateFormat: e.target.value } as never)}>
          {['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD MMM YYYY'].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
        <Select label={t('settings.time_format')} value={r.timeFormat} onChange={(e) => set({ timeFormat: e.target.value } as never)}>
          <option value="24h">{t('settings.time_24h')}</option>
          <option value="12h">{t('settings.time_12h')}</option>
        </Select>
        <Select label={t('settings.document_language')} hint={t('settings.document_language_hint')} value={r.documentLanguage} onChange={(e) => set({ documentLanguage: e.target.value } as never)}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeName} — {l.name}
            </option>
          ))}
        </Select>
      </div>
    );
  } else if (section === 'tax') {
    const x = value as BusinessSettings['tax'];
    body = (
      <div className="space-y-5">
        <Switch checked={x.taxEnabled} onChange={(c) => set({ taxEnabled: c } as never)} label={t('settings.tax_enabled')} description={t('settings.tax_enabled_hint')} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label={t('settings.tax_name')} value={x.taxName} onChange={(e) => set({ taxName: e.target.value } as never)} disabled={!x.taxEnabled} error={fieldErr('taxName')} />
          <Input type="number" step="0.01" min={0} max={100} label={t('settings.tax_rate')} value={x.taxRate} onChange={(e) => set({ taxRate: Number(e.target.value) } as never)} disabled={!x.taxEnabled} error={fieldErr('taxRate')} />
          <Input label={t('settings.tax_number')} value={x.taxNumber} dir="ltr" onChange={(e) => set({ taxNumber: e.target.value } as never)} error={fieldErr('taxNumber')} />
        </div>
        <Switch checked={x.pricesIncludeTax} onChange={(c) => set({ pricesIncludeTax: c } as never)} label={t('settings.prices_include_tax')} disabled={!x.taxEnabled} />
        <div className="h-px bg-slate-100 dark:bg-slate-800" />
        <Switch checked={x.serviceChargeEnabled} onChange={(c) => set({ serviceChargeEnabled: c } as never)} label={t('settings.service_charge_enabled')} description={t('settings.service_charge_hint')} />
        <Input
          className="sm:max-w-xs"
          type="number"
          step="0.01"
          min={0}
          max={100}
          label={t('settings.service_charge_rate')}
          value={x.serviceChargeRate}
          onChange={(e) => set({ serviceChargeRate: Number(e.target.value) } as never)}
          disabled={!x.serviceChargeEnabled}
          error={fieldErr('serviceChargeRate')}
        />
      </div>
    );
  } else if (section === 'pos') {
    const x = value as BusinessSettings['pos'];
    body = (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label={t('settings.pos.default_order_type')} value={x.defaultOrderType} onChange={(e) => set({ defaultOrderType: e.target.value } as never)}>
            {['dine_in', 'takeaway', 'delivery'].map((o) => (
              <option key={o} value={o}>
                {t(`pos.order_types.${o}`)}
              </option>
            ))}
          </Select>
          <Input type="number" min={0} max={100} step="0.01" label={t('settings.pos.max_discount')} hint={t('settings.pos.max_discount_hint')} value={x.maxDiscountPercent} onChange={(e) => set({ maxDiscountPercent: Number(e.target.value) } as never)} error={fieldErr('maxDiscountPercent')} />
        </div>
        <Switch checked={x.sendToKitchen} onChange={(c) => set({ sendToKitchen: c } as never)} label={t('settings.pos.send_to_kitchen')} description={t('settings.pos.send_to_kitchen_hint')} />
        <Switch checked={x.requireTableForDineIn} onChange={(c) => set({ requireTableForDineIn: c } as never)} label={t('settings.pos.require_table')} />
        <Switch checked={x.allowNegativeStock} onChange={(c) => set({ allowNegativeStock: c } as never)} label={t('settings.pos.allow_negative_stock')} description={t('settings.pos.allow_negative_stock_hint')} />
      </div>
    );
  } else if (section === 'loyalty') {
    const x = value as BusinessSettings['loyalty'];
    body = (
      <div className="grid gap-4 sm:grid-cols-3">
        <Input type="number" min={0} step="0.01" label={t('settings.loyalty.points_per_unit')} hint={t('settings.loyalty.points_per_unit_hint')} value={x.pointsPerUnit} onChange={(e) => set({ pointsPerUnit: Number(e.target.value) } as never)} error={fieldErr('pointsPerUnit')} />
        <Input type="number" min={0} step="0.01" label={t('settings.loyalty.point_value')} hint={t('settings.loyalty.point_value_hint')} value={x.pointValue / 100} onChange={(e) => set({ pointValue: Math.round(Number(e.target.value) * 100) } as never)} error={fieldErr('pointValue')} />
        <Input type="number" min={0} step="1" label={t('settings.loyalty.min_redeem')} value={x.minRedeemPoints} onChange={(e) => set({ minRedeemPoints: Math.floor(Number(e.target.value)) } as never)} error={fieldErr('minRedeemPoints')} />
      </div>
    );
  } else if (section === 'branding') {
    const x = value as BusinessSettings['branding'];
    body = (
      <div className="space-y-5">
        <StampSetup />
        <Switch checked={x.showStamp} onChange={(c) => set({ showStamp: c } as never)} label={t('branding.show_stamp')} description={t('branding.show_stamp_hint')} />
        <Switch checked={x.showSignature} onChange={(c) => set({ showSignature: c } as never)} label={t('branding.show_signature')} description={t('branding.show_signature_hint')} />
      </div>
    );
  } else if (section === 'online') {
    const x = value as BusinessSettings['online'];
    body = (
      <div className="space-y-5">
        <MenuLink />
        <Switch checked={x.menuEnabled} onChange={(c) => set({ menuEnabled: c } as never)} label={t('settings.online.menu_enabled')} description={t('settings.online.menu_enabled_hint')} />
        <Switch checked={x.showPrices} onChange={(c) => set({ showPrices: c } as never)} label={t('settings.online.show_prices')} />
        <Switch checked={x.ordersEnabled} onChange={(c) => set({ ordersEnabled: c } as never)} label={t('settings.online.orders_enabled')} description={t('settings.online.orders_enabled_hint')} />
        <Textarea label={t('settings.online.message')} value={x.message} onChange={(e) => set({ message: e.target.value } as never)} error={fieldErr('message')} />
      </div>
    );
  } else {
    const doc = v as { numbering: NumberingSettings; language: string | null; header?: string; footer: string; notes?: string; terms?: string };
    body = (
      <div className="space-y-6">
        {section === 'receipt' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Switch checked={!!v.showLogo} onChange={(c) => set({ showLogo: c } as never)} label={t('settings.show_logo')} />
            <Textarea className="sm:col-span-2" label={t('settings.receipt_header')} value={doc.header ?? ''} onChange={(e) => set({ header: e.target.value } as never)} />
          </div>
        )}
        {section === 'invoice' && (
          <Input
            className="sm:max-w-xs"
            type="number"
            min={0}
            max={365}
            label={t('settings.default_due_days')}
            value={Number(v.defaultDueDays)}
            onChange={(e) => set({ defaultDueDays: Number(e.target.value) } as never)}
            error={fieldErr('defaultDueDays')}
          />
        )}
        {section === 'quotation' && (
          <Input
            className="sm:max-w-xs"
            type="number"
            min={1}
            max={365}
            label={t('settings.validity_days')}
            value={Number(v.validityDays)}
            onChange={(e) => set({ validityDays: Number(e.target.value) } as never)}
            error={fieldErr('validityDays')}
          />
        )}
        <NumberingEditor value={doc.numbering} onChange={(numbering) => set({ numbering } as never)} fieldErr={fieldErr} />
        <Select label={t('settings.document_language_override')} hint={t('settings.document_language_override_hint')} value={doc.language ?? ''} onChange={(e) => set({ language: e.target.value || null } as never)}>
          <option value="">{t('settings.use_default_document_language')}</option>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeName} — {l.name}
            </option>
          ))}
        </Select>
        {section !== 'receipt' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Textarea label={t('settings.default_notes')} value={doc.notes ?? ''} onChange={(e) => set({ notes: e.target.value } as never)} />
            <Textarea label={t('settings.terms')} value={doc.terms ?? ''} onChange={(e) => set({ terms: e.target.value } as never)} />
          </div>
        )}
        <Textarea label={t('settings.footer')} value={doc.footer} onChange={(e) => set({ footer: e.target.value } as never)} hint={t('settings.footer_hint')} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader title={t(`settings.tabs.${section}`)} description={t(`settings.hints.${section}`)} />
      <div className="space-y-6">
        <ReadOnlyNote editable={editable} />
        <fieldset disabled={!editable}>{body}</fieldset>
        {editable && (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setValue(initial)}>
              {t('common.reset')}
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending}>
              {t('common.save_changes')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function NumberingEditor({ value, onChange, fieldErr }: { value: NumberingSettings; onChange: (n: NumberingSettings) => void; fieldErr: (k: string) => string | undefined }) {
  const { t } = useTranslation();
  const set = (patch: Partial<NumberingSettings>) => onChange({ ...value, ...patch });
  let preview = '—';
  try {
    preview = value.format.includes('{SEQ}') ? formatDocumentNumber(value, value.startNumber, new Date()) : '—';
  } catch {
    /* ignore */
  }
  return (
    <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-800/40 dark:ring-slate-700">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t('settings.numbering')}</p>
        <p className="text-sm text-slate-500">
          {t('settings.numbering_preview')}: <Ltr className="font-mono font-semibold text-slate-900 dark:text-white">{preview}</Ltr>
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Input label={t('settings.prefix')} value={value.prefix} dir="ltr" onChange={(e) => set({ prefix: e.target.value.toUpperCase() })} error={fieldErr('numbering.prefix')} />
        <Input type="number" min={1} label={t('settings.start_number')} value={value.startNumber} onChange={(e) => set({ startNumber: Number(e.target.value) })} error={fieldErr('numbering.startNumber')} />
        <Input type="number" min={1} max={10} label={t('settings.padding')} value={value.padding} onChange={(e) => set({ padding: Number(e.target.value) })} error={fieldErr('numbering.padding')} />
        <Input label={t('settings.format')} value={value.format} dir="ltr" onChange={(e) => set({ format: e.target.value })} error={fieldErr('numbering.format')} />
        <Select label={t('settings.reset')} value={value.reset} onChange={(e) => set({ reset: e.target.value as NumberingSettings['reset'] })}>
          <option value="never">{t('settings.reset_never')}</option>
          <option value="yearly">{t('settings.reset_yearly')}</option>
          <option value="monthly">{t('settings.reset_monthly')}</option>
        </Select>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {t('settings.format_tokens')} <Ltr className="font-mono">{'{PREFIX} {YYYY} {YY} {MM} {SEQ}'}</Ltr>
      </p>
    </div>
  );
}

/** Public QR-menu link and a scannable QR code generated locally (no external service). */
function MenuLink() {
  const { t } = useTranslation();
  const session = useBizSession();
  const url = `${window.location.origin}/menu/${session.business.slug}`;
  const [png, setPng] = useState<string | null>(null);
  useEffect(() => {
    void QRCode.toDataURL(url, { margin: 1, width: 240 }).then(setPng);
  }, [url]);
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/40">
      {png && <img src={png} alt={t('settings.online.qr_alt')} className="size-32 rounded-lg bg-white p-1" />}
      <div className="min-w-0 space-y-2 text-sm">
        <p className="font-medium">{t('settings.online.public_link')}</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="block break-all text-brand-700 underline dark:text-brand-300" dir="ltr">
          {url}
        </a>
        {png && (
          <a href={png} download={`menu-qr-${session.business.slug}.png`} className="inline-block font-medium text-brand-700 hover:underline dark:text-brand-300">
            {t('settings.online.download_qr')}
          </a>
        )}
      </div>
    </div>
  );
}

/** Company stamp (owner or manager): upload a photo or scan; paper becomes transparent. */
function StampSetup() {
  const { t } = useTranslation();
  const session = useBizSession();
  const { refresh } = useBiz();
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t('branding.company_stamp')}</p>
      <p className="text-xs text-slate-500">{t('branding.company_stamp_hint')}</p>
      <InkSetup current={session.business.hasStamp ? '/api/settings/stamp' : null} uploadPath="/settings/stamp" allowDraw={false} onChanged={() => void refresh()} previewClass="size-32 object-contain" />
    </div>
  );
}
