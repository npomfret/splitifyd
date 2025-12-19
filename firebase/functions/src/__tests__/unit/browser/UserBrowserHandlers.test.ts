import { toEmail, toTenantId, toUserId } from '@billsplit-wl/shared';
import { UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('UserBrowserHandlers - Integration Tests', () => {
    let appDriver: AppDriver;
    const adminId = toUserId('admin-user');

    beforeEach(() => {
        appDriver = new AppDriver();
        // Set up an admin user for browsing endpoints
        appDriver.seedAdminUser(adminId);
    });

    describe('listAuthUsers', () => {
        it('should list all auth users with default pagination', async () => {
            // Arrange
            const user1 = await appDriver.registerUser(new UserRegistrationBuilder().withEmail('user1@test.com').build());
            const user2 = await appDriver.registerUser(new UserRegistrationBuilder().withEmail('user2@test.com').build());

            // Act
            const result = await appDriver.listAuthUsers({}, adminId);

            // Assert
            expect(result).toBeDefined();
            expect(result.users).toBeDefined();
            expect(result.users).toEqual(
                expect.arrayContaining([
                    // Note: email is intentionally excluded from response for privacy
                    expect.objectContaining({ uid: user1.user.uid, signupTenantId: toTenantId('localhost-tenant') }),
                    expect.objectContaining({ uid: user2.user.uid, signupTenantId: toTenantId('localhost-tenant') }),
                ]),
            );
            expect(result.hasMore).toBe(false);
        });

        it('should filter by email when email query param is provided', async () => {
            // Arrange - admin can search by email (server-side), but email is not returned in response
            const user1 = await appDriver.registerUser(new UserRegistrationBuilder().withEmail('user1@test.com').build());
            await appDriver.registerUser(new UserRegistrationBuilder().withEmail('user2@test.com').build());

            // Act
            const result = await appDriver.listAuthUsers({ email: toEmail('user1@test.com') }, adminId);

            // Assert - email excluded from response for privacy, but search still works
            expect(result.users).toEqual([expect.objectContaining({ uid: user1.user.uid })]);
            expect(result.users[0]).not.toHaveProperty('email');
            expect(result.hasMore).toBe(false);
        });

        it('should filter by uid when uid query param is provided', async () => {
            // Arrange
            const user1 = await appDriver.registerUser(new UserRegistrationBuilder().withEmail('user1@test.com').build());
            await appDriver.registerUser(new UserRegistrationBuilder().withEmail('user2@test.com').build());

            // Act
            const result = await appDriver.listAuthUsers({ uid: user1.user.uid }, adminId);

            // Assert
            expect(result.users).toEqual([expect.objectContaining({ uid: user1.user.uid })]);
            expect(result.hasMore).toBe(false);
        });

        it('should return empty array when user not found by email', async () => {
            // Act
            const result = await appDriver.listAuthUsers({ email: toEmail('nonexistent@test.com') }, adminId);

            // Assert
            expect(result.users).toEqual([]);
            expect(result.hasMore).toBe(false);
        });

        it('should respect limit parameter', async () => {
            // Arrange: Add multiple users
            for (let i = 0; i < 10; i++) {
                await appDriver.registerUser(new UserRegistrationBuilder().withEmail(`user${i}@test.com`).build());
            }

            // Act
            const result = await appDriver.listAuthUsers({ limit: 5 }, adminId);

            // Assert
            expect(result.users.length).toBeLessThanOrEqual(5);
        });
    });

    describe('listFirestoreUsers', () => {
        it('should list all firestore users with default pagination', async () => {
            // Arrange
            const user1 = await appDriver.registerUser(new UserRegistrationBuilder().withEmail('user1@test.com').withDisplayName('User One').build());
            const user2 = await appDriver.registerUser(new UserRegistrationBuilder().withEmail('user2@test.com').withDisplayName('User Two').build());

            // Act
            const result = await appDriver.listFirestoreUsers({}, adminId);

            // Assert
            expect(result.users).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ uid: user1.user.uid }),
                    expect.objectContaining({ uid: user2.user.uid }),
                ]),
            );
            expect(result.hasMore).toBe(false);
        });

        it('should filter by uid when uid query param is provided', async () => {
            // Arrange
            const user1 = await appDriver.registerUser(new UserRegistrationBuilder().withEmail('user1@test.com').build());
            await appDriver.registerUser(new UserRegistrationBuilder().withEmail('user2@test.com').build());

            // Act
            const result = await appDriver.listFirestoreUsers({ uid: user1.user.uid }, adminId);

            // Assert
            expect(result.users).toEqual([expect.objectContaining({ uid: user1.user.uid })]);
            expect(result.hasMore).toBe(false);
        });

        it('should return empty array when uid not found', async () => {
            // Act
            const result = await appDriver.listFirestoreUsers({ uid: toUserId('nonexistent') }, adminId);

            // Assert
            expect(result.users).toEqual([]);
            expect(result.hasMore).toBe(false);
        });

        it('should filter by email when email query param is provided', async () => {
            // Arrange
            await appDriver.registerUser(new UserRegistrationBuilder().withEmail('user1@test.com').build());
            await appDriver.registerUser(new UserRegistrationBuilder().withEmail('user2@test.com').build());

            // Act - email filter returns empty because Firestore user documents don't contain email
            // (email is stored in Firebase Auth, not Firestore)
            const result = await appDriver.listFirestoreUsers({ email: toEmail('user1@test.com') }, adminId);

            // Assert
            expect(result.users).toEqual([]);
            expect(result.hasMore).toBe(false);
        });

        it('should handle pagination with cursor', async () => {
            // Arrange: Add multiple users
            for (let i = 0; i < 5; i++) {
                await appDriver.registerUser(new UserRegistrationBuilder().withEmail(`user${i}@test.com`).build());
            }

            // Act - First request with limit
            const firstResult = await appDriver.listFirestoreUsers({ limit: 2 }, adminId);

            // Assert
            expect(firstResult.users.length).toBeLessThanOrEqual(2);

            // If there's a cursor, test pagination
            if (firstResult.nextCursor) {
                const secondResult = await appDriver.listFirestoreUsers({ limit: 2, cursor: firstResult.nextCursor }, adminId);
                expect(secondResult.users.length).toBeGreaterThan(0);
            }
        });

        it('should respect limit parameter', async () => {
            // Arrange: Add multiple users
            for (let i = 0; i < 10; i++) {
                await appDriver.registerUser(new UserRegistrationBuilder().withEmail(`user${i}@test.com`).build());
            }

            // Act
            const result = await appDriver.listFirestoreUsers({ limit: 5 }, adminId);

            // Assert
            expect(result.users.length).toBeLessThanOrEqual(5);
        });
    });
});
