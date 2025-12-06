/**
 * FirestoreReader Admin Browser Methods Unit Tests
 *
 * Tests the listUserDocuments method used by UserBrowserHandlers.
 * Uses StubFirestoreDatabase (in-memory) to avoid emulator dependency.
 */

import { SystemUserRoles, toUserId } from '@billsplit-wl/shared';
import { UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('FirestoreReader Admin Browser Methods', () => {
    let appDriver: AppDriver;

    beforeEach(async () => {
        appDriver = new AppDriver();
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('listUserDocuments', () => {
        test('should return empty list when no users exist', async () => {
            const firestoreReader = appDriver.componentBuilder.buildFirestoreReader();
            const result = await firestoreReader.listUserDocuments({ limit: 10 });

            expect(result.users).toHaveLength(0);
            expect(result.hasMore).toBe(false);
            expect(result.nextCursor).toBeUndefined();
        });

        test('should return users with pagination', async () => {
            // Create 5 users
            for (let i = 0; i < 5; i++) {
                const registration = new UserRegistrationBuilder()
                    .withDisplayName(`User ${i}`)
                    .withEmail(`user${i}@example.com`)
                    .withPassword('password123456')
                    .build();
                await appDriver.registerUser(registration);
            }

            const firestoreReader = appDriver.componentBuilder.buildFirestoreReader();

            // Get first page
            const firstPage = await firestoreReader.listUserDocuments({ limit: 2 });
            expect(firstPage.users).toHaveLength(2);
            expect(firstPage.hasMore).toBe(true);
            expect(firstPage.nextCursor).toBeDefined();

            // Get second page
            const secondPage = await firestoreReader.listUserDocuments({
                limit: 2,
                cursor: firstPage.nextCursor,
            });
            expect(secondPage.users).toHaveLength(2);
            expect(secondPage.hasMore).toBe(true);

            // Get final page
            const finalPage = await firestoreReader.listUserDocuments({
                limit: 2,
                cursor: secondPage.nextCursor,
            });
            expect(finalPage.users).toHaveLength(1);
            expect(finalPage.hasMore).toBe(false);
        });

        test('should handle limit larger than total users', async () => {
            // Create 2 users
            for (let i = 0; i < 2; i++) {
                const registration = new UserRegistrationBuilder()
                    .withDisplayName(`User ${i}`)
                    .withEmail(`user${i}@example.com`)
                    .withPassword('password123456')
                    .build();
                await appDriver.registerUser(registration);
            }

            const firestoreReader = appDriver.componentBuilder.buildFirestoreReader();
            const result = await firestoreReader.listUserDocuments({ limit: 100 });

            expect(result.users).toHaveLength(2);
            expect(result.hasMore).toBe(false);
            expect(result.nextCursor).toBeUndefined();
        });

        test('should return validated user documents with correct structure', async () => {
            const registration = new UserRegistrationBuilder()
                .withDisplayName('Test User')
                .withEmail('test@example.com')
                .withPassword('password123456')
                .build();
            const registered = await appDriver.registerUser(registration);

            const firestoreReader = appDriver.componentBuilder.buildFirestoreReader();
            const result = await firestoreReader.listUserDocuments({ limit: 10 });

            expect(result.users).toHaveLength(1);
            const user = result.users[0];
            expect(user.id).toBe(registered.user.uid);
            expect(user.role).toBe(SystemUserRoles.SYSTEM_USER);
            expect(user.createdAt).toBeDefined();
            expect(user.updatedAt).toBeDefined();
        });
    });

    describe('integration with UserBrowserHandlers pattern', () => {
        test('should support the full user listing workflow', async () => {
            // Register users
            const emails = ['alice@test.com', 'bob@test.com', 'carol@test.com'];
            const userIds: string[] = [];
            for (const email of emails) {
                const registration = new UserRegistrationBuilder()
                    .withDisplayName(email.split('@')[0])
                    .withEmail(email)
                    .withPassword('password123456')
                    .build();
                const result = await appDriver.registerUser(registration);
                userIds.push(result.user.uid);
            }

            const firestoreReader = appDriver.componentBuilder.buildFirestoreReader();

            // 1. List all users
            const allUsers = await firestoreReader.listUserDocuments({ limit: 100 });
            expect(allUsers.users).toHaveLength(3);

            // 2. Get specific user by ID (existing getUser method)
            const bobUser = await firestoreReader.getUser(toUserId(userIds[1]));
            expect(bobUser).not.toBeNull();
            expect(bobUser!.id).toBe(userIds[1]);
            expect(bobUser!.role).toBe(SystemUserRoles.SYSTEM_USER);
        });

        test('should support iterating through all users with pagination', async () => {
            // Register 7 users
            for (let i = 0; i < 7; i++) {
                const registration = new UserRegistrationBuilder()
                    .withDisplayName(`User ${i}`)
                    .withEmail(`user${i}@example.com`)
                    .withPassword('password123456')
                    .build();
                await appDriver.registerUser(registration);
            }

            const firestoreReader = appDriver.componentBuilder.buildFirestoreReader();

            // Iterate through all users using pagination
            const allUserIds = new Set<string>();
            let cursor: string | undefined;
            let pageCount = 0;

            do {
                const page = await firestoreReader.listUserDocuments({
                    limit: 3,
                    cursor,
                });
                page.users.forEach((u) => allUserIds.add(u.id));
                cursor = page.nextCursor;
                pageCount++;

                // Prevent infinite loop
                if (pageCount > 10) break;
            } while (cursor);

            // Should have collected all 7 unique users
            expect(allUserIds.size).toBe(7);
            expect(pageCount).toBeLessThanOrEqual(3); // ceil(7/3) = 3 pages
        });
    });
});
