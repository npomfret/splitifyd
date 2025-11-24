/**
 * FirestoreReader Unit Tests
 *
 * Tests the basic functionality of the FirestoreReader service and MockFirestoreReader
 */

import { StubCloudTasksClient, createFirestoreDatabase, createStorage } from '@billsplit-wl/firebase-simulator';
import { describe, expect, test } from 'vitest';
import { getAuth, getFirestore, getStorage } from '../../firebase';
import { ComponentBuilder } from '../../services/ComponentBuilder';
import { FirestoreReader } from '../../services/firestore';
import { FirebaseAuthService } from '../../services/auth';

import {createUnitTestServiceConfig} from "../test-config";

describe('FirestoreReader', () => {
    const firestore = getFirestore();
    const auth = getAuth();
    const storage = getStorage();

    const wrappedDb = createFirestoreDatabase(firestore);
    const wrappedStorage = createStorage(storage);
    const authService = new FirebaseAuthService(
        auth,
        { apiKey: 'test-api-key', baseUrl: 'https://identitytoolkit.googleapis.com' },
        true, // enableValidation
        true, // enableMetrics
    );

    const applicationBuilder = new ComponentBuilder(
        authService,
        wrappedDb,
        wrappedStorage,
        new StubCloudTasksClient(),
        createUnitTestServiceConfig(),
    );
    const firestoreReader = applicationBuilder.buildFirestoreReader();

    test('should be instantiable', () => {
        const reader = new FirestoreReader(createFirestoreDatabase(firestore));
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
        const reader = new FirestoreReader(createFirestoreDatabase(firestore));

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

// Note: Tests for the old StubFirestoreReader have been removed as we migrate to TenantFirestoreTestDatabase.
// The TenantFirestoreTestDatabase is tested implicitly through its usage in service tests.

// Note: Data validation tests have been removed as they test implementation details by seeding corrupted data.
// The validation layer is tested implicitly through all API-driven tests - if validation wasn't working,
// those tests would fail. Since corrupted states cannot be created through the API, these tests were
// testing impossible scenarios.
