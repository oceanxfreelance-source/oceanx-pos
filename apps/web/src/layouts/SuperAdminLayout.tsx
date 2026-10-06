import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Coffee, CreditCard, Gauge, History, Languages, Layers, LogOut, Puzzle, Settings, ShieldCheck, UserCog, UtensilsCrossed } from 'lucide-react';
import { LANGUAGES } from '@oceanx/shared';
import { setSuperAdminLanguage, useSuperAdmin } from '../auth/superadmin';
import { Shell, type NavGroup } from './Shell';
import { Dropdown, DropdownItem } from '../components/Dropdown';
import { SkeletonRows } from '../components/ui/Card';
import { LanguageMenu } from './BusinessLayout';
import { DeviceThemeToggle } from '../components/DeviceThemeToggle';

const GROUPS: NavGroup[] = [
  { items: [{ to: '/superadmin/dashboard', label: 'superadmin.nav.dashboard', icon: Gauge }] },
  {
    label: 'superadmin.nav.group_tenants',
    items: [
      { to: '/superadmin/businesses', label: 'superadmin.nav.businesses', icon: Building2 },
      { to: '/superadmin/restaurants', label: 'superadmin.nav.restaurants', icon: UtensilsCrossed },
      { to: '/superadmin/cafes', label: 'superadmin.nav.cafes', icon: Coffee },
      { to: '/superadmin/subscriptions', label: 'superadmin.nav.subscriptions', icon: CreditCard },
    ],
  },
  {
    label: 'superadmin.nav.group_catalog',
    items: [
      { to: '/superadmin/plans', label: 'superadmin.nav.plans', icon: Layers },
      { to: '/superadmin/addons', label: 'superadmin.nav.addons', icon: Puzzle },
    ],
  },
  {
    label: 'superadmin.nav.group_platform',
    items: [
      { to: '/superadmin/users', label: 'superadmin.nav.users', icon: UserCog },
      { to: '/superadmin/languages', label: 'superadmin.nav.languages', icon: Languages },
      { to: '/superadmin/settings', label: 'superadmin.nav.settings', icon: Settings },
      { to: '/superadmin/activity-logs', label: 'superadmin.nav.activity', icon: History },
      { to: '/superadmin/security', label: 'superadmin.nav.security', icon: ShieldCheck },
    ],
  },
];

export function RequireSuperAdmin() {
  const { session, isLoading } = useSuperAdmin();
  if (isLoading) return <SkeletonRows rows={6} />;
  if (!session || session.mfaPending) return <Navigate to="/superadmin/login" replace />;
  return <SuperAdminLayout />;
}

function SuperAdminLayout() {
  const { t, i18n } = useTranslation();
  const { session, logout } = useSuperAdmin();
  const navigate = useNavigate();
  return (
    <Shell
      brand={t('app.name')}
      brandSub={t('superadmin.console')}
      groups={GROUPS.map((g) => ({ ...g, label: g.label ? t(g.label) : undefined }))}
      topbar={
        <>
          <DeviceThemeToggle />
          <LanguageMenu current={i18n.language} languages={LANGUAGES.map((l) => ({ code: l.code, nativeName: l.nativeName }))} onChange={setSuperAdminLanguage} />
          <Dropdown
            trigger={() => (
              <button type="button" className="flex items-center gap-2 rounded-xl py-1.5 ps-1.5 pe-2.5 hover:bg-slate-100 dark:hover:bg-slate-800">
                <span className="flex size-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white dark:bg-slate-700">
                  {session?.admin.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden text-sm font-medium sm:inline">{session?.admin.name}</span>
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-3 py-2">
                  <p className="truncate text-xs text-slate-500" dir="ltr">
                    {session?.admin.email}
                  </p>
                </div>
                <DropdownItem
                  icon={<ShieldCheck className="size-4" />}
                  onClick={() => {
                    close();
                    navigate('/superadmin/security');
                  }}
                >
                  {t('superadmin.nav.security')}
                </DropdownItem>
                <DropdownItem
                  danger
                  icon={<LogOut className="rtl-flip size-4" />}
                  onClick={async () => {
                    close();
                    await logout();
                    navigate('/superadmin/login');
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
