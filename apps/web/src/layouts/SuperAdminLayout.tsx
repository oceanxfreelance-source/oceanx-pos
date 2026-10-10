import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Banknote, Briefcase, Building2, ShoppingBag, Coffee, CreditCard, FileText, Gauge, Headset, History, LayoutGrid, Languages, Layers, ListTodo, LogOut, Package, Puzzle, Receipt, Settings, ShieldCheck, UserCog, UserPlus, Users, UtensilsCrossed } from 'lucide-react';
import { LANGUAGES } from '@oceanx/shared';
import { setSuperAdminLanguage, useSuperAdmin } from '../auth/superadmin';
import { Shell, type NavGroup } from './Shell';
import { Dropdown, DropdownItem } from '../components/Dropdown';
import { SkeletonRows } from '../components/ui/Card';
import { LanguageMenu } from './BusinessLayout';
import { DeviceThemeToggle } from '../components/DeviceThemeToggle';
import { FullscreenButton } from '../components/FullscreenButton';

const GROUPS: NavGroup[] = [
  { items: [{ to: '/superadmin/hub', label: 'hub.nav.overview', icon: LayoutGrid, end: true }] },
  {
    label: 'hub.nav.group_sales',
    items: [
      { to: '/superadmin/hub/leads', label: 'hub.nav.leads', icon: UserPlus },
      { to: '/superadmin/hub/clients', label: 'hub.nav.clients', icon: Users },
      { to: '/superadmin/hub/quotes', label: 'hub.nav.quotes', icon: FileText },
      { to: '/superadmin/hub/invoices', label: 'hub.nav.invoices', icon: Receipt },
      { to: '/superadmin/hub/services', label: 'hub.nav.services', icon: Package },
    ],
  },
  {
    label: 'hub.nav.group_work',
    items: [
      { to: '/superadmin/hub/projects', label: 'hub.nav.projects', icon: Briefcase },
      { to: '/superadmin/hub/tasks', label: 'hub.nav.tasks', icon: ListTodo },
      { to: '/superadmin/hub/tickets', label: 'hub.nav.tickets', icon: Headset },
    ],
  },
  {
    label: 'hub.nav.group_pos',
    items: [
      { to: '/superadmin/dashboard', label: 'superadmin.nav.dashboard', icon: Gauge },
      { to: '/superadmin/businesses', label: 'superadmin.nav.businesses', icon: Building2 },
      { to: '/superadmin/restaurants', label: 'superadmin.nav.restaurants', icon: UtensilsCrossed },
      { to: '/superadmin/cafes', label: 'superadmin.nav.cafes', icon: Coffee },
      { to: '/superadmin/retail', label: 'superadmin.nav.retail', icon: ShoppingBag },
      { to: '/superadmin/subscriptions', label: 'superadmin.nav.subscriptions', icon: CreditCard },
      { to: '/superadmin/payments', label: 'superadmin.nav.payments', icon: Banknote },
      { to: '/superadmin/plans', label: 'superadmin.nav.plans', icon: Layers },
      { to: '/superadmin/addons', label: 'superadmin.nav.addons', icon: Puzzle },
    ],
  },
  {
    label: 'hub.nav.group_company',
    items: [
      { to: '/superadmin/users', label: 'hub.nav.team', icon: UserCog },
      { to: '/superadmin/languages', label: 'superadmin.nav.languages', icon: Languages },
      { to: '/superadmin/settings', label: 'superadmin.nav.settings', icon: Settings },
      { to: '/superadmin/activity-logs', label: 'superadmin.nav.activity', icon: History },
      { to: '/superadmin/security', label: 'superadmin.nav.security', icon: ShieldCheck },
    ],
  },
];

export function RequireSuperAdmin({ bare }: { bare?: boolean }) {
  const { session, isLoading } = useSuperAdmin();
  if (isLoading) return <SkeletonRows rows={6} />;
  if (!session || session.mfaPending) return <Navigate to="/superadmin/login" replace />;
  return bare ? <Outlet /> : <SuperAdminLayout />;
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
          <FullscreenButton />
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
