import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Banknote,
  Briefcase,
  Building2,
  Coffee,
  CreditCard,
  FileText,
  FolderKanban,
  Gauge,
  Headset,
  History,
  Languages,
  Layers,
  LayoutGrid,
  ListTodo,
  LogOut,
  Mail,
  Package,
  PiggyBank,
  Puzzle,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  TrendingUp,
  UserCog,
  UserPlus,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { LANGUAGES } from '@oceanx/shared';
import { setSuperAdminLanguage, useSuperAdmin } from '../auth/superadmin';
import { Shell, type NavGroup, type NavItem } from './Shell';
import { useVentures } from '../pages/superadmin/hubVentures';
import { Dropdown, DropdownItem } from '../components/Dropdown';
import { SkeletonRows } from '../components/ui/Card';
import { LanguageMenu } from './BusinessLayout';
import { useNavyPalette } from '../lib/product';
import { FullscreenButton } from '../components/FullscreenButton';

const POS_CONSOLE: NavItem[] = [
  { to: '/superadmin/dashboard', label: 'superadmin.nav.dashboard', icon: Gauge },
  { to: '/superadmin/businesses', label: 'superadmin.nav.businesses', icon: Building2 },
  { to: '/superadmin/restaurants', label: 'superadmin.nav.restaurants', icon: UtensilsCrossed },
  { to: '/superadmin/cafes', label: 'superadmin.nav.cafes', icon: Coffee },
  { to: '/superadmin/retail', label: 'superadmin.nav.retail', icon: ShoppingBag },
  { to: '/superadmin/subscriptions', label: 'superadmin.nav.subscriptions', icon: CreditCard },
  { to: '/superadmin/payments', label: 'superadmin.nav.payments', icon: Banknote },
  { to: '/superadmin/plans', label: 'superadmin.nav.plans', icon: Layers },
  { to: '/superadmin/addons', label: 'superadmin.nav.addons', icon: Puzzle },
];
const GRAVITY_CONSOLE: NavItem[] = [
  { to: '/superadmin/gravity/accounts', label: 'gravity.accounts', icon: Building2 },
  { to: '/superadmin/gravity/signups', label: 'gravity.nav_signups', icon: UserPlus },
  { to: '/superadmin/gravity/payments', label: 'superadmin.nav.payments', icon: Banknote },
  { to: '/superadmin/gravity/plans', label: 'gravity.nav_plan', icon: Layers },
];
const FLOW_CONSOLE: NavItem[] = [
  { to: '/superadmin/flow/accounts', label: 'flow.accounts', icon: Building2 },
  { to: '/superadmin/flow/payments', label: 'superadmin.nav.payments', icon: Banknote },
  { to: '/superadmin/flow/plans', label: 'gravity.nav_plan', icon: Layers },
];
const BUDGET_CONSOLE: NavItem[] = [
  { to: '/superadmin/budget/accounts', label: 'budget.accounts', icon: Building2 },
  { to: '/superadmin/budget/payments', label: 'superadmin.nav.payments', icon: Banknote },
  { to: '/superadmin/budget/plans', label: 'gravity.nav_plan', icon: Layers },
];
const COMPANY: NavGroup = {
  label: 'hub.nav.group_company',
  items: [
    { to: '/superadmin/mail', label: 'superadmin.mail.nav', icon: Mail },
    { to: '/superadmin/users', label: 'hub.nav.team', icon: UserCog },
    { to: '/superadmin/languages', label: 'superadmin.nav.languages', icon: Languages },
    { to: '/superadmin/settings', label: 'superadmin.nav.settings', icon: Settings },
    { to: '/superadmin/activity-logs', label: 'superadmin.nav.activity', icon: History },
    { to: '/superadmin/security', label: 'superadmin.nav.security', icon: ShieldCheck },
  ],
};
/** Sales and work pages, either for the main office (/superadmin/hub) or one project (/superadmin/p/:id). */
const workGroups = (base: string): NavGroup[] => [
  {
    label: 'hub.nav.group_sales',
    items: [
      { to: `${base}/leads`, label: 'hub.nav.leads', icon: UserPlus },
      { to: `${base}/clients`, label: 'hub.nav.clients', icon: Users },
      { to: `${base}/quotes`, label: 'hub.nav.quotes', icon: FileText },
      { to: `${base}/invoices`, label: 'hub.nav.invoices', icon: Receipt },
      { to: `${base}/services`, label: 'hub.nav.services', icon: Package },
    ],
  },
  {
    label: 'hub.nav.group_work',
    items: [
      { to: `${base}/jobs`, label: 'hub.nav.projects', icon: Briefcase },
      { to: `${base}/tasks`, label: 'hub.nav.tasks', icon: ListTodo },
      { to: `${base}/tickets`, label: 'hub.nav.tickets', icon: Headset },
    ],
  },
];

/**
 * Main office menu: overview, every project, all sales and work, company.
 * Inside a project (or the POS console pages): that project's own menu, with a way back.
 */
function useNav(): { groups: NavGroup[]; sub: string | null } {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  // Menu keys are translated; project names are shown as typed.
  const tr = (groups: NavGroup[]) => groups.map((g) => ({ label: g.label ? t(g.label) : undefined, items: g.items.map((i) => ({ ...i, label: t(i.label) })) }));
  const ventures = useVentures();
  const m = /^\/superadmin\/p\/([^/]+)/.exec(pathname);
  // The POS and Gravity console pages belong to their built-in project.
  const consoleKind = POS_CONSOLE.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`)) ? 'pos' : pathname.startsWith('/superadmin/gravity/') ? 'gravity' : pathname.startsWith('/superadmin/flow/') ? 'flow' : pathname.startsWith('/superadmin/budget/') ? 'budget' : null;
  const current = m ? ventures.find((v) => v.id === m[1]) : consoleKind ? ventures.find((v) => v.kind === consoleKind) : undefined;
  const currentId = m?.[1] ?? current?.id;
  if (currentId) {
    const base = `/superadmin/p/${currentId}`;
    const kind = current?.kind ?? consoleKind;
    return {
      sub: current?.name ?? null,
      groups: tr([
        {
          items: [
            { to: '/superadmin/hub', label: 'hub.nav.back_main_office', icon: LayoutGrid, end: true },
            { to: base, label: 'hub.nav.project_home', icon: FolderKanban, end: true },
          ],
        },
        ...(kind === 'pos' ? [{ label: 'hub.nav.group_pos_console', items: POS_CONSOLE }] : []),
        ...(kind === 'gravity' ? [{ label: 'gravity.console', items: GRAVITY_CONSOLE }] : []),
        ...(kind === 'flow' ? [{ label: 'flow.console', items: FLOW_CONSOLE }] : []),
        ...(kind === 'budget' ? [{ label: 'budget.console', items: BUDGET_CONSOLE }] : []),
        ...workGroups(base),
        COMPANY,
      ]),
    };
  }
  return {
    sub: null,
    groups: [
      ...tr([
        {
          items: [
            { to: '/superadmin/hub', label: 'hub.nav.overview', icon: LayoutGrid, end: true },
            { to: '/superadmin/waiting-payments', label: 'superadmin.payments.inbox_nav', icon: Banknote },
          ],
        },
      ]),
      {
        label: t('hub.nav.group_projects'),
        collapseAfter: 5,
        items: ventures
          .filter((v) => v.isActive)
          .map((v) => ({ to: `/superadmin/p/${v.id}`, label: v.name, icon: v.kind === 'pos' ? Store : v.kind === 'gravity' ? FileText : v.kind === 'flow' ? TrendingUp : v.kind === 'budget' ? PiggyBank : FolderKanban })),
      },
      ...tr([...workGroups('/superadmin/hub'), COMPANY]),
    ],
  };
}

export function RequireSuperAdmin({ bare }: { bare?: boolean }) {
  const { session, isLoading } = useSuperAdmin();
  const location = useLocation();
  if (isLoading) return <SkeletonRows rows={6} />;
  if (!session || session.mfaPending) return <Navigate to="/superadmin/login" replace />;
  // The OceanX Admin phone app is for payments only: its one screen.
  if (session.phoneApp && !location.pathname.startsWith('/superadmin/phone')) return <Navigate to="/superadmin/phone" replace />;
  return bare ? <Outlet /> : <SuperAdminLayout />;
}

function SuperAdminLayout() {
  const { t, i18n } = useTranslation();
  const { session, logout } = useSuperAdmin();
  const navigate = useNavigate();
  const nav = useNav();
  useNavyPalette(true);
  return (
    <Shell
      tone="deep"
      brand={t('app.name')}
      brandSub={nav.sub ?? t('hub.nav.overview')}
      groups={nav.groups}
      topbar={
        <>
          <FullscreenButton />
          <LanguageMenu current={i18n.language} languages={LANGUAGES.map((l) => ({ code: l.code, nativeName: l.nativeName }))} onChange={setSuperAdminLanguage} />
          <Dropdown
            trigger={() => (
              <button type="button" className="flex items-center gap-2 rounded-xl py-1.5 ps-1.5 pe-2.5 hover:bg-slate-100 dark:hover:bg-slate-800">
                <span className="flex size-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
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
