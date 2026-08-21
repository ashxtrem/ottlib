import { useContext } from 'react';
import { ToastContext, type ToastApi } from '../components/ToastProvider';

export function useToast(): ToastApi {
  const context = useContext(ToastContext); if (!context) throw new Error('useToast must be used within ToastProvider'); return context;
}
