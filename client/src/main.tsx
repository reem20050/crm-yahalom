import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-left"
          toastOptions={{
            duration: 4000,
            style: {
              direction: 'rtl',
              borderRadius: '16px',
              padding: '14px 20px',
              fontSize: '14px',
              fontFamily: 'Assistant, sans-serif',
              boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)',
              border: '1px solid rgba(0,0,0,0.04)',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#ecfdf5',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fef2f2',
              },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
