/**
 * Auth bridge for sharing authentication state with webapp-v2
 * This file mirrors the functionality in webapp-v2/src/utils/auth-bridge.ts
 * to ensure both apps can share auth state via localStorage
 */

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'userId';

interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export const authBridge = {
  saveAuthToken(token: string): void {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  },

  getAuthToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  saveUser(user: AuthUser): void {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  },

  getUser(): AuthUser | null {
    const userStr = localStorage.getItem(AUTH_USER_KEY);
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  clearAuth(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  },

  isAuthenticated(): boolean {
    return !!this.getAuthToken();
  }
};