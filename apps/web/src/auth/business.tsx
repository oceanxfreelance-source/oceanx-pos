import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, onUnauthorized, setCsrfToken } from '../lib/api';
import { applyLanguage } from '../i18n';
import { applyPreferences } from '../lib/theme';
import { setRetailRoleNames } from '../lib/labels';

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
    businessType: string;
    status: string;
    currency: string;
    timezone: string;
    hasLogo: boolean;
    hasStamp: boolean;
    onboardingCompleted: boolean;
    profile: { productsLabelKey: string; dashboardWidgets: string[]; tableService: boolean; kitchen: boolean; retail?: boolean };
    suspensionReason: string | null;
  };
  subscription: { planName: string; planCode: string; effectiveStatus: string; currentPeriodEnd: string } | null;
  limits: Record<string, number | null>;
  modules: string[];
  addons: string[];
  permissions: string[];
  outlet: { id: string; name: string } | null;
  outlets: { id: string; name: string; isDefault: boolean }[];
  languages: { code: string; nativeName: string; direction: string; isDefault: boolean }[];
  regional: { currencySymbol: string; currencyDecimals: number; dateFormat: string; timeFormat: string };
  tax: import('@oceanx/shared').BusinessSettings['tax'];
  viberCredit: { available: boolean; active: boolean };
  pos: { defaultOrderType: 'dine_in' | 'takeaway' | 'delivery'; allowNegativeStock: boolean; sendToKitchen: boolean; requireTableForDineIn: boolean; maxDiscountPercent: number };
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

  const session = query.data ?? null;
  // Set during render (not in an effect) so role names are right on the very first paint.
  setRetailRoleNames(!!session?.business.profile.retail);
  useEffect(() => {
    if (!session) return;
    setCsrfToken('business', session.csrfToken);
    void applyLanguage(session.user.language);
    applyPreferences(session.user.preferences);
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
        try {
          await api.post('/auth/logout');
        } finally {
          setCsrfToken('business', null);
          qc.setQueryData(BIZ_SESSION_KEY, null);
          qc.clear();
          // A fresh page load guarantees no screen keeps showing the previous user (shared counter PCs).
          window.location.replace('/login');
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
