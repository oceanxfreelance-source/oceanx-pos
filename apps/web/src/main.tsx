import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import './index.css';
import { applyLanguage, readStoredLanguage } from './i18n';
import App from './App';
import { initTheme } from './lib/theme';
import { ApiError } from './lib/api';
import { installStaleChunkReload } from './lib/staleChunk';
import { installTabletFit } from './lib/tabletFit';
import { applyHostBranding, HOST_PRODUCT } from './lib/product';
import { android } from './lib/desktop';
import { persistBudgetQueries, registerBudgetServiceWorker } from './lib/budgetOffline';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

// Gravity Budget works offline: the data kept on the phone is back before the first screen.
persistBudgetQueries(queryClient);
registerBudgetServiceWorker();
if (HOST_PRODUCT === 'budget') {
  // Load the Budget screens once while online, so they are on the phone for offline use.
  window.addEventListener('load', () =>
    setTimeout(() => {
      void import('./pages/business/Dashboard').catch(() => undefined);
      void import('./pages/business/Budget').catch(() => undefined);
      void import('./pages/print/BudgetReportPrint').catch(() => undefined);
      void import('./pages/business/Billing').catch(() => undefined);
      void import('./pages/business/Settings').catch(() => undefined);
      void import('./pages/business/Account').catch(() => undefined);
    }, 2500),
  );
}

void applyLanguage(readStoredLanguage());
initTheme();
installStaleChunkReload();
installTabletFit();
applyHostBranding();
// The Android app keeps the page clear of the phone's bars itself (see --safe-bottom).
if (android) document.documentElement.classList.add('in-android-app');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-center" richColors closeButton duration={3500} />
    </QueryClientProvider>
  </StrictMode>,
);
