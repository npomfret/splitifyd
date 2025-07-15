import { store, subscribe, updateStore, resetStore, clearSubscribers } from './store';

beforeEach(() => {
  localStorage.clear();
  clearSubscribers();
  resetStore();
});

describe('Store', () => {
  describe('Initial State', () => {
    it('should initialize with null user and authToken', () => {
      expect(store.user).toBeNull();
      expect(store.authToken).toBeNull();
    });

    it('should load existing auth token from localStorage', () => {
      localStorage.setItem('auth_token', 'test-token');
      localStorage.setItem('userId', 'test-user-id');
      
      jest.resetModules();
      const { store: newStore } = require('./store');
      
      expect(newStore.authToken).toBe('test-token');
      expect(newStore.user).toEqual({ id: 'test-user-id', email: '' });
    });
  });

  describe('State Updates', () => {
    it('should update user state', () => {
      const user = { id: '123', email: 'test@example.com', displayName: 'Test User' };
      updateStore({ user });
      
      expect(store.user).toEqual(user);
      expect(localStorage.getItem('userId')).toBe('123');
    });

    it('should update auth token', () => {
      updateStore({ authToken: 'new-token' });
      
      expect(store.authToken).toBe('new-token');
      expect(localStorage.getItem('auth_token')).toBe('new-token');
    });

    it('should remove localStorage items when setting to null', () => {
      updateStore({ user: { id: '123', email: 'test@example.com' }, authToken: 'token' });
      expect(localStorage.getItem('userId')).toBe('123');
      expect(localStorage.getItem('auth_token')).toBe('token');
      
      updateStore({ user: null, authToken: null });
      
      expect(localStorage.getItem('userId')).toBeNull();
      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('should update multiple properties at once', () => {
      const updates = {
        user: { id: '456', email: 'new@example.com' },
        authToken: 'new-auth-token'
      };
      
      updateStore(updates);
      
      expect(store.user).toEqual(updates.user);
      expect(store.authToken).toBe(updates.authToken);
    });
  });

  describe('Subscriptions', () => {
    it('should notify subscribers on state change', () => {
      const handler = jest.fn();
      const unsubscribe = subscribe(handler);
      
      updateStore({ authToken: 'test-token' });
      
      expect(handler).toHaveBeenCalledWith('authToken', 'test-token', null);
      
      unsubscribe();
    });

    it('should not notify after unsubscribe', () => {
      const handler = jest.fn();
      const unsubscribe = subscribe(handler);
      
      unsubscribe();
      updateStore({ authToken: 'test-token' });
      
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle multiple subscribers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      subscribe(handler1);
      subscribe(handler2);
      
      updateStore({ user: { id: '789', email: 'multi@example.com' } });
      
      expect(handler1).toHaveBeenCalledWith('user', { id: '789', email: 'multi@example.com' }, null);
      expect(handler2).toHaveBeenCalledWith('user', { id: '789', email: 'multi@example.com' }, null);
    });

    it('should not notify if value does not change', () => {
      const handler = jest.fn();
      subscribe(handler);
      
      updateStore({ authToken: 'same-token' });
      handler.mockClear();
      
      updateStore({ authToken: 'same-token' });
      
      expect(handler).not.toHaveBeenCalled();
    });

    it('should propagate errors from subscribers', () => {
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      
      subscribe(errorHandler);
      
      expect(() => updateStore({ authToken: 'test' })).toThrow('Handler error');
    });
  });

  describe('Reset', () => {
    it('should reset all state to initial values', () => {
      updateStore({
        user: { id: '123', email: 'test@example.com' },
        authToken: 'test-token'
      });
      
      resetStore();
      
      expect(store.user).toBeNull();
      expect(store.authToken).toBeNull();
      expect(localStorage.getItem('userId')).toBeNull();
      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('should notify subscribers when resetting', () => {
      const handler = jest.fn();
      subscribe(handler);
      
      updateStore({ authToken: 'test-token' });
      handler.mockClear();
      
      resetStore();
      
      expect(handler).toHaveBeenCalledWith('authToken', null, 'test-token');
    });
  });
});