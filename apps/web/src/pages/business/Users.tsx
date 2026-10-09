import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, Pencil, Plus, Search, Trash2, UserPlus, Users as UsersIcon } from 'lucide-react';
import { LANGUAGES } from '@oceanx/shared';
import { api, ApiError, qs, type Paginated } from '../../lib/api';
import { useBiz, useBizSession } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { roleLabel } from '../../lib/labels';
import { useErrorMessage, useFieldErrors, useToastError } from '../../lib/useApiError';
import { Badge, Card, EmptyState, Ltr, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Checkbox, Input, Select, Switch } from '../../components/ui/Form';
import { DataTable, Pagination, type Column } from '../../components/ui/Table';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { Alert } from '../../components/ui/Card';

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  language: string;
  isOwner: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: { id: string; name: string; systemKey: string | null }[];
}
interface UserDetail extends UserRow {
  outletIds: string[];
}
interface RoleItem {
  id: string;
  name: string;
  systemKey: string | null;
  permissions: string[];
}

export default function UsersPage() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const f = useFormat();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null);
  const [pwFor, setPwFor] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const session = useBizSession();
  const qc = useQueryClient();
  const toastErr = useToastError();

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(id);
  }, [search]);

  const list = useQuery({
    queryKey: ['biz', 'users', page, q],
    queryFn: () => api.get<Paginated<UserRow>>(`/users${qs({ page, pageSize: 20, q })}`),
    placeholderData: keepPreviousData,
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success(t('users.deleted'));
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: ['biz', 'users'] });
    },
    onError: toastErr,
  });

  const columns: Column<UserRow>[] = [
    {
      key: 'name',
      header: t('common.name'),
      cell: (u) => (
        <div className="flex items-center gap-3">
          <span className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 sm:flex dark:bg-slate-800 dark:text-slate-300">
            {u.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900 dark:text-white" dir="auto">
              {u.name} {u.id === session.user.id && <span className="text-xs font-normal text-slate-400">({t('users.you')})</span>}
            </p>
            <p className="truncate text-xs text-slate-500">
              <Ltr>{u.email}</Ltr>
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'roles',
      header: t('users.roles'),
      cell: (u) => (
        <div className="flex flex-wrap justify-end gap-1 md:justify-start">
          {u.isOwner && <Badge tone="violet">{t('users.owner')}</Badge>}
          {u.roles
            // Don't repeat "Owner" when the role itself is called Owner (shops).
            .filter((r) => !(u.isOwner && roleLabel(t, r) === t('users.owner')))
            .map((r) => (
              <Badge key={r.id} tone="blue">
                {roleLabel(t, r)}
              </Badge>
            ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      cell: (u) => (
        <Badge tone={u.isActive ? 'green' : 'gray'} dot>
          {u.isActive ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
    { key: 'last', header: t('users.last_login'), hideOnMobile: true, cell: (u) => <span className="text-slate-500">{u.lastLoginAt ? f.relative(u.lastLoginAt) : t('users.never')}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">{t('common.actions')}</span>,
      className: 'text-end',
      cell: (u) =>
        u.id === session.user.id ? null : (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {can('users.edit') && (
              <>
                <IconButton label={t('common.edit')} onClick={() => setEditing(u)}>
                  <Pencil className="size-4" />
                </IconButton>
                <IconButton label={t('users.set_password')} onClick={() => setPwFor(u)}>
                  <KeyRound className="size-4" />
                </IconButton>
              </>
            )}
            {can('users.delete') && !u.isOwner && (
              <IconButton label={t('common.delete')} onClick={() => setDeleting(u)} className="hover:text-rose-600">
                <Trash2 className="size-4" />
              </IconButton>
            )}
          </div>
        ),
    },
  ];

  const limit = session.limits.max_users;
  return (
    <div>
      <PageHeader
        title={t('users.title')}
        description={limit != null ? t('users.subtitle_limit', { count: list.data?.total ?? 0, limit }) : t('users.subtitle')}
        actions={
          can('users.create') && (
            <Button icon={<UserPlus className="size-4" />} onClick={() => setEditing('new')}>
              {t('users.create')}
            </Button>
          )
        }
      />
      <Card padded={false}>
        <div className="border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('users.search')}
              className="w-full rounded-xl border-0 bg-slate-50 py-2 ps-9 pe-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-600 focus:outline-none dark:bg-slate-800 dark:ring-slate-700"
            />
          </div>
        </div>
        {list.isLoading ? (
          <SkeletonRows />
        ) : !list.data?.items.length ? (
          <EmptyState
            icon={<UsersIcon className="size-6" />}
            title={q ? t('common.no_results') : t('users.empty_title')}
            description={q ? undefined : t('users.empty_body')}
            action={
              !q &&
              can('users.create') && (
                <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
                  {t('users.create')}
                </Button>
              )
            }
          />
        ) : (
          <>
            <DataTable columns={columns} rows={list.data.items} rowKey={(u) => u.id} onRowClick={can('users.edit') ? (u) => u.id !== session.user.id && setEditing(u) : undefined} />
            <Pagination page={page} pageSize={20} total={list.data.total} onPage={setPage} />
          </>
        )}
      </Card>

      {editing && <UserDialog user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {pwFor && <SetPasswordDialog user={pwFor} onClose={() => setPwFor(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting.id)}
        loading={del.isPending}
        danger
        title={t('users.delete_title')}
        message={t('users.delete_body', { name: deleting?.name })}
        confirmLabel={t('common.delete')}
      />
    </div>
  );
}

function UserDialog({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const { t } = useTranslation();
  const session = useBizSession();
  const { hasAddon } = useBiz();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const roles = useQuery({ queryKey: ['biz', 'roles'], queryFn: () => api.get<{ items: RoleItem[] }>('/roles') });
  const detail = useQuery({ queryKey: ['biz', 'user', user?.id], queryFn: () => api.get<UserDetail>(`/users/${user!.id}`), enabled: !!user });
  const [form, setForm] = useState({ name: '', email: '', phone: '', language: 'en', password: '', roleIds: [] as string[], outletIds: [] as string[], mustChangePassword: true, isActive: true });
  useEffect(() => {
    if (detail.data)
      setForm((f) => ({
        ...f,
        name: detail.data.name,
        email: detail.data.email,
        phone: detail.data.phone,
        language: detail.data.language,
        roleIds: detail.data.roles.map((r) => r.id),
        outletIds: detail.data.outletIds,
        isActive: detail.data.isActive,
      }));
  }, [detail.data]);

  const save = useMutation({
    mutationFn: () => {
      const showOutlets = hasAddon('multi_outlet') && session.outlets.length > 1;
      if (user) {
        return api.patch(`/users/${user.id}`, {
          name: form.name,
          email: form.email,
          phone: form.phone,
          language: form.language,
          roleIds: form.roleIds,
          ...(showOutlets ? { outletIds: form.outletIds } : {}),
          ...(!user.isOwner ? { isActive: form.isActive } : {}),
        });
      }
      return api.post('/users', {
        name: form.name,
        email: form.email,
        phone: form.phone,
        language: form.language,
        password: form.password,
        roleIds: form.roleIds,
        mustChangePassword: form.mustChangePassword,
        ...(showOutlets && form.outletIds.length ? { outletIds: form.outletIds } : {}),
      });
    },
    onSuccess: () => {
      toast.success(user ? t('users.updated') : t('users.created'));
      void qc.invalidateQueries({ queryKey: ['biz', 'users'] });
      void qc.invalidateQueries({ queryKey: ['biz', 'user'] });
      onClose();
    },
  });
  const fieldErr = useFieldErrors(save.error);
  const toggle = (list: 'roleIds' | 'outletIds', id: string, on: boolean) =>
    setForm((f) => ({ ...f, [list]: on ? [...f[list], id] : f[list].filter((x) => x !== id) }));
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  const generalError = save.error && !(save.error instanceof ApiError && save.error.code === 'validation_failed' && Object.keys(save.error.fields).length);

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={user ? t('users.edit') : t('users.create')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="user-form" loading={save.isPending} disabled={!form.roleIds.length}>
            {user ? t('common.save') : t('users.create')}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={onSubmit} className="space-y-5">
        {generalError && <Alert tone="red">{errMsg(save.error)}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fieldErr('name')} required />
          <Input type="email" label={t('auth.email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={fieldErr('email')} required />
          <Input type="tel" label={t('common.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={fieldErr('phone')} />
          <Select label={t('users.app_language')} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeName} — {l.name}
              </option>
            ))}
          </Select>
          {!user && (
            <Input
              type="password"
              autoComplete="new-password"
              label={t('users.initial_password')}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              hint={t('auth.password_hint', { min: 8 })}
              error={fieldErr('password')}
              minLength={8}
              required
            />
          )}
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{t('users.roles')}</legend>
          {fieldErr('roleIds') && <p className="mb-2 text-sm text-rose-600">{fieldErr('roleIds')}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {roles.data?.items.map((r) => (
              <div key={r.id} className="rounded-xl p-3 ring-1 ring-slate-200 dark:ring-slate-700">
                <Checkbox
                  checked={form.roleIds.includes(r.id)}
                  onChange={(v) => toggle('roleIds', r.id, v)}
                  label={roleLabel(t, r)}
                  description={t('roles.permission_count', { count: r.permissions.length })}
                />
              </div>
            ))}
          </div>
        </fieldset>

        {hasAddon('multi_outlet') && session.outlets.length > 1 && (
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">{t('users.outlets')}</legend>
            <p className="mb-2 text-xs text-slate-500">{t('users.outlets_hint')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {session.outlets.map((o) => (
                <Checkbox key={o.id} checked={form.outletIds.includes(o.id)} onChange={(v) => toggle('outletIds', o.id, v)} label={<span dir="auto">{o.name}</span>} />
              ))}
            </div>
          </fieldset>
        )}

        {!user && <Switch checked={form.mustChangePassword} onChange={(v) => setForm({ ...form, mustChangePassword: v })} label={t('users.must_change_password')} description={t('users.must_change_password_hint')} />}
        {user && !user.isOwner && <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={t('users.account_active')} description={t('users.account_active_hint')} />}
      </form>
    </Dialog>
  );
}

function SetPasswordDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [mustChange, setMustChange] = useState(true);
  const errMsg = useErrorMessage();
  const m = useMutation({
    mutationFn: () => api.post(`/users/${user.id}/password`, { password, mustChangePassword: mustChange }),
    onSuccess: () => {
      toast.success(t('users.password_set'));
      onClose();
    },
  });
  const fieldErr = useFieldErrors(m.error);
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t('users.set_password')}
      description={<span dir="auto">{user.name}</span>}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => m.mutate()} loading={m.isPending} disabled={password.length < 8}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {m.error && !(m.error instanceof ApiError && m.error.code === 'validation_failed') && <Alert tone="red">{errMsg(m.error)}</Alert>}
        <Input type="password" autoComplete="new-password" label={t('auth.new_password')} value={password} onChange={(e) => setPassword(e.target.value)} hint={t('auth.password_hint', { min: 8 })} error={fieldErr('password')} />
        <Switch checked={mustChange} onChange={setMustChange} label={t('users.must_change_password')} />
        <p className="text-xs text-slate-500">{t('users.set_password_note')}</p>
      </div>
    </Dialog>
  );
}
