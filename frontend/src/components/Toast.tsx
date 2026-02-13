import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// --- Types ---
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  exiting?: boolean;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ToastContextType {
  toast: (type: ToastType, message: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

// --- Toast Item ---
const ICON_MAP: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} />,
  error: <XCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

const COLOR_MAP: Record<ToastType, string> = {
  success: 'bg-edp-marine text-white',
  error: 'bg-edp-semantic-red text-white',
  warning: 'bg-edp-semantic-yellow text-edp-marine',
  info: 'bg-edp-slate text-white',
};

const ToastItem: React.FC<{ t: Toast; onDismiss: (id: number) => void }> = ({ t, onDismiss }) => {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg min-w-[280px] max-w-[420px] pointer-events-auto transition-all duration-300 ${COLOR_MAP[t.type]} ${
        t.exiting ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'
      }`}
    >
      <div className="flex-shrink-0">{ICON_MAP[t.type]}</div>
      <p className="flex-1 text-sm font-medium leading-snug">{t.message}</p>
      <button
        onClick={() => onDismiss(t.id)}
        className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
      >
        <X size={14} />
      </button>
    </div>
  );
};

// --- Confirm Dialog ---
const ConfirmDialog: React.FC<{
  options: ConfirmOptions;
  onResult: (confirmed: boolean) => void;
}> = ({ options, onResult }) => {
  const [closing, setClosing] = useState(false);

  const handleResult = (val: boolean) => {
    setClosing(true);
    setTimeout(() => onResult(val), 200);
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-200 ${
        closing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="absolute inset-0 bg-black/40" onClick={() => handleResult(false)} />
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden transition-all duration-200 ${
          closing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        <div className="p-6">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
            options.danger ? 'bg-edp-semantic-light-red' : 'bg-edp-marine/10'
          }`}>
            {options.danger ? (
              <AlertTriangle size={24} className="text-edp-semantic-red" />
            ) : (
              <Info size={24} className="text-edp-marine" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-edp-marine mb-2">{options.title}</h3>
          <p className="text-sm text-edp-slate leading-relaxed">{options.message}</p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={() => handleResult(false)}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-edp-slate bg-white border border-edp-neutral-lighter rounded-xl hover:bg-edp-neutral-white-wash transition-colors"
          >
            {options.cancelLabel || 'Cancelar'}
          </button>
          <button
            onClick={() => handleResult(true)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors ${
              options.danger
                ? 'bg-edp-semantic-red hover:bg-red-600'
                : 'bg-edp-marine hover:bg-edp-marine-100'
            }`}
          >
            {options.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Provider ---
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), 3500);
  }, [dismiss]);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ options, resolve });
    });
  }, []);

  const handleConfirmResult = (val: boolean) => {
    if (confirmState) {
      confirmState.resolve(val);
      setConfirmState(null);
    }
  };

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast Container - canto superior direito */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} t={t} onDismiss={dismiss} />
        ))}
      </div>

      {/* Confirm Dialog */}
      {confirmState && (
        <ConfirmDialog options={confirmState.options} onResult={handleConfirmResult} />
      )}
    </ToastContext.Provider>
  );
};
