import { lazy, Suspense } from 'react';
import { createBrowserRouter, Link, Outlet, RouterProvider } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BusinessAuthProvider } from './auth/business';
import { SuperAdminAuthProvider } from './auth/superadmin';
import { RequireBusinessAuth } from './layouts/BusinessLayout';
import { RequireSuperAdmin } from './layouts/SuperAdminLayout';
import { SkeletonRows } from './components/ui/Card';
import { Button } from './components/ui/Button';

// Business (tenant) pages
const BusinessLogin = lazy(() => import('./pages/auth/BusinessLogin'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const Dashboard = lazy(() => import('./pages/business/Dashboard'));
const Users = lazy(() => import('./pages/business/Users'));
const Roles = lazy(() => import('./pages/business/Roles'));
const Settings = lazy(() => import('./pages/business/Settings'));
const Outlets = lazy(() => import('./pages/business/Outlets'));
const Addons = lazy(() => import('./pages/business/Addons'));
const Activity = lazy(() => import('./pages/business/Activity'));
const Account = lazy(() => import('./pages/business/Account'));

// Super Admin pages (separate chunk + separate auth context)
const SaLogin = lazy(() => import('./pages/superadmin/Login'));
const SaDashboard = lazy(() => import('./pages/superadmin/Dashboard'));
const SaBusinesses = lazy(() => import('./pages/superadmin/Businesses'));
const SaBusinessDetail = lazy(() => import('./pages/superadmin/BusinessDetail'));
const SaPlans = lazy(() => import('./pages/superadmin/Catalog').then((m) => ({ default: m.PlansPage })));
const SaAddons = lazy(() => import('./pages/superadmin/Catalog').then((m) => ({ default: m.AddonCatalogPage })));
const SaSubscriptions = lazy(() => import('./pages/superadmin/Platform').then((m) => ({ default: m.SubscriptionsPage })));
const SaUsers = lazy(() => import('./pages/superadmin/Platform').then((m) => ({ default: m.PlatformUsersPage })));
const SaLanguages = lazy(() => import('./pages/superadmin/Platform').then((m) => ({ default: m.LanguagesPage })));
const SaSettings = lazy(() => import('./pages/superadmin/Platform').then((m) => ({ default: m.PlatformSettingsPage })));
const SaActivity = lazy(() => import('./pages/superadmin/Platform').then((m) => ({ default: m.SuperAdminActivityPage })));
const SaSecurity = lazy(() => import('./pages/superadmin/Platform').then((m) => ({ default: m.SecurityPage })));

function Loading() {
  return <SkeletonRows rows={6} />;
}

function NotFound({ home }: { home: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-6xl font-bold text-slate-200 dark:text-slate-800">404</p>
      <p className="text-lg font-semibold">{t('errors.not_found')}</p>
      <Link to={home}>
        <Button variant="secondary">{t('common.go_home')}</Button>
      </Link>
    </div>
  );
}

const withSuspense = (el: React.ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>;

const BusinessRoot = () => (
  <BusinessAuthProvider>
    <Suspense fallback={<Loading />}>
      <Outlet />
    </Suspense>
  </BusinessAuthProvider>
);
const SuperAdminRoot = () => (
  <SuperAdminAuthProvider>
    <Suspense fallback={<Loading />}>
      <Outlet />
    </Suspense>
  </SuperAdminAuthProvider>
);

const router = createBrowserRouter([
  {
    // Super Admin domain: /superadmin/* — never linked from the business login page.
    path: '/superadmin',
    element: <SuperAdminRoot />,
    children: [
      { path: 'login', element: <SaLogin /> },
      { path: 'forgot-password', element: <ForgotPassword domain="superadmin" /> },
      { path: 'reset-password', element: <ResetPassword domain="superadmin" /> },
      {
        element: <RequireSuperAdmin />,
        children: [
          { index: true, element: <SaDashboard /> },
          { path: 'dashboard', element: withSuspense(<SaDashboard />) },
          { path: 'businesses', element: withSuspense(<SaBusinesses />) },
          { path: 'businesses/:id', element: withSuspense(<SaBusinessDetail />) },
          { path: 'restaurants', element: withSuspense(<SaBusinesses presetType="restaurant" />) },
          { path: 'cafes', element: withSuspense(<SaBusinesses presetType="cafe" />) },
          { path: 'plans', element: withSuspense(<SaPlans />) },
          { path: 'addons', element: withSuspense(<SaAddons />) },
          { path: 'subscriptions', element: withSuspense(<SaSubscriptions />) },
          { path: 'users', element: withSuspense(<SaUsers />) },
          { path: 'languages', element: withSuspense(<SaLanguages />) },
          { path: 'settings', element: withSuspense(<SaSettings />) },
          { path: 'activity-logs', element: withSuspense(<SaActivity />) },
          { path: 'security', element: withSuspense(<SaSecurity />) },
          { path: '*', element: <NotFound home="/superadmin/dashboard" /> },
        ],
      },
    ],
  },
  {
    path: '/',
    element: <BusinessRoot />,
    children: [
      { path: 'login', element: <BusinessLogin /> },
      { path: 'register', element: <Register /> },
      { path: 'forgot-password', element: <ForgotPassword domain="business" /> },
      { path: 'reset-password', element: <ResetPassword domain="business" /> },
      {
        element: <RequireBusinessAuth />,
        children: [
          { index: true, element: withSuspense(<Dashboard />) },
          { path: 'users', element: withSuspense(<Users />) },
          { path: 'roles', element: withSuspense(<Roles />) },
          { path: 'settings', element: withSuspense(<Settings />) },
          { path: 'outlets', element: withSuspense(<Outlets />) },
          { path: 'addons', element: withSuspense(<Addons />) },
          { path: 'activity', element: withSuspense(<Activity />) },
          { path: 'account', element: withSuspense(<Account />) },
          { path: '*', element: <NotFound home="/" /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
