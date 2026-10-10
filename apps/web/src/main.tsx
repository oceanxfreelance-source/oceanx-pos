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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

void applyLanguage(readStoredLanguage());
initTheme();
installStaleChunkReload();
installTabletFit();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-center" richColors closeButton duration={3500} />
    </QueryClientProvider>
  </StrictMode>,
);
