import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isLanguageCode } from '@oceanx/shared';
import { ApiError, onUnauthorized, saApi, setCsrfToken } from '../lib/api';
import { applyLanguage } from '../i18n';
import { applyPreferences } from '../lib/theme';

export interface SuperAdminSession {
  admin: { id: string; name: string; email: string; totpEnabled: boolean };
  csrfToken: string;
  mfaPending: boolean;
}

export const SA_SESSION_KEY = ['sa', 'session'] as const;
const SA_LANG_KEY = 'ox_sa_lang';

export function superAdminLanguage(): string {
  try {
    const v = localStorage.getItem(SA_LANG_KEY);
    if (v && isLanguageCode(v)) return v;
  } catch {
    /* ignore */
  }
  return 'en';
}

export function setSuperAdminLanguage(code: string) {
  try {
    localStorage.setItem(SA_LANG_KEY, code);
  } catch {
    /* ignore */
  }
  void applyLanguage(code);
}

interface Ctx {
  session: SuperAdminSession | null;
  isLoading: boolean;
  setSession: (s: SuperAdminSession | null) => void;
  logout: () => Promise<void>;
}

const SuperAdminAuthContext = createContext<Ctx | null>(null);

/** Completely separate from the business auth context (own cookie, CSRF token and cache key). */
export function SuperAdminAuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: SA_SESSION_KEY,
    queryFn: async () => {
      try {
        return await saApi.get<SuperAdminSession>('/auth/session');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => onUnauthorized('superadmin', () => qc.setQueryData(SA_SESSION_KEY, null)), [qc]);
  useEffect(() => {
    void applyLanguage(superAdminLanguage());
    applyPreferences({ theme: 'system' });
  }, []);

  const session = query.data ?? null;
  useEffect(() => {
    if (session) setCsrfToken('superadmin', session.csrfToken);
  }, [session]);

  const setSession = useCallback((s: SuperAdminSession | null) => qc.setQueryData(SA_SESSION_KEY, s), [qc]);
  const value = useMemo<Ctx>(
    () => ({
      session,
      isLoading: query.isLoading,
      setSession,
      logout: async () => {
        try {
          await saApi.post('/auth/logout');
        } finally {
          setCsrfToken('superadmin', null);
          qc.removeQueries({ queryKey: ['sa'] });
          qc.setQueryData(SA_SESSION_KEY, null);
        }
      },
    }),
    [session, query.isLoading, setSession, qc],
  );
  return <SuperAdminAuthContext.Provider value={value}>{children}</SuperAdminAuthContext.Provider>;
}

export function useSuperAdmin() {
  const ctx = useContext(SuperAdminAuthContext);
  if (!ctx) throw new Error('useSuperAdmin outside SuperAdminAuthProvider');
  return ctx;
}
