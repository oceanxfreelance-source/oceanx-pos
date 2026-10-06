import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Check, ChevronDown, History, Languages, LayoutDashboard, LogOut, Puzzle, Settings, ShieldCheck, Store, UserCircle, Users } from 'lucide-react';
import { SETTINGS_SECTION_PERMISSIONS } from '@oceanx/shared';
import { useBiz, useBizSession, type BusinessSession } from '../auth/business';
import { api } from '../lib/api';
import { useToastError } from '../lib/useApiError';
import { Shell, type NavGroup } from './Shell';
import { Dropdown, DropdownItem } from '../components/Dropdown';
import { SkeletonRows } from '../components/ui/Card';
import { StatusScreen, ForcePasswordChange } from '../pages/business/StatusScreens';

const SETTINGS_VIEW_PERMS = [...new Set(Object.values(SETTINGS_SECTION_PERMISSIONS).flatMap((p) => [p.view, p.manage]))];

/**
 * Navigation = business type + subscription modules + granted add-ons + permissions.
 * Only implemented modules appear; the server enforces the same rules on every request.
 */
export function useBusinessNav(): NavGroup[] {
  const { can, canAny } = useBiz();
  const operations: NavGroup['items'] = [];
  if (can('dashboard.view')) operations.unshift({ to: '/', label: 'nav.dashboard', icon: LayoutDashboard, end: true });
  const management: NavGroup['items'] = [];
  if (can('users.view')) management.push({ to: '/users', label: 'nav.users', icon: Users });
  if (can('roles.view')) management.push({ to: '/roles', label: 'nav.roles', icon: ShieldCheck });
  if (can('outlets.view')) management.push({ to: '/outlets', label: 'nav.outlets', icon: Store });
  if (can('addons.view')) management.push({ to: '/addons', label: 'nav.addons', icon: Puzzle });
  if (can('audit.view')) management.push({ to: '/activity', label: 'nav.activity', icon: History });
  if (canAny(...SETTINGS_VIEW_PERMS)) management.push({ to: '/settings', label: 'nav.settings', icon: Settings });
  return [
    { items: operations },
    { label: 'nav.group_management', items: management },
  ];
}

export function RequireBusinessAuth() {
  const { session, isLoading } = useBiz();
  if (isLoading) return <SkeletonRows rows={6} />;
  if (!session) return <Navigate to="/login" replace />;
  if (session.state !== 'ok') return <StatusScreen />;
  if (session.user.mustChangePassword) return <ForcePasswordChange />;
  return <BusinessLayout />;
}

function OutletSwitcher({ session }: { session: BusinessSession }) {
  const { t } = useTranslation();
  const { refresh } = useBiz();
  const toastErr = useToastError();
  const m = useMutation({ mutationFn: (outletId: string) => api.post('/me/outlet', { outletId }), onSuccess: () => refresh(), onError: toastErr });
  if (session.outlets.length < 2) return null;
  return (
    <Dropdown
      align="start"
      trigger={() => (
        <button type="button" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800">
          <Store className="size-4 text-slate-400" />
          <span className="max-w-36 truncate">{session.outlet?.name ?? t('outlets.select')}</span>
          <ChevronDown className="size-4 text-slate-400" />
        </button>
      )}
    >
      {(close) =>
        session.outlets.map((o) => (
          <DropdownItem
            key={o.id}
            active={o.id === session.outlet?.id}
            onClick={() => {
              close();
              m.mutate(o.id);
            }}
          >
            <span dir="auto">{o.name}</span>
          </DropdownItem>
        ))
      }
    </Dropdown>
  );
}

export function LanguageMenu({ current, languages, onChange }: { current: string; languages: { code: string; nativeName: string }[]; onChange: (code: string) => void }) {
  const { t } = useTranslation();
  return (
    <Dropdown
      trigger={() => (
        <button type="button" aria-label={t('common.language')} className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          <Languages className="size-4" />
          <span className="hidden sm:inline">{languages.find((l) => l.code === current)?.nativeName}</span>
        </button>
      )}
    >
      {(close) =>
        languages.map((l) => (
          <DropdownItem
            key={l.code}
            active={l.code === current}
            icon={l.code === current ? <Check className="size-4" /> : <span className="size-4" />}
            onClick={() => {
              close();
              onChange(l.code);
            }}
          >
            <span lang={l.code}>{l.nativeName}</span>
          </DropdownItem>
        ))
      }
    </Dropdown>
  );
}

function BusinessLayout() {
  const { t } = useTranslation();
  const session = useBizSession();
  const { logout, refresh } = useBiz();
  const navigate = useNavigate();
  const groups = useBusinessNav();
  const toastErr = useToastError();
  const setLang = useMutation({ mutationFn: (language: string) => api.patch('/me/preferences', { language }), onSuccess: () => refresh(), onError: toastErr });

  return (
    <Shell
      brand={<span dir="auto">{session.business.name}</span>}
      brandSub={t(`business_types.${session.business.businessType}`)}
      groups={groups.map((g) => ({ ...g, label: g.label ? t(g.label) : undefined }))}
      topbar={
        <>
          <div className="me-auto">
            <OutletSwitcher session={session} />
          </div>
          <LanguageMenu current={session.user.language} languages={session.languages} onChange={(c) => setLang.mutate(c)} />
          <Dropdown
            trigger={() => (
              <button type="button" className="flex items-center gap-2 rounded-xl py-1.5 ps-1.5 pe-2.5 hover:bg-slate-100 dark:hover:bg-slate-800">
                <span className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-100">
                  {session.user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-32 truncate text-sm font-medium text-slate-700 sm:inline dark:text-slate-200" dir="auto">
                  {session.user.name}
                </span>
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium" dir="auto">
                    {session.user.name}
                  </p>
                  <p className="truncate text-xs text-slate-500" dir="ltr">
                    {session.user.email}
                  </p>
                </div>
                <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                <DropdownItem
                  icon={<UserCircle className="size-4" />}
                  onClick={() => {
                    close();
                    navigate('/account');
                  }}
                >
                  {t('nav.account')}
                </DropdownItem>
                <DropdownItem
                  danger
                  icon={<LogOut className="rtl-flip size-4" />}
                  onClick={async () => {
                    close();
                    await logout();
                    navigate('/login');
                  }}
                >
                  {t('auth.logout')}
                </DropdownItem>
              </>
            )}
          </Dropdown>
        </>
      }
    >
      <Outlet />
    </Shell>
  );
}
