import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, FileUp, Upload } from 'lucide-react';
import { api } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { useErrorMessage } from '../../lib/useApiError';
import { Alert, Card, PageHeader, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select, Switch, Textarea } from '../../components/ui/Form';
import { Tabs } from '../../components/ui/Tabs';

type Kind = 'products' | 'customers';

/** Target fields per import, and header names (any language/POS export) that map to them. */
const FIELDS: Record<Kind, { key: string; required?: boolean; number?: boolean; guess: RegExp }[]> = {
  products: [
    { key: 'name', required: true, guess: /^(product|item)?\s*name$|^item$|^product$|^description$/i },
    { key: 'sku', guess: /sku|barcode|bar code|code|item code|plu/i },
    { key: 'category', guess: /categor|group|department/i },
    { key: 'sellingPrice', number: true, guess: /^(selling |sale |retail |unit )?price$|^price|selling|retail/i },
    { key: 'costPrice', number: true, guess: /cost|purchase price|buying/i },
    { key: 'unit', guess: /^unit$|uom|unit of measure/i },
    { key: 'stock', number: true, guess: /stock|on hand|qty|quantity|inventory/i },
  ],
  customers: [
    { key: 'name', required: true, guess: /^(customer|client|full)?\s*name$|^customer$|^client$/i },
    { key: 'phone', guess: /phone|mobile|contact|tel/i },
    { key: 'email', guess: /e-?mail/i },
    { key: 'company', guess: /company|business|organi[sz]ation/i },
    { key: 'address', guess: /address|location/i },
    { key: 'taxNumber', guess: /tin|tax|gst|vat/i },
    { key: 'creditLimit', number: true, guess: /credit|limit/i },
  ],
};

/** CSV or tab-separated text (pasted from Excel) → rows of cells. Handles quotes and commas inside quotes. */
export function parseTable(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const sep = firstLine.includes('\t') ? '\t' : firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]!;
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === sep) {
      row.push(cell.trim());
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

/** "MVR 1,250.50" → 1250.5; empty or unreadable → null. */
export function parseNumber(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && /\d/.test(v) ? Math.max(0, n) : null;
}

const TEMPLATES: Record<Kind, string> = {
  products: 'name,sku,category,sellingPrice,costPrice,unit,stock\nCappuccino,CAP-01,Drinks,40,12,cup,\nMuffin,,Bakery,25,8,pcs,20\n',
  customers: 'name,phone,email,company,address,taxNumber,creditLimit\nAhmed Ali,7771234,ahmed@example.com,,Male,,\nSample Trading,9601234,,Sample Trading Pvt Ltd,Hulhumale,1000123GST001,5000\n',
};

interface Result {
  dryRun: boolean;
  created: number;
  updated: number;
  skipped: number;
  categoriesCreated?: number;
  errors: { row: number; code: string }[];
}

/** Import add-on: bring products and customers in from a CSV file or cells copied from Excel. */
export default function ImportPage() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const kinds = (['products', 'customers'] as const).filter((k) => can(k === 'products' ? 'products.create' : 'customers.create'));
  const [kind, setKind] = useState<Kind>(kinds[0] ?? 'products');
  return (
    <div className="space-y-6">
      <PageHeader title={t('import.title')} description={t('import.subtitle')} />
      {kinds.length > 1 && <Tabs tabs={kinds.map((k) => ({ value: k, label: t(`import.kinds.${k}`) }))} value={kind} onChange={setKind} />}
      <Importer key={kind} kind={kind} />
    </div>
  );
}

function Importer({ kind }: { kind: Kind }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [map, setMap] = useState<Record<string, number>>({});
  const [updateExisting, setUpdateExisting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const table = useMemo(() => parseTable(text), [text]);
  const headers = table[0] ?? [];
  const body = table.slice(1);
  const fields = FIELDS[kind];

  /** Guess the column for each field from the header row (first match wins, each column used once). */
  const loaded = (content: string) => {
    setText(content);
    setResult(null);
    const h = parseTable(content)[0] ?? [];
    const used = new Set<number>();
    const guess: Record<string, number> = {};
    for (const f of fields) {
      const idx = h.findIndex((name, i) => !used.has(i) && (name.toLowerCase() === f.key.toLowerCase() || f.guess.test(name)));
      if (idx >= 0) {
        guess[f.key] = idx;
        used.add(idx);
      }
    }
    setMap(guess);
  };

  const rows = body
    .map((r) =>
      Object.fromEntries(
        fields.map((f) => {
          const v = map[f.key] !== undefined ? r[map[f.key]!] : undefined;
          return [f.key, f.number ? parseNumber(v) : (v ?? '').trim()];
        }),
      ),
    )
    .filter((r) => String(r.name ?? '').trim() !== '')
    .map((r) => (kind === 'products' ? { ...r, sellingPrice: r.sellingPrice ?? 0, costPrice: r.costPrice ?? 0 } : r));

  const run = useMutation({
    mutationFn: (dryRun: boolean) => api.post<Result>(`/import/${kind}`, { rows, dryRun, updateExisting }),
    onSuccess: (r) => {
      setResult(r);
      if (!r.dryRun) {
        toast.success(t('import.done', { count: r.created + r.updated }));
        void qc.invalidateQueries({ queryKey: ['biz'] });
      }
    },
  });

  const download = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATES[kind]], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `oceanx-${kind}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <FileUp className="size-4" />
            {t('import.choose_file')}
            <input
              type="file"
              accept=".csv,.txt,.tsv,text/csv,text/plain"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setFileName(f.name);
                loaded(await f.text());
              }}
            />
          </label>
          <Button variant="ghost" icon={<Download className="size-4" />} onClick={download}>
            {t('import.template')}
          </Button>
          {fileName && <span className="text-sm text-slate-500" dir="auto">{fileName}</span>}
        </div>
        <p className="mt-3 text-xs text-slate-500">{t('import.file_hint')}</p>
        <Textarea className="mt-3" rows={4} label={t('import.paste')} placeholder={t('import.paste_placeholder')} value={text} onChange={(e) => loaded(e.target.value)} />
      </Card>

      {headers.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold">{t('import.match_columns')}</h2>
          <p className="mb-3 text-xs text-slate-500">{t('import.match_hint', { count: rows.length })}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {fields.map((f) => (
              <Select
                key={f.key}
                label={`${t(`import.fields.${f.key}`)}${f.required ? ' *' : ''}`}
                value={map[f.key] ?? ''}
                onChange={(e) => {
                  const next = { ...map };
                  if (e.target.value === '') delete next[f.key];
                  else next[f.key] = Number(e.target.value);
                  setMap(next);
                  setResult(null);
                }}
              >
                <option value="">{t('import.skip_field')}</option>
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h || `#${i + 1}`}
                  </option>
                ))}
              </Select>
            ))}
          </div>
          {rows.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/50">
                  <tr>
                    {fields
                      .filter((f) => map[f.key] !== undefined)
                      .map((f) => (
                        <th key={f.key} className="px-3 py-2 text-start font-medium whitespace-nowrap">
                          {t(`import.fields.${f.key}`)}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.slice(0, 8).map((r, i) => (
                    <tr key={i}>
                      {fields
                        .filter((f) => map[f.key] !== undefined)
                        .map((f) => (
                          <td key={f.key} className="px-3 py-1.5 whitespace-nowrap" dir="auto">
                            {r[f.key] === null ? '—' : String(r[f.key])}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4">
            <Switch checked={updateExisting} onChange={(v) => {
                setUpdateExisting(v);
                setResult(null);
              }} label={t('import.update_existing')} description={t(`import.update_existing_hint_${kind}`)} />
          </div>
          {map.name === undefined && <Alert tone="amber">{t('import.name_required')}</Alert>}
          {rows.length > 2000 && <Alert tone="amber">{t('import.too_many', { max: 2000 })}</Alert>}
          {run.error && <Alert tone="red">{errMsg(run.error)}</Alert>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" loading={run.isPending && run.variables} disabled={!rows.length || rows.length > 2000 || map.name === undefined} onClick={() => run.mutate(true)}>
              {t('import.check')}
            </Button>
            <Button icon={<Upload className="size-4" />} loading={run.isPending && !run.variables} disabled={!result?.dryRun || rows.length > 2000} onClick={() => run.mutate(false)}>
              {t('import.import_now', { count: rows.length })}
            </Button>
          </div>
          {!result && rows.length > 0 && <p className="mt-2 text-xs text-slate-500">{t('import.check_first')}</p>}
        </Card>
      )}

      {result && (
        <div className="space-y-3">
          <Alert tone={result.dryRun ? 'blue' : 'green'}>{result.dryRun ? t('import.preview_ready') : t('import.saved')}</Alert>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t('import.result.created')} value={result.created} tone="green" />
            <StatCard label={t('import.result.updated')} value={result.updated} tone="blue" />
            <StatCard label={t('import.result.skipped')} value={result.skipped} tone="amber" />
            {result.categoriesCreated !== undefined && <StatCard label={t('import.result.categories')} value={result.categoriesCreated} tone="violet" />}
          </div>
          {result.errors.length > 0 && (
            <Alert tone="amber">
              {t('import.row_errors', { count: result.errors.length })}{' '}
              {result.errors
                .slice(0, 20)
                .map((e) => t('import.row_error', { row: e.row + 1, reason: t(`import.errors.${e.code}`) }))
                .join(' · ')}
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
