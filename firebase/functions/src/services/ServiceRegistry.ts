import { logger } from '../logger';
import type { UserService } from './UserService2';
import type { GroupService } from './GroupService';
import type { ExpenseService } from './ExpenseService';
import type { SettlementService } from './SettlementService';
import type { CommentService } from './CommentService';
import type { PolicyService } from './PolicyService';
import type { UserPolicyService } from './UserPolicyService';
import type { GroupMemberService } from './GroupMemberService';
import type { GroupPermissionService } from './GroupPermissionService';
import type { GroupShareService } from './GroupShareService';
import type { ExpenseMetadataService } from './expenseMetadataService';
import type { FirestoreValidationService } from './FirestoreValidationService';
import type { IFirestoreReader } from './firestore/IFirestoreReader';
import type { IFirestoreWriter } from './firestore/IFirestoreWriter';

/**
 * Service name constants for type-safe service retrieval
 */
export const SERVICE_NAMES = {
    USER_SERVICE: 'UserService',
    GROUP_SERVICE: 'GroupService',
    EXPENSE_SERVICE: 'ExpenseService',
    SETTLEMENT_SERVICE: 'SettlementService',
    COMMENT_SERVICE: 'CommentService',
    POLICY_SERVICE: 'PolicyService',
    USER_POLICY_SERVICE: 'UserPolicyService',
    GROUP_MEMBER_SERVICE: 'GroupMemberService',
    GROUP_PERMISSION_SERVICE: 'GroupPermissionService',
    GROUP_SHARE_SERVICE: 'GroupShareService',
    EXPENSE_METADATA_SERVICE: 'ExpenseMetadataService',
    FIRESTORE_VALIDATION_SERVICE: 'FirestoreValidationService',
    FIRESTORE_READER: 'FirestoreReader',
    FIRESTORE_WRITER: 'FirestoreWriter'
} as const;

/**
 * Type mapping from service names to service types
 */
export interface ServiceTypeMap {
    [SERVICE_NAMES.USER_SERVICE]: UserService;
    [SERVICE_NAMES.GROUP_SERVICE]: GroupService;
    [SERVICE_NAMES.EXPENSE_SERVICE]: ExpenseService;
    [SERVICE_NAMES.SETTLEMENT_SERVICE]: SettlementService;
    [SERVICE_NAMES.COMMENT_SERVICE]: CommentService;
    [SERVICE_NAMES.POLICY_SERVICE]: PolicyService;
    [SERVICE_NAMES.USER_POLICY_SERVICE]: UserPolicyService;
    [SERVICE_NAMES.GROUP_MEMBER_SERVICE]: GroupMemberService;
    [SERVICE_NAMES.GROUP_PERMISSION_SERVICE]: GroupPermissionService;
    [SERVICE_NAMES.GROUP_SHARE_SERVICE]: GroupShareService;
    [SERVICE_NAMES.EXPENSE_METADATA_SERVICE]: ExpenseMetadataService;
    [SERVICE_NAMES.FIRESTORE_VALIDATION_SERVICE]: FirestoreValidationService;
    [SERVICE_NAMES.FIRESTORE_READER]: IFirestoreReader;
    [SERVICE_NAMES.FIRESTORE_WRITER]: IFirestoreWriter;
}

/**
 * Valid service name type (union of all service names)
 */
export type ServiceName = keyof ServiceTypeMap;

/**
 * Extended service name type that includes test services
 * This allows flexibility for testing while maintaining type safety for production
 */
export type ExtendedServiceName = ServiceName | string;

/**
 * Service Registry for managing service dependencies
 * 
 * Key features:
 * - Lazy initialization of services
 * - Circular dependency detection
 * - Type-safe service registration and retrieval for production services
 * - Flexible support for test services
 * - Singleton pattern for consistent instances
 */
export class ServiceRegistry {
    private static instance: ServiceRegistry;
    private serviceFactories: Map<ExtendedServiceName, () => any> = new Map();
    private initializing: Set<ExtendedServiceName> = new Set();

    private constructor() {}

    public static getInstance(): ServiceRegistry {
        if (!ServiceRegistry.instance) {
            ServiceRegistry.instance = new ServiceRegistry();
        }
        return ServiceRegistry.instance;
    }

    /**
     * Register a production service with full type safety
     */
    public registerService<K extends ServiceName>(
        name: K, 
        factory: () => ServiceTypeMap[K]
    ): void;
    
    /**
     * Register any service (including test services) with basic type safety
     */
    public registerService<T>(
        name: string, 
        factory: () => T
    ): void;
    
    public registerService<K extends ServiceName, T>(
        name: K | string, 
        factory: () => ServiceTypeMap[K] | T
    ): void {
        if (this.serviceFactories.has(name)) {
            logger.warn(`Service ${name} is already registered, overwriting`);
        }
        this.serviceFactories.set(name, factory);
    }

    /**
     * Get a production service with full type inference
     */
    public getService<K extends ServiceName>(name: K): ServiceTypeMap[K];
    
    /**
     * Get any service (including test services)
     */
    public getService<T>(name: string): T;
    
    public getService<K extends ServiceName, T>(
        name: K | string
    ): ServiceTypeMap[K] | T {
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
            
            // Create service instance (no caching)
            const service = factory();
            
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
    public hasService(name: ExtendedServiceName): boolean {
        return this.serviceFactories.has(name);
    }

    /**
     * Get list of all registered service names
     */
    public getRegisteredServices(): ExtendedServiceName[] {
        return Array.from(this.serviceFactories.keys());
    }

    /**
     * Clear all services (useful for testing)
     */
    public clearServices(): void {
        this.serviceFactories.clear();
        this.initializing.clear();
    }

    /**
     * Get dependency information for debugging
     */
    public getDependencyInfo(): { 
        registered: ExtendedServiceName[], 
        initializing: ExtendedServiceName[] 
    } {
        return {
            registered: this.getRegisteredServices(),
            initializing: Array.from(this.initializing)
        };
    }
}
