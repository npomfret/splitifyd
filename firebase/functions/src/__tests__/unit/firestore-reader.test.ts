/**
 * FirestoreReader Unit Tests
 *
 * Tests the basic functionality of the FirestoreReader service and MockFirestoreReader
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { FirestoreReader } from '../../services/firestore';
import { MockFirestoreReader } from '../test-utils/MockFirestoreReader';
import { getAuth, getFirestore } from '../../firebase';
import { ApplicationBuilder } from '../../services/ApplicationBuilder';

describe('FirestoreReader', () => {
    const firestore = getFirestore();
    const applicationBuilder = ApplicationBuilder.createApplicationBuilder(firestore, getAuth());
    const firestoreReader = applicationBuilder.buildFirestoreReader();

    test('should be instantiable', () => {
        const reader = new FirestoreReader(firestore);
        expect(reader).toBeDefined();
        expect(typeof reader.getUser).toBe('function');
        expect(typeof reader.getGroup).toBe('function');
    });

    test('should be available via ServiceRegistry', () => {
        const reader = firestoreReader;
        expect(reader).toBeDefined();
        expect(typeof reader.getUser).toBe('function');
    });

    test('should have all required interface methods', () => {
        const reader = new FirestoreReader(firestore);

        // Document operations
        expect(typeof reader.getUser).toBe('function');
        expect(typeof reader.getGroup).toBe('function');
        expect(typeof reader.getExpense).toBe('function');
        expect(typeof reader.getSettlement).toBe('function');
        expect(typeof reader.getPolicy).toBe('function');

        // Collection operations
        expect(typeof reader.getUsersById).toBe('function');
        expect(typeof reader.getGroupsForUser).toBe('function');
        expect(typeof reader.getExpensesForGroup).toBe('function');

        // Transaction operations
        expect(typeof reader.getGroupInTransaction).toBe('function');
        expect(typeof reader.getUserInTransaction).toBe('function');

        // Utility operations
        expect(typeof reader.documentExists).toBe('function');
    });
});

describe('MockFirestoreReader', () => {
    let mockReader: MockFirestoreReader;

    beforeEach(() => {
        mockReader = new MockFirestoreReader();
    });

    test('should be instantiable', () => {
        expect(mockReader).toBeDefined();
    });

    test('should have all mocked methods', () => {
        expect(mockReader.getUser).toBeDefined();
        expect(mockReader.getGroup).toBeDefined();
        expect(mockReader.getExpense).toBeDefined();
        expect(mockReader.getUsersById).toBeDefined();
    });

    test('should provide test utilities', () => {
        expect(typeof mockReader.resetAllMocks).toBe('function');
        expect(typeof mockReader.clearAllMocks).toBe('function');
        expect(typeof mockReader.mockUserExists).toBe('function');
        expect(typeof mockReader.mockGroupExists).toBe('function');
    });

    test('should provide static test builders', () => {
        expect(typeof MockFirestoreReader.createTestUser).toBe('function');
        expect(typeof MockFirestoreReader.createTestGroup).toBe('function');
        expect(typeof MockFirestoreReader.createTestExpense).toBe('function');
    });

    test('static builders should create valid test objects', () => {
        const testUser = MockFirestoreReader.createTestUser('user123');
        expect(testUser.id).toBe('user123');
        expect(testUser.email).toContain('@test.com');

        const testGroup = MockFirestoreReader.createTestGroup('group456');
        expect(testGroup.id).toBe('group456');
        expect(testGroup.name).toContain('Test Group');

        const testExpense = MockFirestoreReader.createTestExpense('expense789');
        expect(testExpense.id).toBe('expense789');
        expect(testExpense.amount).toBe(10.0);
    });

    test('should allow mocking user existence', () => {
        const testUser = MockFirestoreReader.createTestUser('test-user');
        mockReader.mockUserExists('test-user', testUser);

        // Mock is configured, can verify it was set up
        expect(mockReader.getUser).toBeDefined();
    });
});
