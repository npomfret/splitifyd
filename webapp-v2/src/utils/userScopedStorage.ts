/**
 * User-Scoped Browser Storage Utility
 * 
 * Provides localStorage operations scoped to the current user to prevent
 * data leakage between users on shared devices.
 * 
 * Features:
 * - Automatic user ID prefixing for all storage keys
 * - Clean separation between users
 * - Bulk user data cleanup on logout
 */

export interface UserScopedStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

class UserScopedStorageImpl implements UserScopedStorage {
  private static readonly USER_PREFIX = 'user_';

  constructor(private getUserId: () => string | null) {}

  /**
   * Generate a scoped storage key based on current user ID
   */
  private getScopedKey(key: string): string {
    const userId = this.getUserId();
    if (!userId) {
      throw new Error('No user ID available for storage operations');
    }
    return `${UserScopedStorageImpl.USER_PREFIX}${userId}_${key}`;
  }

  /**
   * Get an item from user-scoped storage
   */
  getItem(key: string): string | null {
    const userId = this.getUserId();
    if (!userId) {
      return null; // No user authenticated, no data available
    }
    
    const scopedKey = this.getScopedKey(key);
    return localStorage.getItem(scopedKey);
  }

  /**
   * Set an item in user-scoped storage
   */
  setItem(key: string, value: string): void {
    const scopedKey = this.getScopedKey(key);
    localStorage.setItem(scopedKey, value);
  }

  /**
   * Remove an item from user-scoped storage
   */
  removeItem(key: string): void {
    const scopedKey = this.getScopedKey(key);
    localStorage.removeItem(scopedKey);
  }

  /**
   * Clear all user-scoped storage for the current user
   * Leaves other users' data intact
   */
  clear(): void {
    const userId = this.getUserId();
    if (!userId) {
      return; // No user to clear data for
    }

    const userPrefix = `${UserScopedStorageImpl.USER_PREFIX}${userId}_`;
    const keysToRemove: string[] = [];
    
    // Collect all keys for this user
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(userPrefix)) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all user-scoped keys
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
}

/**
 * Create a UserScopedStorage instance with a user ID provider function
 */
export function createUserScopedStorage(getUserId: () => string | null): UserScopedStorage {
  return new UserScopedStorageImpl(getUserId);
}

