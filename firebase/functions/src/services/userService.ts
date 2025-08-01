import * as admin from 'firebase-admin';

/**
 * User profile interface for consistent user data across the application
 */
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
}

/**
 * Service for fetching user profiles from Firebase Auth with request-level caching
 */
export class UserService {
  private cache = new Map<string, UserProfile>();

  /**
   * Get a single user profile by UID
   */
  async getUser(uid: string): Promise<UserProfile> {
    // Check cache first
    if (this.cache.has(uid)) {
      return this.cache.get(uid)!;
    }

    const userRecord = await admin.auth().getUser(uid);
    
    if (!userRecord.email || !userRecord.displayName) {
      throw new Error(`User ${uid} missing required fields: email and displayName are mandatory`);
    }
    
    const profile: UserProfile = {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName
    };

    // Cache the result
    this.cache.set(uid, profile);
    return profile;
  }

  /**
   * Get multiple user profiles by UIDs (batch operation)
   */
  async getUsers(uids: string[]): Promise<Map<string, UserProfile>> {
    const result = new Map<string, UserProfile>();
    const uncachedUids: string[] = [];

    // Check cache for each UID
    for (const uid of uids) {
      if (this.cache.has(uid)) {
        result.set(uid, this.cache.get(uid)!);
      } else {
        uncachedUids.push(uid);
      }
    }

    // Fetch uncached users in batches (Firebase Auth supports up to 100 users per batch)
    if (uncachedUids.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < uncachedUids.length; i += batchSize) {
        const batch = uncachedUids.slice(i, i + batchSize);
        await this.fetchUserBatch(batch, result);
      }
    }

    return result;
  }

  /**
   * Fetch a batch of users and add to result map
   */
  private async fetchUserBatch(uids: string[], result: Map<string, UserProfile>): Promise<void> {
    const getUsersResult = await admin.auth().getUsers(
      uids.map(uid => ({ uid }))
    );

    // Process found users
    for (const userRecord of getUsersResult.users) {
      if (!userRecord.email || !userRecord.displayName) {
        throw new Error(`User ${userRecord.uid} missing required fields: email and displayName are mandatory`);
      }
      
      const profile: UserProfile = {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName
      };

      // Cache and add to result
      this.cache.set(userRecord.uid, profile);
      result.set(userRecord.uid, profile);
    }

    // Handle not found users - throw error for any missing users
    if (getUsersResult.notFound.length > 0) {
      throw new Error(`Users not found: ${getUsersResult.notFound.length} users`);
    }
  }

  /**
   * Clear the cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export a singleton instance for use across the application
export const userService = new UserService();