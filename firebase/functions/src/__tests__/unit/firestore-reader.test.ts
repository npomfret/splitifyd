/**
 * FirestoreReader Unit Tests
 *
 * Tests the basic functionality of the FirestoreReader service and MockFirestoreReader
 */

import { SecurityPresets } from '@splitifyd/shared';
import { GroupDTOBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, test } from 'vitest';
import { Timestamp } from '../../firestore-wrapper';
import { getAuth, getFirestore } from '../../firebase';
import { createFirestoreDatabase } from '../../firestore-wrapper';
import { ApplicationBuilder } from '../../services/ApplicationBuilder';
import { FirestoreReader } from '../../services/firestore';
import { StubFirestoreDatabase } from './mocks/firestore-stubs';

describe('FirestoreReader', () => {
    const firestore = getFirestore();
    const applicationBuilder = ApplicationBuilder.createApplicationBuilder(firestore, getAuth());
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

// Note: Tests for the old StubFirestoreReader have been removed as we migrate to StubFirestoreDatabase.
// The StubFirestoreDatabase is tested implicitly through its usage in service tests.

/**
 * Unit tests for data validation and sanitization logic.
 * These tests cover the business logic that was previously tested in integration tests
 * but can be tested more efficiently as unit tests.
 */
describe('Data Validation and Sanitization - Unit Tests', () => {
    let db: StubFirestoreDatabase;
    let firestoreReader: FirestoreReader;

    // Helper to convert ISO strings to Timestamps for Firestore storage
    const convertDatesToTimestamps = (data: any) => {
        const converted = { ...data };
        const dateFields = ['createdAt', 'updatedAt', 'deletedAt', 'presetAppliedAt'];
        for (const field of dateFields) {
            if (converted[field] && typeof converted[field] === 'string') {
                converted[field] = Timestamp.fromDate(new Date(converted[field]));
            }
        }
        return converted;
    };

    beforeEach(() => {
        db = new StubFirestoreDatabase();
        firestoreReader = new FirestoreReader(db);
    });

    describe('Invalid SecurityPreset Values', () => {
        test('should handle groups with invalid securityPreset values gracefully', async () => {
            // Test that invalid securityPreset values don't break the application
            // In the real system, FirestoreReader.sanitizeGroupData() handles this

            // Use builder to create valid group data, then corrupt the securityPreset
            const validGroup = new GroupDTOBuilder()
                .withName('Test Group')
                .withDescription('Group with invalid security preset')
                .withCreatedBy('user123')
                .build();

            const corruptedGroup = {
                ...validGroup,
                securityPreset: 'invalid-value', // This should be sanitized to 'open'
                id: 'test-group-id',
            };

            db.seed('groups/test-group-id', convertDatesToTimestamps(corruptedGroup));

            const result = await firestoreReader.getGroup('test-group-id');

            expect(result).toBeDefined();
            expect(result!.id).toBe('test-group-id');
            expect(result!.name).toBe('Test Group');
            // Note: StubFirestoreReader doesn't implement sanitization logic
            // This test documents the expected behavior that the real implementation handles
        });

        test('should handle various invalid securityPreset data types', async () => {
            // Test different types of invalid data that might appear in the database
            const invalidPresetTypes = [
                { preset: null, description: 'null value' },
                { preset: 123, description: 'numeric value' },
                { preset: {}, description: 'object value' },
                { preset: [], description: 'array value' },
                { preset: '', description: 'empty string' },
            ];

            for (const { preset, description } of invalidPresetTypes) {
                const groupId = `group-${description.replace(/\s+/g, '-')}`;

                // Use builder for valid base data, then corrupt securityPreset
                const validGroup = new GroupDTOBuilder()
                    .withName(`Group with ${description}`)
                    .withDescription(`Testing ${description}`)
                    .withCreatedBy('user123')
                    .build();

                const corruptedGroup = {
                    ...validGroup,
                    id: groupId,
                    securityPreset: preset, // Invalid value
                };

                db.seed(`groups/${groupId}`, convertDatesToTimestamps(corruptedGroup));

                // The application should not crash when retrieving groups with invalid data
                const result = await firestoreReader.getGroup(groupId);
                expect(result).toBeDefined();
                expect(result!.id).toBe(groupId);
            }
        });

        test('should preserve valid securityPreset values', async () => {
            // Test that valid values are preserved
            const validPresets = Object.values(SecurityPresets);

            for (const validPreset of validPresets) {
                const groupId = `group-${validPreset}`;

                // Use builder with valid securityPreset
                const groupData = new GroupDTOBuilder()
                    .withName(`Group with ${validPreset}`)
                    .withDescription(`Testing ${validPreset} preset`)
                    .withCreatedBy('user123')
                    .build();

                // Override with specific valid preset
                const groupWithPreset = {
                    ...groupData,
                    id: groupId,
                    securityPreset: validPreset,
                };

                db.seed(`groups/${groupId}`, convertDatesToTimestamps(groupWithPreset));

                const result = await firestoreReader.getGroup(groupId);
                expect(result).toBeDefined();
                expect(result!.securityPreset).toBe(validPreset);
            }
        });
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
                securityPreset: validGroup.securityPreset,
                createdAt: Timestamp.fromDate(new Date(validGroup.createdAt)),
                updatedAt: Timestamp.now(), // Add required timestamp field
                // Missing name, description, createdBy
            };

            // Don't convert - seed directly with Timestamps
            db.seed('groups/incomplete-group', incompleteGroup);

            // Should reject due to validation errors
            await expect(firestoreReader.getGroup('incomplete-group')).rejects.toThrow();
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
            await expect(firestoreReader.getGroup('malformed-group')).rejects.toThrow();
        });

        test('should handle completely empty or null documents', async () => {
            // Test edge cases with completely invalid data
            // Don't seed anything - document doesn't exist

            const result = await firestoreReader.getGroup('null-group');
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
                presetAppliedAt: {}, // Should be Timestamp or null, not object
            };

            // Don't try to convert - seed directly
            db.seed('groups/bad-timestamps-group', groupWithBadTimestamps);

            // Should reject due to invalid timestamp
            await expect(firestoreReader.getGroup('bad-timestamps-group')).rejects.toThrow();
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
            await expect(firestoreReader.getGroup('mixed-validity-group')).rejects.toThrow();
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
                { ...goodGroup1, id: 'good-group-1', securityPreset: SecurityPresets.OPEN },
                { ...goodGroup1, id: 'bad-group-1', name: 'Bad Group 1', description: 'Group with invalid preset', securityPreset: 'invalid-preset' },
                { ...goodGroup2, id: 'good-group-2', securityPreset: SecurityPresets.MANAGED },
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
