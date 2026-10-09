import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { moduleLabel, permissionLabel, roleDescription, roleLabel } from '../../lib/labels';
import { useErrorMessage, useFieldErrors, useToastError } from '../../lib/useApiError';
import { Alert, Badge, Card, EmptyState, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Checkbox, Input, Textarea } from '../../components/ui/Form';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';

interface Role {
  id: string;
  name: string;
  systemKey: string | null;
  description: string;
  permissions: string[];
  userCount: number;
}
interface CatalogItem {
  key: string;
  module: string;
  addon: string | null;
  available: boolean;
  grantable: boolean;
}

export default function RolesPage() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const roles = useQuery({ queryKey: ['biz', 'roles'], queryFn: () => api.get<{ items: Role[] }>('/roles') });
  const [editing, setEditing] = useState<Role | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      toast.success(t('roles.deleted'));
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: ['biz', 'roles'] });
    },
    onError: toastErr,
  });

  return (
    <div>
      <PageHeader
        title={t('roles.title')}
        description={t('roles.subtitle')}
        actions={
          can('roles.manage') && (
            <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
              {t('roles.create')}
            </Button>
          )
        }
      />
      {roles.isLoading ? (
        <Card padded={false}>
          <SkeletonRows />
        </Card>
      ) : !roles.data?.items.length ? (
        <Card>
          <EmptyState icon={<ShieldCheck className="size-6" />} title={t('roles.empty_title')} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {roles.data.items.map((r) => (
            <Card key={r.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-900 dark:text-white" dir="auto">
                    {roleLabel(t, r)}
                  </h3>
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate-500" dir="auto">
                    {r.description || (r.systemKey ? roleDescription(t, r.systemKey) : '')}
                  </p>
                </div>
                {r.systemKey ? <Badge tone="violet">{t('roles.system_badge')}</Badge> : <Badge>{t('roles.custom_badge')}</Badge>}
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-4" />
                  {t('roles.permission_count', { count: r.permissions.length })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" />
                  {t('roles.user_count', { count: r.userCount })}
                </span>
              </div>
              <div className="mt-auto flex justify-end gap-1 pt-4">
                {r.systemKey === 'business_admin' ? (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <Lock className="size-3.5" />
                    {t('roles.protected')}
                  </span>
                ) : (
                  <>
                    <IconButton label={can('roles.manage') ? t('common.edit') : t('common.view')} onClick={() => setEditing(r)}>
                      <Pencil className="size-4" />
                    </IconButton>
                    {can('roles.manage') && !r.systemKey && (
                      <IconButton label={t('common.delete')} onClick={() => setDeleting(r)} className="hover:text-rose-600">
                        <Trash2 className="size-4" />
                      </IconButton>
                    )}
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <RoleEditor role={editing === 'new' ? null : editing} readOnly={!can('roles.manage')} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting.id)}
        loading={del.isPending}
        danger
        title={t('roles.delete_title')}
        message={deleting?.userCount ? t('roles.delete_in_use', { count: deleting.userCount }) : t('roles.delete_body', { name: deleting?.name })}
        confirmLabel={t('common.delete')}
      />
    </div>
  );
}

function RoleEditor({ role, readOnly, onClose }: { role: Role | null; readOnly: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const catalog = useQuery({ queryKey: ['biz', 'permissions'], queryFn: () => api.get<{ items: CatalogItem[] }>('/permissions') });
  const [name, setName] = useState(role ? roleLabel(t, role) : '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? ['dashboard.view']));
  const grouped = useMemo(() => {
    const out = new Map<string, CatalogItem[]>();
    for (const p of catalog.data?.items ?? []) out.set(p.module, [...(out.get(p.module) ?? []), p]);
    return [...out.entries()];
  }, [catalog.data]);

  const save = useMutation({
    mutationFn: () => {
      // System roles keep their stored name (the field shows a translated label).
      const body = { name: role?.systemKey ? role.name : name, description, permissions: [...selected] };
      return role ? api.put(`/roles/${role.id}`, body) : api.post('/roles', body);
    },
    onSuccess: () => {
      toast.success(role ? t('roles.updated') : t('roles.created'));
      void qc.invalidateQueries({ queryKey: ['biz', 'roles'] });
      void qc.invalidateQueries({ queryKey: ['biz', 'session'] });
      onClose();
    },
  });
  const fieldErr = useFieldErrors(save.error);
  const toggle = (key: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(key);
      else n.delete(key);
      return n;
    });

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={readOnly ? roleLabel(t, role!) : role ? t('roles.edit') : t('roles.create')}
      description={t('roles.editor_hint')}
      footer={
        readOnly ? (
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={name.trim().length < 2}>
              {t('common.save')}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        {save.error && !(save.error instanceof ApiError && save.error.code === 'validation_failed') && <Alert tone="red">{errMsg(save.error)}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} error={fieldErr('name')} disabled={readOnly || !!role?.systemKey} required />
          <Textarea label={t('common.description')} rows={1} value={description} onChange={(e) => setDescription(e.target.value)} disabled={readOnly} />
        </div>
        {catalog.isLoading ? (
          <SkeletonRows rows={4} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {grouped.map(([module, perms]) => {
              const allOn = perms.filter((p) => p.available && p.grantable).every((p) => selected.has(p.key));
              const moduleAvailable = perms.some((p) => p.available);
              return (
                <div key={module} className="rounded-xl p-4 ring-1 ring-slate-200 dark:ring-slate-800">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{moduleLabel(t, module)}</p>
                    {!moduleAvailable ? (
                      <Badge tone="amber">{perms[0]?.addon ? t('roles.addon_required') : t('roles.not_in_plan')}</Badge>
                    ) : (
                      !readOnly && (
                        <button
                          type="button"
                          className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                          onClick={() => perms.filter((p) => p.available && p.grantable).forEach((p) => toggle(p.key, !allOn))}
                        >
                          {allOn ? t('roles.clear_all') : t('roles.select_all')}
                        </button>
                      )
                    )}
                  </div>
                  <div className="space-y-2">
                    {perms.map((p) => (
                      <Checkbox
                        key={p.key}
                        checked={selected.has(p.key)}
                        disabled={readOnly || !p.grantable}
                        onChange={(v) => toggle(p.key, v)}
                        label={permissionLabel(t, p.key)}
                        description={!p.grantable ? t('roles.cannot_grant') : !p.available ? t('roles.inactive_until_enabled') : undefined}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Dialog>
  );
}
