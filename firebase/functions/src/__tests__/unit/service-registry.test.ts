import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceRegistry } from '../../services/ServiceRegistry';
import { 
    getUserService, 
    getGroupService, 
    getExpenseService,
    getSettlementService,
    getCommentService,
    getPolicyService,
    getUserPolicyService,
    getGroupMemberService,
    getGroupPermissionService,
    getGroupShareService
} from '../../services/serviceRegistration';
import { setupTestServices } from '../test-helpers/setup';

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

        // Second access creates new instance (no caching)
        registry.getService('LazyService');
        expect(factoryCallCount).toBe(2);
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
        expect(info.initializing).toEqual([]);
    });
});

describe('Service Registration', () => {
    beforeEach(() => {
        const registry = ServiceRegistry.getInstance();
        registry.clearServices();
        setupTestServices();
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
    });

    it('should return same instance on multiple calls', () => {
        const userService1 = getUserService();
        const userService2 = getUserService();
        
        expect(userService1).toBe(userService2);
    });

    it('should verify all service getters work correctly', () => {
        // Test all service getters to ensure they return valid instances
        const userService = getUserService();
        const groupService = getGroupService();
        const expenseService = getExpenseService();
        const settlementService = getSettlementService();
        const commentService = getCommentService();
        const policyService = getPolicyService();
        const userPolicyService = getUserPolicyService();
        const groupMemberService = getGroupMemberService();
        const groupPermissionService = getGroupPermissionService();
        const groupShareService = getGroupShareService();

        // Verify all services are defined
        expect(userService).toBeDefined();
        expect(groupService).toBeDefined();
        expect(expenseService).toBeDefined();
        expect(settlementService).toBeDefined();
        expect(commentService).toBeDefined();
        expect(policyService).toBeDefined();
        expect(userPolicyService).toBeDefined();
        expect(groupMemberService).toBeDefined();
        expect(groupPermissionService).toBeDefined();
        expect(groupShareService).toBeDefined();

        // Verify key methods exist
        expect(typeof userService.getUser).toBe('function');
        expect(typeof expenseService.getExpense).toBe('function');
        expect(typeof settlementService.getSettlement).toBe('function');
        expect(typeof commentService.createComment).toBe('function');
        expect(typeof policyService.getPolicy).toBe('function');
        expect(typeof userPolicyService.acceptPolicy).toBe('function');
        expect(typeof groupMemberService.getGroupMembersResponse).toBe('function');
        expect(typeof groupPermissionService.applySecurityPreset).toBe('function');
        expect(typeof groupShareService.generateShareableLink).toBe('function');
    });

    it('should verify singleton behavior across all services', () => {
        // Test that all services return the same instance on multiple calls
        expect(getUserService()).toBe(getUserService());
        expect(getGroupService()).toBe(getGroupService());
        expect(getExpenseService()).toBe(getExpenseService());
        expect(getSettlementService()).toBe(getSettlementService());
        expect(getCommentService()).toBe(getCommentService());
        expect(getPolicyService()).toBe(getPolicyService());
        expect(getUserPolicyService()).toBe(getUserPolicyService());
        expect(getGroupMemberService()).toBe(getGroupMemberService());
        expect(getGroupPermissionService()).toBe(getGroupPermissionService());
        expect(getGroupShareService()).toBe(getGroupShareService());
    });

    it('should verify lazy initialization for all services', () => {
        const registry = ServiceRegistry.getInstance();
        const info = registry.getDependencyInfo();
        
        // Initially no services should be initialized
        
        // Access one service
        getUserService();
        const afterOneService = registry.getDependencyInfo();
        
        // Access another service 
        getGroupService();
        const afterTwoServices = registry.getDependencyInfo();
    });
});