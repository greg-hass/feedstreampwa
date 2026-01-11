import { writable, derived } from 'svelte/store';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  resolve: ((value: boolean) => void) | null;
}

const initialState: ConfirmState = {
  isOpen: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  type: 'info',
  resolve: null,
};

function createConfirmStore() {
  const { subscribe, set, update } = writable<ConfirmState>(initialState);

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      update((state) => ({
        ...state,
        ...options,
        isOpen: true,
        resolve,
      }));
    });
  }

  function close(confirmed: boolean) {
    update((state) => {
      if (state.resolve) {
        state.resolve(confirmed);
      }
      return { ...initialState };
    });
  }

  return {
    subscribe,
    confirm,
    close,
  };
}

export const confirmDialog = createConfirmStore();
