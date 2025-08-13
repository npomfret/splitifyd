import { useEffect, useState } from 'preact/hooks';
import { Toast } from './UpdateAnimation';

interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

interface ToastManagerState {
  toasts: ToastMessage[];
}

class ToastService {
  private static instance: ToastService;
  private listeners: Set<(toasts: ToastMessage[]) => void> = new Set();
  private toasts: ToastMessage[] = [];

  static getInstance(): ToastService {
    if (!ToastService.instance) {
      ToastService.instance = new ToastService();
    }
    return ToastService.instance;
  }

  constructor() {
    // Listen for custom toast events from error handler
    if (typeof window !== 'undefined') {
      window.addEventListener('show-toast', this.handleToastEvent.bind(this) as EventListener);
    }
  }

  private handleToastEvent(event: Event) {
    const customEvent = event as CustomEvent;
    const { message, type, duration, position } = customEvent.detail;
    this.show(message, type, duration, position);
  }

  show(
    message: string, 
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    duration: number = 3000,
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-right'
  ): string {
    const id = `toast-${Date.now()}-${Math.random()}`;
    
    const toast: ToastMessage = {
      id,
      message,
      type,
      duration,
      position
    };

    this.toasts.push(toast);
    this.notifyListeners();

    // Auto-remove after duration
    setTimeout(() => {
      this.remove(id);
    }, duration);

    return id;
  }

  remove(id: string): void {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.notifyListeners();
  }

  clear(): void {
    this.toasts = [];
    this.notifyListeners();
  }

  subscribe(callback: (toasts: ToastMessage[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.toasts]));
  }

  // Convenience methods
  success(message: string, duration?: number): string {
    return this.show(message, 'success', duration);
  }

  error(message: string, duration?: number): string {
    return this.show(message, 'error', duration || 5000);
  }

  warning(message: string, duration?: number): string {
    return this.show(message, 'warning', duration || 4000);
  }

  info(message: string, duration?: number): string {
    return this.show(message, 'info', duration);
  }
}

export const toastService = ToastService.getInstance();

export function ToastManager() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubscribe = toastService.subscribe(setToasts);
    return unsubscribe;
  }, []);

  const groupedToasts = toasts.reduce((groups, toast) => {
    const position = toast.position || 'bottom-right';
    if (!groups[position]) {
      groups[position] = [];
    }
    groups[position].push(toast);
    return groups;
  }, {} as Record<string, ToastMessage[]>);

  const getPositionClasses = (position: string) => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      default:
        return 'bottom-4 right-4';
    }
  };

  return (
    <>
      {Object.entries(groupedToasts).map(([position, positionToasts]) => (
        <div
          key={position}
          className={`fixed z-50 flex flex-col gap-2 ${getPositionClasses(position)}`}
        >
          {positionToasts.map((toast, index) => (
            <div
              key={toast.id}
              className={`
                transform transition-all duration-300 ease-out
                ${index === 0 ? 'translate-y-0' : `translate-y-${index * -12}`}
              `}
              style={{
                animationDelay: `${index * 100}ms`
              }}
            >
              <Toast
                message={toast.message}
                type={toast.type}
                duration={toast.duration}
                onClose={() => toastService.remove(toast.id)}
              />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

// React hook for using toast service
export function useToast() {
  return {
    show: toastService.show.bind(toastService),
    success: toastService.success.bind(toastService),
    error: toastService.error.bind(toastService),
    warning: toastService.warning.bind(toastService),
    info: toastService.info.bind(toastService),
    clear: toastService.clear.bind(toastService)
  };
}