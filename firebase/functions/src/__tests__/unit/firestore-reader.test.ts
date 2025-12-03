/**
 * FirestoreReader Unit Tests
 *
 * Tests the basic functionality of the FirestoreReader service.
 * Uses the firebase-simulator stubs for in-memory testing without the emulator.
 */

import { StubCloudTasksClient, StubFirestoreDatabase, StubStorage } from 'ts-firebase-simulator';
import { describe, expect, test } from 'vitest';
import { ComponentBuilder } from '../../services/ComponentBuilder';
import { FirestoreReader } from '../../services/firestore';
import { createUnitTestServiceConfig } from '../test-config';
import { StubAuthService } from './mocks/StubAuthService';

describe('FirestoreReader', () => {
    const db = new StubFirestoreDatabase();
    const storage = new StubStorage({ defaultBucketName: 'test-bucket' });
    const authService = new StubAuthService();

    const applicationBuilder = new ComponentBuilder(
        authService,
        db,
        storage,
        new StubCloudTasksClient(),
        createUnitTestServiceConfig(),
    );
    const firestoreReader = applicationBuilder.buildFirestoreReader();

    test('should be instantiable', () => {
        const reader = new FirestoreReader(new StubFirestoreDatabase());
        expect(reader).toBeDefined();
        expect(typeof reader.getUser).toBe('function');
        expect(typeof reader.getGroup).toBe('function');
    });

    test('should be available via ComponentBuilder', () => {
        const reader = firestoreReader;
        expect(reader).toBeDefined();
        expect(typeof reader.getUser).toBe('function');
    });

    test('should have all required interface methods', () => {
        const reader = new FirestoreReader(new StubFirestoreDatabase());

        // Document operations
        expect(typeof reader.getUser).toBe('function');
        expect(typeof reader.getGroup).toBe('function');
        expect(typeof reader.getExpense).toBe('function');
        expect(typeof reader.getSettlement).toBe('function');
        expect(typeof reader.getPolicy).toBe('function');

        // Collection operations
        expect(typeof reader.getGroupsForUserV2).toBe('function');
    });
});
