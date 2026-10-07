import { lazy, Suspense } from "react";
import { RouteError } from "./components/RouteError";
import {
  createBrowserRouter,
  Link,
  Outlet,
  RouterProvider,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BusinessAuthProvider } from "./auth/business";
import { SuperAdminAuthProvider } from "./auth/superadmin";
import { RequireBusinessAuth } from "./layouts/BusinessLayout";
import { RequireSuperAdmin } from "./layouts/SuperAdminLayout";
import { SkeletonRows } from "./components/ui/Card";
import { Button } from "./components/ui/Button";
import { AppLoader } from "./components/AppLoader";

// Business (tenant) pages
const BusinessLogin = lazy(() => import("./pages/auth/BusinessLogin"));
const Register = lazy(() => import("./pages/auth/Register"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const Dashboard = lazy(() => import("./pages/business/Dashboard"));
const Users = lazy(() => import("./pages/business/Users"));
const Roles = lazy(() => import("./pages/business/Roles"));
const Settings = lazy(() => import("./pages/business/Settings"));
const Outlets = lazy(() => import("./pages/business/Outlets"));
const Addons = lazy(() => import("./pages/business/Addons"));
const Activity = lazy(() => import("./pages/business/Activity"));
const Account = lazy(() => import("./pages/business/Account"));
const Pos = lazy(() => import("./pages/business/Pos"));
const Kitchen = lazy(() => import("./pages/business/Kitchen"));
const Sales = lazy(() => import("./pages/business/Sales"));
const Products = lazy(() => import("./pages/business/Products"));
const Customers = lazy(() => import("./pages/business/Customers"));
const DocList = lazy(() =>
  import("./pages/business/Documents").then((m) => ({
    default: m.DocumentListPage,
  })),
);
const DocEditor = lazy(() =>
  import("./pages/business/Documents").then((m) => ({
    default: m.DocumentEditorPage,
  })),
);
const DocDetail = lazy(() =>
  import("./pages/business/Documents").then((m) => ({
    default: m.DocumentDetailPage,
  })),
);
const Inventory = lazy(() => import("./pages/business/Inventory"));
const Purchasing = lazy(() => import("./pages/business/Purchasing"));
const Expenses = lazy(() => import("./pages/business/Expenses"));
const Tables = lazy(() => import("./pages/business/Tables"));
const Reports = lazy(() => import("./pages/business/Reports"));
const Karaoke = lazy(() =>
  import("./pages/business/AddonPages").then((m) => ({
    default: m.KaraokePage,
  })),
);
const Reservations = lazy(() =>
  import("./pages/business/AddonPages").then((m) => ({
    default: m.ReservationsPage,
  })),
);
const OnlineOrders = lazy(() =>
  import("./pages/business/AddonPages").then((m) => ({
    default: m.OnlineOrdersPage,
  })),
);
const PrintPage = lazy(() => import("./pages/print/PrintPage"));
const StatementPrint = lazy(() => import("./pages/print/StatementPrint"));
const ReportPrint = lazy(() => import("./pages/print/ReportPrint"));
const CreditDuesPrint = lazy(() => import("./pages/print/CreditDuesPrint"));
const Credit = lazy(() => import("./pages/business/Credit"));
const QrMenu = lazy(() => import("./pages/business/QrMenu"));
const QrCardsPrint = lazy(() => import("./pages/print/QrCardsPrint"));
const PublicMenu = lazy(() => import("./pages/public/PublicMenu"));

// Super Admin pages (separate chunk + separate auth context)
const SaLogin = lazy(() => import("./pages/superadmin/Login"));
const SaDashboard = lazy(() => import("./pages/superadmin/Dashboard"));
const SaBusinesses = lazy(() => import("./pages/superadmin/Businesses"));
const SaBusinessDetail = lazy(
  () => import("./pages/superadmin/BusinessDetail"),
);
const SaPlans = lazy(() =>
  import("./pages/superadmin/Catalog").then((m) => ({ default: m.PlansPage })),
);
const SaAddons = lazy(() =>
  import("./pages/superadmin/Catalog").then((m) => ({
    default: m.AddonCatalogPage,
  })),
);
const SaSubscriptions = lazy(() =>
  import("./pages/superadmin/Platform").then((m) => ({
    default: m.SubscriptionsPage,
  })),
);
const SaUsers = lazy(() =>
  import("./pages/superadmin/Platform").then((m) => ({
    default: m.PlatformUsersPage,
  })),
);
const SaLanguages = lazy(() =>
  import("./pages/superadmin/Platform").then((m) => ({
    default: m.LanguagesPage,
  })),
);
const SaSettings = lazy(() =>
  import("./pages/superadmin/Platform").then((m) => ({
    default: m.PlatformSettingsPage,
  })),
);
const SaActivity = lazy(() =>
  import("./pages/superadmin/Platform").then((m) => ({
    default: m.SuperAdminActivityPage,
  })),
);
const SaSecurity = lazy(() =>
  import("./pages/superadmin/Platform").then((m) => ({
    default: m.SecurityPage,
  })),
);

function Loading() {
  return <SkeletonRows rows={6} />;
}

function NotFound({ home }: { home: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-6xl font-bold text-slate-200 dark:text-slate-800">
        404
      </p>
      <p className="text-lg font-semibold">{t("errors.not_found")}</p>
      <Link to={home}>
        <Button variant="secondary">{t("common.go_home")}</Button>
      </Link>
    </div>
  );
}

const withSuspense = (el: React.ReactNode) => (
  <Suspense fallback={<Loading />}>{el}</Suspense>
);

const BusinessRoot = () => (
  <BusinessAuthProvider>
    <Suspense fallback={<AppLoader />}>
      <Outlet />
    </Suspense>
  </BusinessAuthProvider>
);
const SuperAdminRoot = () => (
  <SuperAdminAuthProvider>
    <Suspense fallback={<AppLoader />}>
      <Outlet />
    </Suspense>
  </SuperAdminAuthProvider>
);

const router = createBrowserRouter([
  {
    // Super Admin domain: /superadmin/* — never linked from the business login page.
    path: "/superadmin",
    element: <SuperAdminRoot />,
    errorElement: <RouteError />,
    children: [
      { path: "login", element: <SaLogin /> },
      {
        path: "forgot-password",
        element: <ForgotPassword domain="superadmin" />,
      },
      {
        path: "reset-password",
        element: <ResetPassword domain="superadmin" />,
      },
      {
        element: <RequireSuperAdmin />,
        children: [
          { index: true, element: <SaDashboard /> },
          { path: "dashboard", element: withSuspense(<SaDashboard />) },
          { path: "businesses", element: withSuspense(<SaBusinesses />) },
          {
            path: "businesses/:id",
            element: withSuspense(<SaBusinessDetail />),
          },
          {
            path: "restaurants",
            element: withSuspense(<SaBusinesses presetType="restaurant" />),
          },
          {
            path: "cafes",
            element: withSuspense(<SaBusinesses presetType="cafe" />),
          },
          { path: "plans", element: withSuspense(<SaPlans />) },
          { path: "addons", element: withSuspense(<SaAddons />) },
          { path: "subscriptions", element: withSuspense(<SaSubscriptions />) },
          { path: "users", element: withSuspense(<SaUsers />) },
          { path: "languages", element: withSuspense(<SaLanguages />) },
          { path: "settings", element: withSuspense(<SaSettings />) },
          { path: "activity-logs", element: withSuspense(<SaActivity />) },
          { path: "security", element: withSuspense(<SaSecurity />) },
          { path: "*", element: <NotFound home="/superadmin/dashboard" /> },
        ],
      },
    ],
  },
  {
    // Public QR menu: no authentication, no business session.
    path: "/menu/:slug",
    element: withSuspense(<PublicMenu />),
    errorElement: <RouteError />,
  },
  {
    path: "/",
    element: <BusinessRoot />,
    errorElement: <RouteError />,
    children: [
      { path: "login", element: <BusinessLogin /> },
      { path: "register", element: <Register /> },
      {
        path: "forgot-password",
        element: <ForgotPassword domain="business" />,
      },
      { path: "reset-password", element: <ResetPassword domain="business" /> },
      {
        // Full-screen operational screens (no sidebar shell).
        element: <RequireBusinessAuth bare />,
        children: [
          { path: "pos", element: withSuspense(<Pos />) },
          { path: "kitchen", element: withSuspense(<Kitchen />) },
          {
            path: "print/statement/:id",
            element: withSuspense(<StatementPrint />),
          },
          {
            path: "print/report/:type",
            element: withSuspense(<ReportPrint />),
          },
          {
            path: "print/credit-dues",
            element: withSuspense(<CreditDuesPrint />),
          },
          { path: "print/qr-cards", element: withSuspense(<QrCardsPrint />) },
          { path: "print/:kind/:id", element: withSuspense(<PrintPage />) },
        ],
      },
      {
        element: <RequireBusinessAuth />,
        children: [
          { index: true, element: withSuspense(<Dashboard />) },
          { path: "sales", element: withSuspense(<Sales />) },
          { path: "products", element: withSuspense(<Products />) },
          { path: "customers", element: withSuspense(<Customers />) },
          { path: "credit", element: withSuspense(<Credit />) },
          { path: "qr-menu", element: withSuspense(<QrMenu />) },
          {
            path: "quotations",
            element: withSuspense(<DocList kind="quotation" />),
          },
          {
            path: "quotations/new",
            element: withSuspense(<DocEditor key="qn" kind="quotation" />),
          },
          {
            path: "quotations/:id",
            element: withSuspense(<DocDetail kind="quotation" />),
          },
          {
            path: "quotations/:id/edit",
            element: withSuspense(<DocEditor key="qe" kind="quotation" />),
          },
          {
            path: "invoices",
            element: withSuspense(<DocList kind="invoice" />),
          },
          {
            path: "invoices/new",
            element: withSuspense(<DocEditor key="in" kind="invoice" />),
          },
          {
            path: "invoices/:id",
            element: withSuspense(<DocDetail kind="invoice" />),
          },
          {
            path: "invoices/:id/edit",
            element: withSuspense(<DocEditor key="ie" kind="invoice" />),
          },
          { path: "inventory", element: withSuspense(<Inventory />) },
          { path: "purchases", element: withSuspense(<Purchasing />) },
          {
            path: "suppliers",
            element: withSuspense(<Purchasing initialTab="suppliers" />),
          },
          { path: "expenses", element: withSuspense(<Expenses />) },
          { path: "tables", element: withSuspense(<Tables />) },
          { path: "reports", element: withSuspense(<Reports />) },
          { path: "karaoke", element: withSuspense(<Karaoke />) },
          { path: "reservations", element: withSuspense(<Reservations />) },
          { path: "online-orders", element: withSuspense(<OnlineOrders />) },
          { path: "users", element: withSuspense(<Users />) },
          { path: "roles", element: withSuspense(<Roles />) },
          { path: "settings", element: withSuspense(<Settings />) },
          { path: "outlets", element: withSuspense(<Outlets />) },
          { path: "addons", element: withSuspense(<Addons />) },
          { path: "activity", element: withSuspense(<Activity />) },
          { path: "account", element: withSuspense(<Account />) },
          { path: "*", element: <NotFound home="/" /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
