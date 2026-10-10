import { useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { android } from '../lib/desktop';
import { TabletPosOnly } from '../components/ScreenExit';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import {
  Banknote,
  BarChart3,
  Boxes,
  CalendarClock,
  CalendarDays,
  Check,
  ChefHat,
  ChevronDown,
  Contact,
  FileSpreadsheet,
  FileText,
  HandCoins,
  Globe,
  History,
  Languages,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Mic2,
  MonitorSmartphone,
  PackagePlus,
  Puzzle,
  QrCode,
  Receipt,
  ShoppingCart,
  Settings,
  ShieldCheck,
  Store,
  UserCircle,
  Users,
  UtensilsCrossed,
  Wallet,
  CreditCard,
  Package,
  ScanBarcode,
} from 'lucide-react';
import { SETTINGS_SECTION_PERMISSIONS } from '@oceanx/shared';
import { lastProduct, useBiz, useBizSession, type BusinessSession } from '../auth/business';
import { GRAVITY_HOST } from '../lib/product';
import { api } from '../lib/api';
import { useToastError } from '../lib/useApiError';
import { Shell, type NavGroup } from './Shell';
import { Dropdown, DropdownItem } from '../components/Dropdown';
import { NotificationBell } from '../components/NotificationBell';
import { AppLoader } from '../components/AppLoader';
import { ThemeToggle } from '../components/ThemeToggle';
import { FullscreenButton } from '../components/FullscreenButton';
import { applyPreferences, type ThemeChoice } from '../lib/theme';
import { SkeletonRows } from '../components/ui/Card';
import { StatusScreen, ForcePasswordChange } from '../pages/business/StatusScreens';
import { BillingBanner } from '../pages/business/Billing';

const SETTINGS_VIEW_PERMS = [...new Set(Object.values(SETTINGS_SECTION_PERMISSIONS).flatMap((p) => [p.view, p.manage]))];

/**
 * Navigation = business type + subscription modules + granted add-ons + permissions.
 * Only implemented modules appear; the server enforces the same rules on every request.
 */
export function useBusinessNav(): NavGroup[] {
  const { can, canAny, hasModule, hasAddon } = useBiz();
  const session = useBizSession();
  const operations: NavGroup['items'] = [];
  if (can('dashboard.view')) operations.push({ to: '/', label: 'nav.dashboard', icon: LayoutDashboard, end: true });
  if (hasModule('pos') && can('pos.access')) operations.push({ to: '/pos', label: 'nav.pos', icon: MonitorSmartphone });
  // Shops: "do we have it?" stock lookup right after the POS.
  if (session.business.profile.retail && canAny('pos.access', 'inventory.view', 'products.view')) operations.push({ to: '/stock-check', label: 'nav.stock_check', icon: ScanBarcode });
  if (hasModule('sales') && canAny('sales.view', 'payments.view')) operations.push({ to: '/sales', label: 'nav.sales', icon: Receipt });
  if (hasModule('kitchen') && can('kitchen.view')) operations.push({ to: '/kitchen', label: 'nav.kitchen', icon: ChefHat });
  if (hasModule('tables') && can('tables.view')) operations.push({ to: '/tables', label: 'nav.tables', icon: LayoutGrid });
  if (hasAddon('online_ordering') && can('online_orders.manage')) operations.push({ to: '/online-orders', label: 'nav.online_orders', icon: Globe });
  if (hasAddon('reservations') && can('reservations.view')) operations.push({ to: '/reservations', label: 'nav.reservations', icon: CalendarClock });
  if (hasAddon('karaoke') && can('karaoke.view')) operations.push({ to: '/karaoke', label: 'nav.karaoke', icon: Mic2 });

  const catalog: NavGroup['items'] = [];
  if (hasModule('products') && canAny('products.view', 'categories.view')) catalog.push({ to: '/products', label: session.business.profile.productsLabelKey, icon: session.business.profile.retail ? Package : UtensilsCrossed });
  if (hasAddon('qr_menu') && can('qr_menu.manage')) catalog.push({ to: '/qr-menu', label: 'nav.qr_menu', icon: QrCode });
  if (hasModule('inventory') && can('inventory.view')) catalog.push({ to: '/inventory', label: 'nav.inventory', icon: Boxes });
  if ((hasModule('purchases') && can('purchases.view')) || (hasModule('suppliers') && can('suppliers.view'))) catalog.push({ to: '/purchases', label: 'nav.purchases', icon: PackagePlus });

  const sales: NavGroup['items'] = [];
  if (hasModule('customers') && can('customers.view')) sales.push({ to: '/customers', label: 'nav.customers', icon: Contact });
  if (hasAddon('credit') && can('credit.view')) sales.push({ to: '/credit', label: 'nav.credit', icon: HandCoins });
  if (hasModule('quotations') && can('quotations.view')) sales.push({ to: '/quotations', label: 'nav.quotations', icon: FileText });
  if (hasModule('invoices') && can('invoices.view')) sales.push({ to: '/invoices', label: 'nav.invoices', icon: FileSpreadsheet });

  const finance: NavGroup['items'] = [];
  if (hasModule('expenses') && can('expenses.view')) finance.push({ to: '/expenses', label: 'nav.expenses', icon: Wallet });
  if (hasModule('reports') && can('reports.view')) finance.push({ to: '/reports', label: 'nav.reports', icon: BarChart3 });

  const staff: NavGroup['items'] = [];
  if (hasAddon('payroll') && can('payroll.view')) staff.push({ to: '/payroll', label: 'nav.payroll', icon: Banknote });
  if (hasAddon('staff_rota') && can('rota.view')) staff.push({ to: '/rota', label: 'nav.rota', icon: CalendarDays });

  const management: NavGroup['items'] = [];
  if (can('users.view')) management.push({ to: '/users', label: 'nav.users', icon: Users });
  if (can('roles.view')) management.push({ to: '/roles', label: 'nav.roles', icon: ShieldCheck });
  if (can('outlets.view') && session.business.product !== 'gravity') management.push({ to: '/outlets', label: 'nav.outlets', icon: Store });
  if (can('addons.view')) management.push({ to: '/addons', label: 'nav.addons', icon: Puzzle });
  if (can('audit.view')) management.push({ to: '/activity', label: 'nav.activity', icon: History });
  if (session.user.isOwner || can('settings.manage')) management.push({ to: '/billing', label: 'nav.billing', icon: CreditCard });
  if (canAny(...SETTINGS_VIEW_PERMS)) management.push({ to: '/settings', label: 'nav.settings', icon: Settings });
  return [
    { items: operations },
    { label: session.business.profile.retail ? 'nav.group_catalog_retail' : 'nav.group_catalog', items: catalog },
    { label: 'nav.group_customers', items: sales },
    { label: 'nav.group_finance', items: finance },
    { label: 'nav.group_staff', items: staff },
    { label: 'nav.group_management', items: management },
  ].filter((g) => g.items.length > 0);
}

/** Shortcuts to the most common tasks (dashboard tiles + ⌘K). Gated exactly like the screens they open. */
export function useQuickActions(): NavGroup['items'] {
  const { can, hasModule } = useBiz();
  const items: NavGroup['items'] = [];
  if (hasModule('pos') && can('pos.access')) items.push({ to: '/pos', label: 'pos.new_sale', icon: ShoppingCart });
  if (hasModule('invoices') && can('invoices.create')) items.push({ to: '/invoices/new', label: 'invoices.create', icon: FileSpreadsheet });
  if (hasModule('quotations') && can('quotations.create')) items.push({ to: '/quotations/new', label: 'quotations.create', icon: FileText });
  if (hasModule('products') && can('products.create')) items.push({ to: '/products?new=1', label: 'products.create', icon: UtensilsCrossed });
  if (hasModule('customers') && can('customers.create')) items.push({ to: '/customers?new=1', label: 'customers.create', icon: Contact });
  if (hasModule('expenses') && can('expenses.create')) items.push({ to: '/expenses?new=1', label: 'expenses.create', icon: Wallet });
  return items;
}

/** Auth gate for business pages. `bare` renders full-screen pages (POS, kitchen display, print) without the app shell. */
/** Switch light/dark/system: applied instantly on this device and saved to the user's profile. */
export function useThemeSwitch() {
  const { session, refresh } = useBiz();
  const toastErr = useToastError();
  const m = useMutation({ mutationFn: (theme: ThemeChoice) => api.patch('/me/preferences', { theme }), onSuccess: () => refresh(), onError: toastErr });
  const value = (session?.user.preferences.theme as ThemeChoice | undefined) ?? 'system';
  return {
    value,
    set: (theme: ThemeChoice) => {
      applyPreferences({ ...session?.user.preferences, theme });
      m.mutate(theme);
    },
  };
}

export function RequireBusinessAuth({ bare = false }: { bare?: boolean }) {
  const { session, isLoading } = useBiz();
  const location = useLocation();
  if (isLoading) return <AppLoader />;
  if (!session) return <Navigate to={`${lastProduct() === 'gravity' && !GRAVITY_HOST ? '/gravity/login' : '/login'}${location.pathname !== '/' ? `?next=${encodeURIComponent(location.pathname + location.search)}` : ''}`} replace />;
  if (session.state !== 'ok') return <StatusScreen />;
  if (session.user.mustChangePassword) return <ForcePasswordChange />;
  // The tablet app is the POS only: the back office stays on computers and phones.
  if (android && !bare) return <Navigate to="/start" replace />;
  return bare ? <Outlet /> : <BusinessLayout />;
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
  const quick = useQuickActions();
  const theme = useThemeSwitch();
  const allItems = groups.flatMap((g) => g.items);
  const pos = allItems.find((i) => i.to === '/pos');
  // Phone tab bar: the four most-used destinations this user can open.
  // Gravity (mostly used on phones): home, quotations, invoices, customers.
  const bottomNav = (session.business.product === 'gravity' ? ['/', '/quotations', '/invoices', '/customers'] : ['/', '/pos', '/sales', '/products', '/kitchen', '/customers', '/reports'])
    .map((to) => allItems.find((i) => i.to === to))
    .filter((i): i is NonNullable<typeof i> => !!i)
    .map((i) => (i.to === '/products' ? { ...i, label: 'nav.menu' } : i))
    .slice(0, 4);
  const toastErr = useToastError();
  const setLang = useMutation({ mutationFn: (language: string) => api.patch('/me/preferences', { language }), onSuccess: () => refresh(), onError: toastErr });

  return (
    <Shell
      brand={<span dir="auto">{session.business.name}</span>}
      brandMark={<BusinessMark key={session.business.logoVersion ?? 'none'} name={session.business.name} logoVersion={session.business.hasLogo ? (session.business.logoVersion ?? '1') : null} />}
      brandSub={session.business.product === 'gravity' ? t('gravity.name') : t(`business_types.${session.business.businessType}`)}
      // POS is reached through the prominent "Open POS" button, so it is not repeated in the list.
      groups={groups.map((g) => ({ ...g, label: g.label ? t(g.label) : undefined, items: pos ? g.items.filter((i) => i.to !== '/pos') : g.items }))}
      primaryAction={pos ? { to: '/pos', label: 'nav.open_pos', icon: MonitorSmartphone } : undefined}
      bottomNav={bottomNav}
      palette={[
        ...(quick.length ? [{ label: 'palette.actions', items: quick }] : []),
        { label: 'palette.pages', items: groups.flatMap((g) => g.items) },
        { label: 'palette.account', items: [{ to: '/account', label: 'nav.account', icon: UserCircle }] },
      ]}
      topbar={
        <>
          <div className="me-auto">
            <OutletSwitcher session={session} />
          </div>
          <NotificationBell />
          <FullscreenButton />
          <ThemeToggle value={theme.value} onChange={theme.set} />
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
      <BillingBanner />
      <Outlet />
    </Shell>
  );
}

/** The business's own logo beside its name; until one is uploaded, the first letter of the name. */
function BusinessMark({ name, logoVersion }: { name: string; logoVersion: string | null }) {
  const [failed, setFailed] = useState(false);
  if (logoVersion && !failed) {
    return (
      <img
        src={`/api/settings/logo?v=${encodeURIComponent(logoVersion)}`}
        alt=""
        onError={() => setFailed(true)}
        className="size-9 shrink-0 rounded-lg bg-white object-contain p-0.5 ring-1 ring-slate-200 dark:ring-slate-700"
      />
    );
  }
  const letter = [...name.trim()][0]?.toUpperCase() ?? '?';
  return (
    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-base font-semibold text-white" dir="auto">
      {letter}
    </span>
  );
}

/**
 * Where the tablet app and the installed app open: the POS for anyone who sells, the kitchen display
 * for the kitchen, otherwise the dashboard.
 */
export function StartScreen() {
  const { can, hasModule } = useBiz();
  if (hasModule('pos') && can('pos.access')) return <Navigate to="/pos" replace />;
  if (hasModule('kitchen') && can('kitchen.view')) return <Navigate to="/kitchen" replace />;
  if (android) return <TabletPosOnly />;
  return <Navigate to="/" replace />;
}

