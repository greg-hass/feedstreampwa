import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  let toastIdCounter = 0;

  function show(type: ToastType, message: string, duration = 4000) {
    const id = `toast-${++toastIdCounter}`;
    const toast: Toast = { id, type, message, duration };

    update((toasts) => [...toasts, toast]);

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, duration);
    }

    return id;
  }

  function dismiss(id: string) {
    update((toasts) => toasts.filter((t) => t.id !== id));
  }

  function clear() {
    update(() => []);
  }

  return {
    subscribe,
    show,
    dismiss,
    clear,
    success: (message: string, duration?: number) => show('success', message, duration),
    error: (message: string, duration?: number) => show('error', message, duration),
    warning: (message: string, duration?: number) => show('warning', message, duration),
    info: (message: string, duration?: number) => show('info', message, duration),
  };
}

export const toast = createToastStore();
