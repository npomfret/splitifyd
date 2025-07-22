/**
 * Simple auth bridge to share authentication state between old and new webapp
 * Uses localStorage to persist auth tokens that both apps can access
 */

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'userId';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export const authBridge = {
  /**
   * Save auth token to localStorage for cross-app sharing
   */
  saveAuthToken(token: string): void {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  },

  /**
   * Get auth token from localStorage
   */
  getAuthToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  /**
   * Save user data to localStorage
   */
  saveUser(user: AuthUser): void {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  },

  /**
   * Get user data from localStorage
   */
  getUser(): AuthUser | null {
    const userStr = localStorage.getItem(AUTH_USER_KEY);
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  /**
   * Clear auth data (logout)
   */
  clearAuth(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getAuthToken();
  },

  /**
   * Listen for auth changes from other tabs/apps
   */
  onAuthChange(callback: (isAuthenticated: boolean) => void): () => void {
    const handler = (e: StorageEvent) => {
      if (e.key === AUTH_TOKEN_KEY) {
        callback(!!e.newValue);
      }
    };

    window.addEventListener('storage', handler);
    
    // Return cleanup function
    return () => window.removeEventListener('storage', handler);
  }
};