import { logger } from '../logger';

/**
 * Service Registry for managing service dependencies
 * 
 * Key features:
 * - Lazy initialization of services
 * - Circular dependency detection
 * - Flexible service types (no BaseService requirement)
 * - Singleton pattern for consistent instances
 */
export class ServiceRegistry {
    private static instance: ServiceRegistry;
    private services: Map<string, any> = new Map();
    private serviceFactories: Map<string, () => any> = new Map();
    private initializing: Set<string> = new Set();

    private constructor() {}

    public static getInstance(): ServiceRegistry {
        if (!ServiceRegistry.instance) {
            ServiceRegistry.instance = new ServiceRegistry();
        }
        return ServiceRegistry.instance;
    }

    /**
     * Register a service with a factory function for lazy initialization
     */
    public registerService<T>(name: string, factory: () => T): void {
        if (this.serviceFactories.has(name)) {
            logger.warn(`Service ${name} is already registered, overwriting`);
        }
        this.serviceFactories.set(name, factory);
        // Clear cached instance if it exists to force re-initialization
        this.services.delete(name);
    }

    /**
     * Get a service instance (lazy initialization)
     */
    public getService<T>(name: string): T {
        // Return cached instance if available
        if (this.services.has(name)) {
            return this.services.get(name) as T;
        }

        // Check for circular dependency
        if (this.initializing.has(name)) {
            throw new Error(`Circular dependency detected for service: ${name}`);
        }

        // Get factory function
        const factory = this.serviceFactories.get(name);
        if (!factory) {
            throw new Error(`Service ${name} is not registered`);
        }

        try {
            // Mark as initializing
            this.initializing.add(name);
            
            // Create service instance
            const service = factory();
            
            // Cache the instance
            this.services.set(name, service);
            
            logger.info(`Service ${name} initialized successfully`);
            
            return service;
        } catch (error) {
            logger.error(`Failed to initialize service ${name}:`, error);
            throw error;
        } finally {
            // Remove from initializing set
            this.initializing.delete(name);
        }
    }

    /**
     * Check if a service is registered
     */
    public hasService(name: string): boolean {
        return this.serviceFactories.has(name);
    }

    /**
     * Get list of all registered service names
     */
    public getRegisteredServices(): string[] {
        return Array.from(this.serviceFactories.keys());
    }

    /**
     * Clear all services (useful for testing)
     */
    public clearServices(): void {
        this.services.clear();
        this.serviceFactories.clear();
        this.initializing.clear();
    }

    /**
     * Get dependency information for debugging
     */
    public getDependencyInfo(): { 
        registered: string[], 
        initialized: string[], 
        initializing: string[] 
    } {
        return {
            registered: this.getRegisteredServices(),
            initialized: Array.from(this.services.keys()),
            initializing: Array.from(this.initializing)
        };
    }
}

// Export convenience function for getting the registry instance
export const getServiceRegistry = () => ServiceRegistry.getInstance();