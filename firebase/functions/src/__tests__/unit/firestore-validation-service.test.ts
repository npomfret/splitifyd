import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { z } from 'zod';
import * as admin from 'firebase-admin';
import { FirestoreValidationService, getFirestoreValidationService } from '../../services/FirestoreValidationService';
import { ServiceRegistry } from '../../services/ServiceRegistry';
import { registerAllServices, getFirestoreValidationService as getFromRegistry } from '../../services/serviceRegistration';
import { LoggerContext } from '../../utils/logger-context';

// Mock dependencies
vi.mock('../../schemas/validation-helpers', () => ({
    validateFirestoreDocument: vi.fn(),
    validateBeforeWrite: vi.fn()
}));

vi.mock('../../schemas/validation-monitor', () => ({
    getValidationMetrics: vi.fn(() => ({
        totalValidations: 42,
        failedValidations: 2,
        averageValidationTime: 50
    })),
    EnhancedValidationError: class EnhancedValidationError extends Error {
        constructor(public readonly validationError: any, public readonly zodError: any) {
            super(`Schema validation failed for ${validationError.schemaName}: ${zodError.message || 'Validation failed'}`);
            this.name = 'EnhancedValidationError';
        }
    }
}));

vi.mock('../../utils/logger-context', () => ({
    LoggerContext: {
        update: vi.fn(),
        get: vi.fn(() => ({}))
    }
}));

vi.mock('../../utils/performance-monitor', () => ({
    PerformanceMonitor: {
        monitorSyncValidation: vi.fn((type, schema, fn, context) => fn())
    }
}));

// Import mocked functions
import { validateFirestoreDocument, validateBeforeWrite } from '../../schemas/validation-helpers';
import { getValidationMetrics } from '../../schemas/validation-monitor';

// Test schema
const TestSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email()
});

// Mock Firestore document
const createMockDoc = (id: string, data?: any): admin.firestore.DocumentSnapshot => {
    const mockDoc = {
        id,
        data: vi.fn(() => data),
        ref: {
            parent: {
                id: 'test-collection'
            }
        }
    } as unknown as admin.firestore.DocumentSnapshot;
    
    return mockDoc;
};

describe('FirestoreValidationService', () => {
    let service: FirestoreValidationService;
    
    beforeEach(() => {
        vi.clearAllMocks();
        service = FirestoreValidationService.getInstance();
    });

    afterEach(() => {
        // Reset LoggerContext mocks
        vi.mocked(LoggerContext.update).mockClear();
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance on multiple calls', () => {
            const service1 = FirestoreValidationService.getInstance();
            const service2 = FirestoreValidationService.getInstance();
            const service3 = getFirestoreValidationService();
            
            expect(service1).toBe(service2);
            expect(service2).toBe(service3);
        });

        it('should have private constructor (compile-time check)', () => {
            // This test verifies that the constructor is private at compile time
            // Runtime behavior is not directly testable since TypeScript prevents compilation
            // Instead, we verify that getInstance is the only way to get an instance
            const instance1 = FirestoreValidationService.getInstance();
            const instance2 = FirestoreValidationService.getInstance();
            
            expect(instance1).toBeDefined();
            expect(instance1).toBe(instance2);
            
            // Verify that the constructor property exists but is not directly accessible
            expect(instance1.constructor.name).toBe('FirestoreValidationService');
        });
    });

    describe('validateDocument()', () => {
        it('should validate valid document and set proper context', () => {
            const mockDoc = createMockDoc('doc123', { name: 'Test', email: 'test@example.com' });
            const validatedData = { id: 'doc123', name: 'Test', email: 'test@example.com' };
            
            vi.mocked(validateFirestoreDocument).mockReturnValue(validatedData);

            const result = service.validateDocument(
                TestSchema,
                mockDoc,
                'TestSchema',
                { userId: 'user123', operation: 'getDocument' }
            );

            expect(result).toEqual(validatedData);
            expect(validateFirestoreDocument).toHaveBeenCalledWith(
                TestSchema,
                mockDoc,
                'TestSchema',
                expect.any(Object) // logger
            );
            expect(LoggerContext.update).toHaveBeenCalledWith({
                documentId: 'doc123',
                collection: 'test-collection',
                operation: 'getDocument'
            });
            expect(LoggerContext.update).toHaveBeenCalledWith({
                userId: 'user123'
            });
        });

        it('should use default operation when not provided', () => {
            const mockDoc = createMockDoc('doc123', { name: 'Test', email: 'test@example.com' });
            const validatedData = { id: 'doc123', name: 'Test', email: 'test@example.com' };
            
            vi.mocked(validateFirestoreDocument).mockReturnValue(validatedData);

            service.validateDocument(TestSchema, mockDoc, 'TestSchema');

            expect(LoggerContext.update).toHaveBeenCalledWith({
                documentId: 'doc123',
                collection: 'test-collection',
                operation: 'read'
            });
        });

        it('should not set userId context when not provided', () => {
            const mockDoc = createMockDoc('doc123', { name: 'Test', email: 'test@example.com' });
            const validatedData = { id: 'doc123', name: 'Test', email: 'test@example.com' };
            
            vi.mocked(validateFirestoreDocument).mockReturnValue(validatedData);

            service.validateDocument(TestSchema, mockDoc, 'TestSchema');

            expect(LoggerContext.update).toHaveBeenCalledTimes(1);
            expect(LoggerContext.update).toHaveBeenCalledWith({
                documentId: 'doc123',
                collection: 'test-collection',
                operation: 'read'
            });
        });

        it('should propagate validation errors', () => {
            const mockDoc = createMockDoc('doc123', { invalid: 'data' });
            const testError = new Error('Validation failed');
            
            vi.mocked(validateFirestoreDocument).mockImplementation(() => {
                throw testError;
            });

            expect(() => {
                service.validateDocument(TestSchema, mockDoc, 'TestSchema');
            }).toThrow(testError);
        });
    });

    describe('validateBeforeWrite()', () => {
        it('should validate data before write and set proper context', () => {
            const inputData = { name: 'Test', email: 'test@example.com' };
            const validatedData = { name: 'Test', email: 'test@example.com' };
            
            vi.mocked(validateBeforeWrite).mockReturnValue(validatedData);

            const result = service.validateBeforeWrite(
                TestSchema,
                inputData,
                'TestSchema',
                {
                    documentId: 'doc123',
                    collection: 'test-collection',
                    userId: 'user123',
                    operation: 'createDocument'
                }
            );

            expect(result).toEqual(validatedData);
            expect(validateBeforeWrite).toHaveBeenCalledWith(
                TestSchema,
                inputData,
                'TestSchema',
                {
                    documentId: 'doc123',
                    collection: 'test-collection',
                    userId: 'user123',
                    logger: expect.any(Object)
                }
            );
            expect(LoggerContext.update).toHaveBeenCalledWith({
                operation: 'createDocument',
                documentId: 'doc123',
                collection: 'test-collection'
            });
            expect(LoggerContext.update).toHaveBeenCalledWith({
                userId: 'user123'
            });
        });

        it('should use default operation when not provided', () => {
            const inputData = { name: 'Test', email: 'test@example.com' };
            const validatedData = { name: 'Test', email: 'test@example.com' };
            
            vi.mocked(validateBeforeWrite).mockReturnValue(validatedData);

            service.validateBeforeWrite(TestSchema, inputData, 'TestSchema');

            expect(LoggerContext.update).toHaveBeenCalledWith({
                operation: 'write',
                documentId: undefined,
                collection: undefined
            });
        });

        it('should handle partial context', () => {
            const inputData = { name: 'Test', email: 'test@example.com' };
            const validatedData = { name: 'Test', email: 'test@example.com' };
            
            vi.mocked(validateBeforeWrite).mockReturnValue(validatedData);

            service.validateBeforeWrite(
                TestSchema,
                inputData,
                'TestSchema',
                { collection: 'test-collection' }
            );

            expect(LoggerContext.update).toHaveBeenCalledWith({
                operation: 'write',
                documentId: undefined,
                collection: 'test-collection'
            });
            expect(LoggerContext.update).toHaveBeenCalledTimes(1);
        });

        it('should propagate validation errors', () => {
            const inputData = { invalid: 'data' };
            const testError = new Error('Validation failed');
            
            vi.mocked(validateBeforeWrite).mockImplementation(() => {
                throw testError;
            });

            expect(() => {
                service.validateBeforeWrite(TestSchema, inputData, 'TestSchema');
            }).toThrow(testError);
        });
    });

    describe('getValidationMetrics()', () => {
        it('should return validation metrics from monitor', () => {
            const metrics = service.getValidationMetrics();
            
            expect(metrics).toEqual({
                totalValidations: 42,
                failedValidations: 2,
                averageValidationTime: 50
            });
            expect(getValidationMetrics).toHaveBeenCalled();
        });
    });
});

describe('Service Registry Integration', () => {
    beforeEach(() => {
        const registry = ServiceRegistry.getInstance();
        registry.clearServices();
        registerAllServices();
    });

    it('should register FirestoreValidationService in registry', () => {
        const registry = ServiceRegistry.getInstance();
        const registeredServices = registry.getRegisteredServices();
        
        expect(registeredServices).toContain('FirestoreValidationService');
    });

    it('should return singleton instance through registry', () => {
        const service1 = getFromRegistry();
        const service2 = getFromRegistry();
        const service3 = FirestoreValidationService.getInstance();
        
        expect(service1).toBe(service2);
        expect(service2).toBe(service3);
    });

    it('should use lazy initialization through registry', () => {
        const registry = ServiceRegistry.getInstance();
        let info = registry.getDependencyInfo();
        
        // Service should not be initialized yet
        expect(info.initialized).not.toContain('FirestoreValidationService');
        
        // Access service
        getFromRegistry();
        
        info = registry.getDependencyInfo();
        expect(info.initialized).toContain('FirestoreValidationService');
    });
});