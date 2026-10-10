'use client';

// Client-only context wrapper. QueryClient is created once at module load.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FloatingChatWidget from '@/components/FloatingChatWidget';
import InstallPrompt from '@/components/InstallPrompt';
import ScrollToTop from '@/components/ScrollToTop';
import OneSignalBell from '@/components/OneSignalBell';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <FloatingChatWidget />
      <InstallPrompt />
      <ScrollToTop />
    </QueryClientProvider>
  );
}
