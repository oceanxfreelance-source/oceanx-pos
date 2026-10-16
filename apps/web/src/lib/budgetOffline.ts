import { useEffect, useSyncExternalStore } from 'react';
import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '../i18n';
import { api, ApiError } from './api';
import { HOST_PRODUCT } from './product';

/**
 * Gravity Budget works offline (only on its own address and in its phone app):
 *  - the app itself is kept by a service worker (public/budget-sw.js), so it opens without internet;
 *  - the last data (session, overview, records, goals, plan) is kept on the phone and shown offline;
 *  - spending and income added offline wait on the phone and are sent when the phone is online again,
 *    each with the id the phone gave it, so sending one twice can never make two records;
 *  - the trial still ends offline: the session kept on the phone knows when it ends (see business.tsx).
 * Signing out removes everything kept on the phone.
 */
export const BUDGET_OFFLINE = typeof window !== 'undefined' && HOST_PRODUCT === 'budget';

const CACHE_KEY = 'ox.budget.cache.v1';
const OUTBOX_KEY = 'ox.budget.outbox.v1';
const MAX_CACHE_CHARS = 1_500_000;

// ---------------------------------------------------------------- the service worker
export function registerBudgetServiceWorker() {
  if (!BUDGET_OFFLINE || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/budget-sw.js').catch(() => {
      /* not supported here: the app simply needs internet */
    });
  });
}

// ---------------------------------------------------------------- data kept on the phone
const keep = (key: readonly unknown[]) => key[0] === 'biz' && (key[1] === 'session' || key[1] === 'budget');

/** Put the data kept on the phone back into the app (before the first screen), then keep it up to date. */
export function persistBudgetQueries(qc: QueryClient) {
  if (!BUDGET_OFFLINE) return;
  // Start knowing whether the phone is online (otherwise the app first tries the internet and fails).
  onlineManager.setOnline(navigator.onLine);
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      // Marked as old, so the app fetches fresh data at once whenever it is online.
      for (const it of JSON.parse(raw) as { k: unknown[]; d: unknown; t: number }[]) qc.setQueryData(it.k, it.d, { updatedAt: 1 });
    }
  } catch {
    /* nothing kept, or storage blocked */
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    let items = qc
      .getQueryCache()
      .getAll()
      .filter((q) => q.state.data !== undefined && keep(q.queryKey)) // also after a failed (offline) refresh: the last good data stays
      .map((q) => ({ k: q.queryKey, d: q.state.data, t: q.state.dataUpdatedAt }));
    let text = JSON.stringify(items);
    // Too much: keep the screens, drop searches and long lists.
    if (text.length > MAX_CACHE_CHARS) {
      items = items.filter((i) => !(i.k[2] === 'entries' && i.k[3] !== 'recent'));
      text = JSON.stringify(items);
    }
    try {
      localStorage.setItem(CACHE_KEY, text);
    } catch {
      /* storage full: the app still works online */
    }
  };
  qc.getQueryCache().subscribe((ev) => {
    if (ev.type !== 'updated' && ev.type !== 'removed') return;
    clearTimeout(timer);
    timer = setTimeout(save, 800);
  });
}

/** Signing out: nothing of this person stays on the phone. */
export function clearBudgetOffline() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(OUTBOX_KEY);
  } catch {
    /* storage blocked */
  }
  emit();
}

// ---------------------------------------------------------------- records waiting to be sent
export interface PendingEntry {
  id: string;
  kind: 'income' | 'expense';
  amount: string;
  occurredOn: string;
  categoryId: string | null;
  note: string;
  paidWith: string;
  /** Shown while waiting (the category as it was when written). */
  category: { name: string; key: string | null; emoji: string } | null;
  createdAt: number;
}

const listeners = new Set<() => void>();
let snapshot: PendingEntry[] | null = null;
function read(): PendingEntry[] {
  if (snapshot) return snapshot;
  try {
    snapshot = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]') as PendingEntry[];
  } catch {
    snapshot = [];
  }
  return snapshot;
}
function write(items: PendingEntry[]) {
  snapshot = items;
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch {
    /* storage blocked: kept in memory until sent */
  }
  emit();
}
function emit() {
  snapshot = null;
  for (const l of listeners) l();
}

/** The records waiting on this phone (re-renders when they change). */
export function usePendingEntries(): PendingEntry[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => [],
  );
}

/** Keep a record on the phone; it is sent as soon as the phone is online. */
export function addPendingEntry(e: Omit<PendingEntry, 'id' | 'createdAt'>, qc: QueryClient) {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : fallbackUuid();
  write([...read(), { ...e, id, createdAt: Date.now() }]);
  void syncPendingEntries(qc);
}

let syncing = false;
/** Send what waits, oldest first. Stops at the first network problem or when the trial has ended (402). */
export async function syncPendingEntries(qc: QueryClient) {
  if (!BUDGET_OFFLINE || syncing || !navigator.onLine) return;
  syncing = true;
  let sent = 0;
  try {
    for (const p of [...read()]) {
      try {
        await api.post('/budget/entries', { id: p.id, kind: p.kind, amount: p.amount, occurredOn: p.occurredOn, categoryId: p.categoryId, note: p.note, paidWith: p.paidWith });
        write(read().filter((x) => x.id !== p.id));
        sent++;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 422 || err.status === 409)) {
          // It can never be accepted (e.g. its category was removed meanwhile): say so and let it go.
          write(read().filter((x) => x.id !== p.id));
          toast.error(i18n.t('budget.offline.dropped', { amount: p.amount }));
          continue;
        }
        break; // offline again, signed out, or the trial has ended: try later
      }
    }
  } finally {
    syncing = false;
  }
  if (sent) {
    toast.success(i18n.t('budget.offline.synced', { count: sent }));
    void qc.invalidateQueries({ queryKey: ['biz', 'budget'] });
  }
}

/** Send waiting records when the phone comes online, when the app is opened again, and every 30 seconds. */
export function useBudgetSync(qc: QueryClient, active: boolean) {
  useEffect(() => {
    if (!BUDGET_OFFLINE || !active) return;
    const run = () => void syncPendingEntries(qc);
    run();
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', run);
    const id = setInterval(run, 30_000);
    return () => {
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', run);
      clearInterval(id);
    };
  }, [qc, active]);
}

/** Is the phone online right now? */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener('online', l);
      window.addEventListener('offline', l);
      return () => {
        window.removeEventListener('online', l);
        window.removeEventListener('offline', l);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

function fallbackUuid() {
  const b = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
