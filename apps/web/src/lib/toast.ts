import { toast } from 'sonner';

export function toastSuccess(message: string) {
  toast.success(message, {
    style: {
      background: 'var(--color-surface-overlay)',
      color: 'var(--color-text-primary)',
      border: '1px solid var(--color-success-default)',
    },
  });
}

export function toastError(message: string) {
  toast.error(message, {
    style: {
      background: 'var(--color-surface-overlay)',
      color: 'var(--color-text-primary)',
      border: '1px solid var(--color-danger-default)',
    },
  });
}

export function toastInfo(message: string) {
  toast(message, {
    style: {
      background: 'var(--color-surface-overlay)',
      color: 'var(--color-text-primary)',
      border: '1px solid var(--color-border-subtle)',
    },
  });
}

export function toastPromise<T>(
  promise: Promise<T>,
  messages: { loading: string; success: string; error: string }
) {
  return toast.promise(promise, messages);
}
