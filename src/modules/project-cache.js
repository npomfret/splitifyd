import { APP_CONFIG } from '../config/constants.js';

// Project cache for faster loading
export class ProjectCache {
    constructor() {
        this.cache = new Map();
    }

    get(storageId) {
        const cached = this.cache.get(storageId);
        if (cached && Date.now() - cached.timestamp < APP_CONFIG.CACHE_DURATION) {
            return cached.data;
        }
        return null;
    }

    set(storageId, data) {
        this.cache.set(storageId, {
            data: data,
            timestamp: Date.now()
        });
    }

    delete(storageId) {
        this.cache.delete(storageId);
    }

    clear() {
        this.cache.clear();
    }

    // Cleanup expired entries
    cleanup() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp >= APP_CONFIG.CACHE_DURATION) {
                this.cache.delete(key);
            }
        }
    }
}

// Helper function to fetch project with caching and timeout
export async function fetchProjectWithCache(storage, cache, storageId, timeoutMs = APP_CONFIG.REQUEST_TIMEOUT) {
    // Check cache first
    const cached = cache.get(storageId);
    if (cached) {
        return cached;
    }
    
    // Fetch with timeout
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    );
    
    try {
        const projectData = await Promise.race([
            storage.getProject(storageId),
            timeoutPromise
        ]);
        
        // Cache the result
        cache.set(storageId, projectData);
        
        return projectData;
    } catch (error) {
        // Return cached data if available, even if expired
        const expired = cache.cache.get(storageId);
        if (expired) {
            return expired.data;
        }
        throw error;
    }
}