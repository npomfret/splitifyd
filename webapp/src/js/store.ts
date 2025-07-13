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
    const storedToken = localStorage.getItem('splitifyd_auth_token');
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
            localStorage.setItem('splitifyd_auth_token', value);
          } else {
            localStorage.removeItem('splitifyd_auth_token');
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
      try {
        handler(property, newValue, oldValue);
      } catch (error) {
        console.error('Error in state change handler:', error);
      }
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
}

const storeInstance = new Store();

export const store = storeInstance.getState();
export const subscribe = storeInstance.subscribe.bind(storeInstance);
export const updateStore = storeInstance.updateState.bind(storeInstance);
export const resetStore = storeInstance.reset.bind(storeInstance);