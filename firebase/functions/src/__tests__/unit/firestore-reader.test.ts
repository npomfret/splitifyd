/**
 * FirestoreReader Unit Tests
 *
 * Tests the basic functionality of the FirestoreReader service and MockFirestoreReader
 */

import { toGroupId } from '@splitifyd/shared';
import { SplitifydFirestoreTestDatabase } from '@splitifyd/test-support';
import { GroupDTOBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, test } from 'vitest';
import { getAuth, getFirestore } from '../../firebase';
import { Timestamp } from '../../firestore-wrapper';
import { createFirestoreDatabase } from '../../firestore-wrapper';
import { ComponentBuilder } from '../../services/ComponentBuilder';
import { FirestoreReader } from '../../services/firestore';

const identityToolkitConfig = {
    apiKey: 'test-api-key',
    baseUrl: 'https://identitytoolkit.googleapis.com',
};

describe('FirestoreReader', () => {
    const firestore = getFirestore();
    const applicationBuilder = ComponentBuilder.createApplicationBuilder(firestore, getAuth(), identityToolkitConfig);
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

// Note: Tests for the old StubFirestoreReader have been removed as we migrate to SplitifydFirestoreTestDatabase.
// The SplitifydFirestoreTestDatabase is tested implicitly through its usage in service tests.

/**
 * Unit tests for data validation and sanitization logic.
 * These tests cover the business logic that was previously tested in integration tests
 * but can be tested more efficiently as unit tests.
 */
describe('Data Validation and Sanitization - Unit Tests', () => {
    let db: SplitifydFirestoreTestDatabase;
    let firestoreReader: FirestoreReader;

    // Helper to convert ISO strings to Timestamps for Firestore storage
    const convertDatesToTimestamps = (data: any) => {
        const converted = { ...data };
        const dateFields = ['createdAt', 'updatedAt', 'deletedAt'];
        for (const field of dateFields) {
            if (converted[field] && typeof converted[field] === 'string') {
                converted[field] = Timestamp.fromDate(new Date(converted[field]));
            }
        }
        return converted;
    };

    beforeEach(() => {
        db = new SplitifydFirestoreTestDatabase();
        firestoreReader = new FirestoreReader(db);
    });

    describe('Malformed Document Handling', () => {
        test('should reject documents with missing required fields', async () => {
            // Test that the application rejects incomplete documents via validation
            // Start with builder but then remove required fields
            const validGroup = new GroupDTOBuilder()
                .withCreatedBy('user123')
                .build();

            const incompleteGroup = {
                id: 'incomplete-group',
                // Remove required fields to simulate corruption
                createdAt: Timestamp.fromDate(new Date(validGroup.createdAt)),
                updatedAt: Timestamp.now(), // Add required timestamp field
                // Missing name, description, createdBy
            };

            // Don't convert - seed directly with Timestamps
            db.seed('groups/incomplete-group', incompleteGroup);

            // Should reject due to validation errors
            await expect(firestoreReader.getGroup(toGroupId('incomplete-group'))).rejects.toThrow();
        });

        test('should reject documents with wrong data types', async () => {
            // Test that validation rejects wrong data types
            // Start with valid builder data, then corrupt field types
            const validGroup = new GroupDTOBuilder()
                .withName('Valid Group')
                .withDescription('Valid description')
                .withCreatedBy('user123')
                .build();

            const malformedGroup = {
                ...convertDatesToTimestamps(validGroup),
                id: 'malformed-group',
                name: 123, // Should be string
                description: null, // Should be string
                createdBy: [], // Should be string
                permissions: 'not-an-object', // Should be object
                // Keep valid timestamps - we're testing other field types
            };

            // Don't try to convert - seed directly
            db.seed('groups/malformed-group', malformedGroup);

            // Application should reject this via validation
            await expect(firestoreReader.getGroup(toGroupId('malformed-group'))).rejects.toThrow();
        });

        test('should handle completely empty or null documents', async () => {
            // Test edge cases with completely invalid data
            // Don't seed anything - document doesn't exist

            const result = await firestoreReader.getGroup(toGroupId('null-group'));
            expect(result).toBeNull();
        });
    });

    describe('Data Consistency Validation', () => {
        test('should reject invalid timestamp fields', async () => {
            // Test that validation rejects invalid timestamp data
            // Start with valid builder data, then corrupt timestamps
            const validGroup = new GroupDTOBuilder()
                .withName('Bad Timestamps Group')
                .withDescription('Group with invalid timestamps')
                .withCreatedBy('user123')
                .build();

            const groupWithBadTimestamps = {
                ...convertDatesToTimestamps(validGroup),
                id: 'bad-timestamps-group',
                // Keep valid createdAt and updatedAt to pass basic validation
                // Test that the reader rejects invalid timestamp fields
                createdAt: {} as any, // Should be Timestamp or ISO string, not object
            };

            // Don't try to convert - seed directly
            db.seed('groups/bad-timestamps-group', groupWithBadTimestamps);

            // Should reject due to invalid timestamp
            await expect(firestoreReader.getGroup(toGroupId('bad-timestamps-group'))).rejects.toThrow();
        });

        test('should reject groups with unrecognized fields', async () => {
            // Test that Zod schema rejects extra fields
            // Start with valid builder data, then add extra field
            const validGroup = new GroupDTOBuilder()
                .withName('Mixed Validity Group')
                .withDescription('Some fields valid, some invalid')
                .withCreatedBy('user123')
                .build();

            const groupWithExtraField = {
                ...convertDatesToTimestamps(validGroup),
                id: 'mixed-validity-group',
                someExtraField: 'should-be-rejected', // Extra field not in schema
            };

            // Don't try to convert - seed directly
            db.seed('groups/mixed-validity-group', groupWithExtraField);

            // Should reject due to unrecognized key
            await expect(firestoreReader.getGroup(toGroupId('mixed-validity-group'))).rejects.toThrow();
        });
    });

    describe('Performance and Resilience', () => {
        test('should handle bulk operations with mixed data quality', async () => {
            // Test performance with multiple groups having various data issues
            // Use builders for clean test data setup
            const goodGroup1 = new GroupDTOBuilder()
                .withName('Good Group 1')
                .withDescription('Perfectly valid group')
                .withCreatedBy('user123')
                .build();

            const goodGroup2 = new GroupDTOBuilder()
                .withName('Good Group 2')
                .withDescription('Another valid group')
                .withCreatedBy('user456')
                .build();

            const groupData = [
                { ...goodGroup1, id: toGroupId('good-group-1') },
                {
                    ...goodGroup1,
                    id: toGroupId('bad-group-1'),
                    name: 'Bad Group 1',
                    description: 'Group with invalid permissions',
                    permissions: { ...goodGroup1.permissions, expenseEditing: 'invalid-permission' as any },
                },
                { ...goodGroup2, id: toGroupId('good-group-2') },
            ];

            // Set up all groups
            groupData.forEach((group) => {
                db.seed(`groups/${group.id}`, convertDatesToTimestamps(group));
            });

            // Verify all groups can be retrieved without errors
            for (const group of groupData) {
                const result = await firestoreReader.getGroup(group.id);
                expect(result).toBeDefined();
                expect(result!.id).toBe(group.id);
                expect(result!.name).toBe(group.name);
            }
        });
    });
});
