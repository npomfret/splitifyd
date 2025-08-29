import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceRegistry } from '../../services/ServiceRegistry';
import { registerAllServices, getUserService, getGroupService } from '../../services/serviceRegistration';

describe('ServiceRegistry', () => {
    let registry: ServiceRegistry;

    beforeEach(() => {
        registry = ServiceRegistry.getInstance();
        registry.clearServices(); // Clear any existing services
    });

    it('should create singleton instance', () => {
        const registry1 = ServiceRegistry.getInstance();
        const registry2 = ServiceRegistry.getInstance();
        expect(registry1).toBe(registry2);
    });

    it('should register and retrieve services', () => {
        const mockService = { test: 'value' };
        registry.registerService('TestService', () => mockService);

        const retrieved = registry.getService('TestService');
        expect(retrieved).toBe(mockService);
    });

    it('should use lazy initialization', () => {
        let factoryCallCount = 0;
        const mockService = { test: 'value' };
        
        registry.registerService('LazyService', () => {
            factoryCallCount++;
            return mockService;
        });

        // Factory should not be called yet
        expect(factoryCallCount).toBe(0);

        // First access should call factory
        registry.getService('LazyService');
        expect(factoryCallCount).toBe(1);

        // Second access should use cached instance
        registry.getService('LazyService');
        expect(factoryCallCount).toBe(1);
    });

    it('should detect circular dependencies', () => {
        registry.registerService('ServiceA', () => {
            // This would trigger circular dependency
            registry.getService('ServiceA');
            return {};
        });

        expect(() => registry.getService('ServiceA')).toThrow('Circular dependency detected for service: ServiceA');
    });

    it('should throw error for unregistered service', () => {
        expect(() => registry.getService('UnregisteredService')).toThrow('Service UnregisteredService is not registered');
    });

    it('should provide dependency information', () => {
        registry.registerService('Service1', () => ({}));
        registry.registerService('Service2', () => ({}));
        
        // Initialize one service
        registry.getService('Service1');

        const info = registry.getDependencyInfo();
        expect(info.registered).toContain('Service1');
        expect(info.registered).toContain('Service2');
        expect(info.initialized).toContain('Service1');
        expect(info.initialized).not.toContain('Service2');
        expect(info.initializing).toEqual([]);
    });
});

describe('Service Registration', () => {
    beforeEach(() => {
        const registry = ServiceRegistry.getInstance();
        registry.clearServices();
        registerAllServices();
    });

    it('should register all services', () => {
        const registry = ServiceRegistry.getInstance();
        const registeredServices = registry.getRegisteredServices();
        
        expect(registeredServices).toContain('UserService');
        expect(registeredServices).toContain('GroupService');
        expect(registeredServices).toContain('ExpenseService');
        expect(registeredServices).toContain('SettlementService');
        expect(registeredServices).toContain('CommentService');
        expect(registeredServices).toContain('PolicyService');
        expect(registeredServices).toContain('UserPolicyService');
        expect(registeredServices).toContain('GroupMemberService');
        expect(registeredServices).toContain('GroupPermissionService');
        expect(registeredServices).toContain('GroupShareService');
    });

    it('should provide type-safe service getters', () => {
        const userService = getUserService();
        const groupService = getGroupService();

        expect(userService).toBeDefined();
        expect(groupService).toBeDefined();
        expect(typeof userService.getUser).toBe('function');
        expect(typeof groupService.getGroup).toBe('function');
    });

    it('should return same instance on multiple calls', () => {
        const userService1 = getUserService();
        const userService2 = getUserService();
        
        expect(userService1).toBe(userService2);
    });
});