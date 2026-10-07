import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, Plus, UtensilsCrossed } from 'lucide-react';
import type { Translations } from '@oceanx/shared';
import { api } from '../../lib/api';
import { useBiz, useBizSession } from '../../auth/business';
import { menuUrl } from '../../lib/qrMenu';
import { useMoney } from '../../lib/money';
import { useToastError } from '../../lib/useApiError';
import { Card, EmptyState, SkeletonRows } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Switch } from '../../components/ui/Form';
import { ItemAvatar } from '../../components/ItemAvatar';
import { ProductDialog, useCategories, type Product } from './Products';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  translations: Translations;
  categoryId: string | null;
  categoryName: string | null;
  sellingPrice: number;
  hasImage: boolean;
  isActive: boolean;
  showInMenu: boolean;
  menuSort: number;
}

/** The dishes on the customer QR menu, grouped like the menu: photo, Dhivehi name, show/hide and order. */
export function QrMenuItems() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const session = useBizSession();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const money = useMoney();
  const cats = useCategories();
  const q = useQuery({ queryKey: ['biz', 'qr-menu-items'], queryFn: () => api.get<{ items: MenuItem[] }>('/qr-menu/items') });
  const canEdit = can('products.edit') || can('qr_menu.manage');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['biz', 'qr-menu-items'] });

  const toggle = useMutation({
    mutationFn: ({ id, showInMenu }: { id: string; showInMenu: boolean }) => api.patch(`/qr-menu/items/${id}`, { showInMenu }),
    onMutate: ({ id, showInMenu }) =>
      qc.setQueryData<{ items: MenuItem[] }>(['biz', 'qr-menu-items'], (d) => d && { items: d.items.map((x) => (x.id === id ? { ...x, showInMenu } : x)) }),
    onError: (e) => {
      toastErr(e);
      refresh();
    },
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.put('/qr-menu/order', { ids }),
    onSuccess: refresh,
    onError: toastErr,
  });
  const open = useMutation({
    mutationFn: (id: string) => api.get<Product>(`/products/${id}`),
    onSuccess: (p) => setEditing(p),
    onError: toastErr,
  });

  // Same grouping and order as the customer menu.
  const groups = useMemo(() => {
    const items = q.data?.items ?? [];
    const list = (cats.data?.items ?? []).map((c) => ({ id: c.id, name: c.name, items: items.filter((p) => p.categoryId === c.id) }));
    const known = new Set(list.map((c) => c.id));
    list.push({ id: 'other', name: t('public_menu.more'), items: items.filter((p) => !p.categoryId || !known.has(p.categoryId)) });
    return list.filter((g) => g.items.length);
  }, [q.data, cats.data, t]);

  const move = (groupItems: MenuItem[], index: number, dir: -1 | 1) => {
    const all = groups.flatMap((g) => g.items);
    const a = groupItems[index]!;
    const b = groupItems[index + dir];
    if (!b) return;
    const ids = all.map((x) => x.id);
    const ia = ids.indexOf(a.id);
    const ib = ids.indexOf(b.id);
    [ids[ia], ids[ib]] = [ids[ib]!, ids[ia]!];
    qc.setQueryData<{ items: MenuItem[] }>(['biz', 'qr-menu-items'], (d) => d && { items: ids.map((id, i) => ({ ...d.items.find((x) => x.id === id)!, menuSort: i + 1 })) });
    reorder.mutate(ids);
  };

  const shown = q.data?.items.filter((x) => x.showInMenu && x.isActive).length ?? 0;
  const noPhoto = q.data?.items.filter((x) => x.showInMenu && x.isActive && !x.hasImage).length ?? 0;
  const noDv = q.data?.items.filter((x) => x.showInMenu && x.isActive && !x.translations?.dv?.name).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="me-auto text-sm text-slate-600 dark:text-slate-300">
          {t('qr.items_summary', { count: shown })}
          {noPhoto > 0 && <span className="text-amber-700 dark:text-amber-400"> · {t('qr.items_no_photo', { count: noPhoto })}</span>}
          {noDv > 0 && <span className="text-amber-700 dark:text-amber-400"> · {t('qr.items_no_dv', { count: noDv })}</span>}
        </p>
        <a href={menuUrl(session.business.slug)} target="_blank" rel="noopener noreferrer">
          <Button variant="secondary" icon={<ExternalLink className="size-4" />}>
            {t('qr.open_menu')}
          </Button>
        </a>
        {can('products.create') && (
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('qr.add_dish')}
          </Button>
        )}
      </div>

      {!q.data || !cats.data ? (
        <Card>
          <SkeletonRows rows={6} />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState icon={<UtensilsCrossed className="size-6" />} title={t('products.empty_title')} description={t('qr.items_empty_hint')} />
        </Card>
      ) : (
        groups.map((g) => (
          <Card key={g.id} padded={false}>
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-bold tracking-wide text-slate-700 uppercase dark:border-slate-800 dark:text-slate-200" dir="auto">
              {g.name}
            </h2>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {g.items.map((p, i) => (
                <li key={p.id} className={`flex items-center gap-3 px-4 py-3 ${p.showInMenu && p.isActive ? '' : 'opacity-55'}`}>
                  <button
                    type="button"
                    className="group relative shrink-0"
                    onClick={() => open.mutate(p.id)}
                    disabled={!can('products.edit')}
                    aria-label={p.hasImage ? t('products.change_photo') : t('products.add_photo')}
                  >
                    <ItemAvatar name={p.name} tintKey={p.categoryId || p.name} src={p.hasImage ? `/api/products/${p.id}/image` : null} className="size-14 rounded-full! text-base" />
                    {!p.hasImage && (
                      <span className="absolute -end-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-brand-600 text-white shadow ring-2 ring-white dark:ring-slate-900">
                        <ImagePlus className="size-3.5" />
                      </span>
                    )}
                  </button>
                  <button type="button" className="min-w-0 flex-1 text-start" onClick={() => open.mutate(p.id)} disabled={!can('products.edit')}>
                    <p className="truncate font-semibold" dir="auto">
                      {p.name}
                    </p>
                    {p.translations?.dv?.name ? (
                      <p className="truncate text-sm text-slate-600 dark:text-slate-300">
                        <bdi lang="dv">{p.translations.dv.name}</bdi>
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700 dark:text-amber-400">{t('qr.no_dv_name')}</p>
                    )}
                  </button>
                  <span className="hidden shrink-0 text-sm font-medium sm:block">{money(p.sellingPrice)}</span>
                  {canEdit && (
                    <div className="flex shrink-0 flex-col">
                      <IconButton label={t('qr.move_up')} onClick={() => move(g.items, i, -1)} disabled={i === 0 || reorder.isPending} className="p-1!">
                        <ArrowUp className="size-4" />
                      </IconButton>
                      <IconButton label={t('qr.move_down')} onClick={() => move(g.items, i, 1)} disabled={i === g.items.length - 1 || reorder.isPending} className="p-1!">
                        <ArrowDown className="size-4" />
                      </IconButton>
                    </div>
                  )}
                  <Switch
                    checked={p.showInMenu}
                    onChange={(v) => toggle.mutate({ id: p.id, showInMenu: v }, { onSuccess: () => toast.success(t('common.saved')) })}
                    label={<span className="sr-only">{t('products.show_in_menu')}</span>}
                    disabled={!canEdit || !p.isActive}
                  />
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
      {editing && (
        <ProductDialog
          product={editing === 'new' ? null : editing}
          categories={cats.data?.items ?? []}
          onClose={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
