import { AUTH_TOKEN_KEY } from './constants.js';

interface User {
  id: string;
  email: string;
  displayName?: string;
}

interface AppState {
  user: User | null;
  authToken: string | null;
}

type StateChangeHandler = (property: keyof AppState, newValue: any, oldValue: any) => void;

class Store {
  private state: AppState;
  private handlers: Set<StateChangeHandler> = new Set();
  private proxiedState: AppState;

  constructor() {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const storedUserId = localStorage.getItem('userId');
    
    this.state = {
      user: storedUserId ? { id: storedUserId, email: '' } : null,
      authToken: storedToken
    };

    this.proxiedState = new Proxy(this.state, {
      set: (target: AppState, property: keyof AppState, value: any) => {
        const oldValue = target[property];
        if (oldValue === value) return true;
        
        (target as any)[property] = value;
        
        if (property === 'authToken') {
          if (value) {
            localStorage.setItem(AUTH_TOKEN_KEY, value);
          } else {
            localStorage.removeItem(AUTH_TOKEN_KEY);
          }
        }
        
        if (property === 'user') {
          if (value?.id) {
            localStorage.setItem('userId', value.id);
          } else {
            localStorage.removeItem('userId');
          }
        }
        
        this.notifyHandlers(property, value, oldValue);
        return true;
      },
      get: (target: AppState, property: keyof AppState) => {
        return target[property];
      }
    });
  }

  private notifyHandlers(property: keyof AppState, newValue: any, oldValue: any): void {
    this.handlers.forEach(handler => {
      handler(property, newValue, oldValue);
    });
  }

  subscribe(handler: StateChangeHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  getState(): AppState {
    return this.proxiedState;
  }

  updateState(updates: Partial<AppState>): void {
    Object.entries(updates).forEach(([key, value]) => {
      (this.proxiedState as any)[key] = value;
    });
  }

  reset(): void {
    this.updateState({
      user: null,
      authToken: null
    });
  }

  clearSubscribers(): void {
    this.handlers.clear();
  }
}

const storeInstance = new Store();

export const store = storeInstance.getState();
export const subscribe = storeInstance.subscribe.bind(storeInstance);
export const updateStore = storeInstance.updateState.bind(storeInstance);
export const resetStore = storeInstance.reset.bind(storeInstance);
export const clearSubscribers = storeInstance.clearSubscribers.bind(storeInstance);