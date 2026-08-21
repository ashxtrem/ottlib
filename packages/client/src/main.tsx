import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';
import { App } from './App';
import { ToastProvider } from './components/ToastProvider';
import { ThemeProvider } from './hooks/useTheme';

createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={new QueryClient()}><ThemeProvider><ToastProvider><BrowserRouter><App /></BrowserRouter></ToastProvider></ThemeProvider></QueryClientProvider></StrictMode>);
