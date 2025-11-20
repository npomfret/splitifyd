import { signal } from '@preact/signals';
import type { ToastData } from './Toast';
import { Toast } from './Toast';

/** Global toast queue signal */
export const toastQueue = signal<ToastData[]>([]);

/**
 * ToastContainer component
 *
 * Renders all active toasts in a fixed position on the screen.
 * Manages the toast queue and handles dismissal.
 *
 * This component should be included once in your app's root layout.
 *
 * @example
 * // In your main App or Layout component:
 * import { ToastContainer } from '@/components/ui/ToastContainer';
 *
 * export function App() {
 *   return (
 *     <>
 *       <YourContent />
 *       <ToastContainer />
 *     </>
 *   );
 * }
 */
export function ToastContainer() {
    const handleDismiss = (id: string) => {
        toastQueue.value = toastQueue.value.filter((toast) => toast.id !== id);
    };

    if (toastQueue.value.length === 0) {
        return null;
    }

    return (
        <div
            className='fixed top-0 right-0 z-50 p-4 space-y-4 pointer-events-none'
            aria-live='polite'
            aria-atomic='true'
        >
            {toastQueue.value.map((toast) => (
                <Toast
                    key={toast.id}
                    {...toast}
                    onDismiss={handleDismiss}
                />
            ))}
        </div>
    );
}
