import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, onUnauthorized, setCsrfToken } from '../lib/api';
import { android, posTablet, posTabletFor } from '../lib/desktop';
import { HOST_PRODUCT, productPath, type Product } from '../lib/product';
import { applyLanguage } from '../i18n';
import { applyPreferences } from '../lib/theme';
import { setRetailRoleNames } from '../lib/labels';
import { BUDGET_OFFLINE, clearBudgetOffline, syncPendingEntries, useBudgetSync } from '../lib/budgetOffline';

export interface BusinessSession {
  csrfToken: string;
  state: 'ok' | 'business_pending' | 'business_suspended' | 'business_deactivated' | 'subscription_expired' | 'subscription_cancelled';
  user: {
    id: string;
    name: string;
    email: string;
    language: string;
    isOwner: boolean;
    mustChangePassword: boolean;
    preferences: { reduceAnimations?: boolean; theme?: string };
    hasSignature: boolean;
  };
  business: {
    id: string;
    name: string;
    slug: string;
    /** OceanX product: pos | gravity (quotations & invoices) | flow (income, expenses & profit) | budget (personal budget) | fuel (Theyo Fihaara). */
    product: Product;
    businessType: string;
    status: string;
    currency: string;
    timezone: string;
    hasLogo: boolean;
    logoVersion?: string | null;
    hasStamp: boolean;
    onboardingCompleted: boolean;
    profile: { productsLabelKey: string; dashboardWidgets: string[]; tableService: boolean; kitchen: boolean; retail?: boolean };
    suspensionReason: string | null;
  };
  subscription: { planName: string; planCode: string; status?: string; effectiveStatus: string; currentPeriodEnd: string; deleteAt?: string | null } | null;
  limits: Record<string, number | null>;
  modules: string[];
  addons: string[];
  /** Gravity Budget features turned on for this account (early access or for everyone), e.g. 'loans'. */
  features?: string[];
  /** Gravity Budget: dollars kept as their own money too ("Rf and $"). */
  budgetUsdWallet?: boolean;
  permissions: string[];
  outlet: { id: string; name: string } | null;
  outlets: { id: string; name: string; isDefault: boolean }[];
  languages: { code: string; nativeName: string; direction: string; isDefault: boolean }[];
  regional: { currencySymbol: string; currencyDecimals: number; dateFormat: string; timeFormat: string };
  tax: import('@oceanx/shared').BusinessSettings['tax'];
  viberCredit: { available: boolean; active: boolean };
  pos: { defaultOrderType: 'dine_in' | 'takeaway' | 'delivery'; allowNegativeStock: boolean; sendToKitchen: boolean; requireTableForDineIn: boolean; maxDiscountPercent: number; takeawayOnly?: boolean | null };
}

export const BIZ_SESSION_KEY = ['biz', 'session'] as const;

interface Ctx {
  session: BusinessSession | null;
  isLoading: boolean;
  can: (perm: string) => boolean;
  canAny: (...perms: string[]) => boolean;
  hasModule: (m: string) => boolean;
  hasAddon: (a: string) => boolean;
  refresh: () => Promise<unknown>;
  setSession: (s: BusinessSession | null) => void;
  logout: () => Promise<void>;
}

const BusinessAuthContext = createContext<Ctx | null>(null);

export function BusinessAuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: BIZ_SESSION_KEY,
    queryFn: async () => {
      try {
        return await api.get<BusinessSession>('/auth/session');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => onUnauthorized('business', () => qc.setQueryData(BIZ_SESSION_KEY, null)), [qc]);

  // Gravity Budget can run offline on the session kept on the phone: the trial still ends at its time
  // (checked every minute), so an ended trial locks the app even without internet.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!BUDGET_OFFLINE) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const kept = query.data ?? null;
  const session = useMemo(() => {
    if (!BUDGET_OFFLINE || !kept || kept.state !== 'ok' || !kept.subscription) return kept;
    return Date.parse(kept.subscription.currentPeriodEnd) < now ? { ...kept, state: 'subscription_expired' as const } : kept;
  }, [kept, now]);
  useBudgetSync(qc, !!session && session.state === 'ok');
  // Set during render (not in an effect) so role names are right on the very first paint.
  setRetailRoleNames(!!session?.business.profile.retail);
  useEffect(() => {
    if (!session) return;
    setCsrfToken('business', session.csrfToken);
    void applyLanguage(session.user.language);
    applyPreferences(session.user.preferences);
    // The POS app on a phone: upright with the whole system for a takeaway shop, the sideways POS otherwise.
    if (posTablet) android?.phoneTill?.(session.business.businessType === 'takeaway');
    try {
      localStorage.setItem(LAST_PRODUCT_KEY, session.business.product);
    } catch {
      /* storage blocked: sign-out falls back to the POS sign-in */
    }
  }, [session]);

  const setSession = useCallback((s: BusinessSession | null) => qc.setQueryData(BIZ_SESSION_KEY, s), [qc]);

  const value = useMemo<Ctx>(() => {
    const perms = new Set(session?.permissions ?? []);
    return {
      session,
      isLoading: query.isLoading,
      can: (p) => perms.has(p),
      canAny: (...ps) => ps.some((p) => perms.has(p)),
      hasModule: (m) => !!session?.modules.includes(m),
      hasAddon: (a) => !!session?.addons.includes(a),
      refresh: () => qc.invalidateQueries({ queryKey: BIZ_SESSION_KEY }),
      setSession,
      logout: async () => {
        const product = session?.business.product ?? 'pos';
        // Records written offline are sent first (if the phone is online), so nothing is lost by signing out.
        if (BUDGET_OFFLINE) await syncPendingEntries(qc).catch(() => undefined);
        try {
          await api.post('/auth/logout');
        } finally {
          setCsrfToken('business', null);
          qc.setQueryData(BIZ_SESSION_KEY, null);
          qc.clear();
          clearBudgetOffline();
          // A fresh page load guarantees no screen keeps showing the previous user (shared counter PCs).
          // The tablet app signs back in straight to the POS.
          window.location.replace(posTabletFor(session?.business.businessType) ? '/login?next=%2Fstart' : productPath(product, 'login'));
        }
      },
    };
  }, [session, query.isLoading, qc, setSession]);

  return <BusinessAuthContext.Provider value={value}>{children}</BusinessAuthContext.Provider>;
}

export function useBiz() {
  const ctx = useContext(BusinessAuthContext);
  if (!ctx) throw new Error('useBiz outside BusinessAuthProvider');
  return ctx;
}

/** Non-null session for pages rendered inside the authenticated layout. */
export function useBizSession(): BusinessSession {
  const { session } = useBiz();
  if (!session) throw new Error('No business session');
  return session;
}

/** Remembers the last product used on this device, so a signed-out Gravity user lands on the Gravity sign-in. */
export const LAST_PRODUCT_KEY = 'ox.lastProduct';
/** Has anyone signed in on this device before? (A new Gravity Budget user is greeted with sign-up, not sign-in.) */
export function signedInBefore(): boolean {
  try {
    return !!localStorage.getItem(LAST_PRODUCT_KEY);
  } catch {
    return false;
  }
}

export function lastProduct(): Product {
  if (HOST_PRODUCT !== 'pos') return HOST_PRODUCT;
  try {
    const v = localStorage.getItem(LAST_PRODUCT_KEY);
    return v === 'gravity' || v === 'flow' || v === 'budget' || v === 'fuel' ? v : 'pos';
  } catch {
    return 'pos';
  }
}

/** Takeaway only (no dine-in, no tables): the POS setting, or by default a Takeaway shop. */
export function takeawayOnlyOf(session: { business: { businessType: string }; pos: { takeawayOnly?: boolean | null } }) {
  return session.pos.takeawayOnly ?? session.business.businessType === 'takeaway';
}
