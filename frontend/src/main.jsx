import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import './styles/index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        appearance={{
          variables: {
            colorPrimary:         '#4f72ff',
            colorBackground:      '#111827',
            colorInputBackground: '#1f2937',
            colorInputText:       '#f9fafb',
            colorText:            '#f9fafb',
            colorTextSecondary:   '#9ca3af',
            borderRadius:         '0.75rem',
            fontFamily:           'Inter, system-ui, sans-serif',
          },
          elements: {
            card:                     'bg-gray-900 border border-gray-800 shadow-2xl',
            headerTitle:              'text-white font-bold',
            headerSubtitle:           'text-gray-400',
            socialButtonsBlockButton: 'border-gray-700 text-gray-200 hover:bg-gray-800',
            formButtonPrimary:        'bg-brand-500 hover:bg-brand-600',
            footerActionLink:         'text-brand-400 hover:text-brand-300',
          },
        }}
      >
        <BrowserRouter>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1f2937',
                color: '#f9fafb',
                border: '1px solid #374151',
                borderRadius: '12px',
                fontSize: '14px',
                fontFamily: 'Inter, system-ui, sans-serif',
              },
              success: { iconTheme: { primary: '#4f72ff', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </BrowserRouter>
      </ClerkProvider>
    </ThemeProvider>
  </React.StrictMode>
);
