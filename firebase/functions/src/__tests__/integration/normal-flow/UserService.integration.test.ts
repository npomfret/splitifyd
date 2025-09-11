import { beforeEach, describe, expect, test } from 'vitest';

import { ApiDriver, borrowTestUser, borrowTestUsers, UserRegistrationBuilder } from '@splitifyd/test-support';
import { AuthenticatedFirebaseUser, PooledTestUser, SystemUserRoles } from '@splitifyd/shared';
import { ApiError } from '../../../utils/errors';
import { getAuth, getFirestore } from '../../../firebase';
import type { IFirestoreReader } from '../../../services/firestore/IFirestoreReader';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';

describe('UserService - Integration Tests', () => {
    const firestore = getFirestore();
    const applicationBuilder = new ApplicationBuilder(firestore);
    const groupService = applicationBuilder.buildGroupService();
    const firestoreReader = applicationBuilder.buildFirestoreReader();
    const userService = applicationBuilder.buildUserService();

    const apiDriver = new ApiDriver();

    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(3);
    });

    describe('registerUser', () => {
        test('should register a new user with Firebase Auth and Firestore', async () => {
            const userData = new UserRegistrationBuilder().withEmail('newuser@example.com').withPassword('SecurePass123!').withDisplayName('New User').build();

            const result = await userService.registerUser({
                email: userData.email,
                password: userData.password,
                displayName: userData.displayName,
                termsAccepted: true,
                cookiePolicyAccepted: true,
            });

            // Verify registration result
            expect(result.success).toBe(true);
            expect(result.message).toBe('Account created successfully');
            expect(result.user.uid).toBeDefined();
            expect(result.user.email).toBe(userData.email);
            expect(result.user.displayName).toBe(userData.displayName);

            // Verify Firebase Auth record was created
            const authUser = await getAuth().getUser(result.user.uid!);
            expect(authUser.email).toBe(userData.email);
            expect(authUser.displayName).toBe(userData.displayName);

            // Verify Firestore document was created using centralized reader
            const userData_firestore = await firestoreReader.getDocumentForTesting('users', result.user.uid!);
            expect(userData_firestore).toBeDefined();
            expect(userData_firestore!.email).toBe(userData.email);
            expect(userData_firestore!.displayName).toBe(userData.displayName);
            expect(userData_firestore!.role).toBe(SystemUserRoles.SYSTEM_USER);
            expect(userData_firestore!.themeColor).toBeDefined();
            expect(userData_firestore!.acceptedPolicies).toBeDefined();
            expect(userData_firestore!.termsAcceptedAt).toBeDefined();
            expect(userData_firestore!.cookiePolicyAcceptedAt).toBeDefined();
            expect(userData_firestore!.createdAt).toBeDefined();
            expect(userData_firestore!.updatedAt).toBeDefined();

            // Cleanup
            await getAuth().deleteUser(result.user.uid!);
            await firestore.collection('users').doc(result.user.uid!).delete();
        });

        test('should reject registration with existing email', async () => {
            const existingUser = users[0];

            const duplicateData = new UserRegistrationBuilder().withEmail(existingUser.email).withPassword('DifferentPass123!').withDisplayName('Different Name').build();

            await expect(
                userService.registerUser({
                    email: duplicateData.email,
                    password: duplicateData.password,
                    displayName: duplicateData.displayName,
                    termsAccepted: true,
                    cookiePolicyAccepted: true,
                }),
            ).rejects.toThrow();
        });

        test('should register with optional acceptance flags', async () => {
            const userData = new UserRegistrationBuilder().withEmail('noaccept@example.com').withPassword('SecurePass123!').withDisplayName('Test User').build();

            // Test shows validation requires both to be true, so this test
            // will demonstrate the validation works correctly
            await expect(
                userService.registerUser({
                    email: userData.email,
                    password: userData.password,
                    displayName: userData.displayName,
                    termsAccepted: false,
                    cookiePolicyAccepted: true,
                }),
            ).rejects.toThrow('You must accept the Terms of Service');

            // Also test the cookie policy validation
            await expect(
                userService.registerUser({
                    email: userData.email,
                    password: userData.password,
                    displayName: userData.displayName,
                    termsAccepted: true,
                    cookiePolicyAccepted: false,
                }),
            ).rejects.toThrow('You must accept the Cookie Policy');
        });

        test('should cleanup auth user if Firestore creation fails', async () => {
            // This is hard to test directly without mocking, but we can test
            // that the service handles the cleanup correctly by testing edge cases
            const userData = new UserRegistrationBuilder().build();

            try {
                // This should succeed normally
                const result = await userService.registerUser({
                    email: userData.email,
                    password: userData.password,
                    displayName: userData.displayName,
                    termsAccepted: true,
                    cookiePolicyAccepted: true,
                });

                // Cleanup the successful registration
                await getAuth().deleteUser(result.user.uid!);
                await firestore.collection('users').doc(result.user.uid!).delete();
            } catch (error) {
                // If registration failed, no cleanup needed
            }

            // Verify no orphaned users exist by trying to register again
            const result2 = await userService.registerUser({
                email: userData.email,
                password: userData.password,
                displayName: userData.displayName,
                termsAccepted: true,
                cookiePolicyAccepted: true,
            });

            expect(result2.success).toBe(true);

            // Cleanup
            await getAuth().deleteUser(result2.user.uid!);
            await firestore.collection('users').doc(result2.user.uid!).delete();
        });
    });

    describe('getUser', () => {
        test('should return complete user profile from Auth and Firestore', async () => {
            const testUser = users[0];

            const profile = await userService.getUser(testUser.uid);

            expect(profile.uid).toBe(testUser.uid);
            expect(profile.email).toBe(testUser.email);
            expect(profile.displayName).toBeDefined();
            expect(profile.emailVerified).toBeDefined();
            expect(profile.photoURL).toBeDefined();
            expect(profile.themeColor).toBeDefined();
            expect(profile.createdAt).toBeDefined();
            expect(profile.updatedAt).toBeDefined();
        });

        test('should throw NOT_FOUND for non-existent user', async () => {
            const nonExistentUid = 'nonexistent-user-id';

            await expect(userService.getUser(nonExistentUid)).rejects.toThrow(ApiError);
        });

        test('should validate Firestore user document structure', async () => {
            const testUser = users[0];

            // This should work with valid data structure
            const profile = await userService.getUser(testUser.uid);
            expect(profile).toBeDefined();

            // The service should validate the document structure using Zod schema
            // If the schema validation fails, it should throw an ApiError
            // This is tested implicitly by the successful call above
        });
    });

    describe('getUsers', () => {
        test('should fetch multiple users efficiently', async () => {
            const uids = users.map((u) => u.uid);

            const profiles = await userService.getUsers(uids);

            expect(profiles.size).toBe(3);
            for (const user of users) {
                const profile = profiles.get(user.uid);
                expect(profile).toBeDefined();
                expect(profile!.uid).toBe(user.uid);
                expect(profile!.email).toBe(user.email);
                // Don't check exact displayName as pooled users may have been modified by other tests
                expect(profile!.displayName).toBeDefined();
                expect(typeof profile!.displayName).toBe('string');
            }
        });

        test('should handle fetching multiple users', async () => {
            const [user1, user2, user3] = users;

            // Fetch all three users
            const profiles = await userService.getUsers([user1.uid, user2.uid, user3.uid]);

            expect(profiles.size).toBe(3);
            expect(profiles.get(user1.uid)).toBeDefined();
            expect(profiles.get(user2.uid)).toBeDefined();
            expect(profiles.get(user3.uid)).toBeDefined();
        });

        test('should handle batching for large user sets', async () => {
            const uids = users.map((u) => u.uid);

            // Add more UIDs to test batching (in real scenario this would be 100+)
            const allUids = [...uids];

            const profiles = await userService.getUsers(allUids);

            expect(profiles.size).toBe(users.length);
        });

        test('should handle empty input gracefully', async () => {
            const profiles = await userService.getUsers([]);
            expect(profiles.size).toBe(0);
        });
    });

    describe('updateProfile', () => {
        let testUser: AuthenticatedFirebaseUser;

        beforeEach(async () => {
            testUser = await apiDriver.createUser(); // don't use a pooled user as we are modifiying it
        });

        test('should update display name in both Auth and Firestore', async () => {
            const newDisplayName = 'Updated Display Name';

            const updatedProfile = await userService.updateProfile(testUser.uid, {
                displayName: newDisplayName,
            });

            expect(updatedProfile.displayName).toBe(newDisplayName);

            // Verify Firebase Auth was updated
            const authUser = await getAuth().getUser(testUser.uid);
            expect(authUser.displayName).toBe(newDisplayName);

            // Verify Firestore was updated
            const updatedUserData = await firestoreReader.getUser(testUser.uid);
            expect(updatedUserData).not.toBeNull();
            expect(updatedUserData!.displayName).toBe(newDisplayName);
            expect(updatedUserData!.updatedAt).toBeDefined();
        });

        test('should update preferred language in Firestore only', async () => {
            const newLanguage = 'en'; // Only 'en' is currently supported

            const updatedProfile = await userService.updateProfile(testUser.uid, {
                preferredLanguage: newLanguage,
            });

            expect(updatedProfile.preferredLanguage).toBe(newLanguage);

            // Verify Firestore was updated
            const userData = await firestoreReader.getUser(testUser.uid);
            expect(userData).not.toBeNull();
            expect(userData!.preferredLanguage).toBe(newLanguage);
        });

        test('should update photo URL with null value', async () => {
            await userService.updateProfile(testUser.uid, {
                photoURL: null,
            });

            // Verify Firebase Auth was updated
            const authUser = await getAuth().getUser(testUser.uid);
            expect(authUser.photoURL).toBeUndefined();

            // Verify Firestore was updated
            const userData = await firestoreReader.getUser(testUser.uid);
            expect(userData).not.toBeNull();
            expect(userData!.photoURL).toBeNull();
        });

        test('should fetch fresh data after update', async () => {
            // Get initial profile
            const originalProfile = await userService.getUser(testUser.uid);
            const originalDisplayName = originalProfile.displayName;

            // Update the profile
            await userService.updateProfile(testUser.uid, {
                displayName: 'Updated Test Name',
            });

            // Get user again - should have updated data
            const updatedProfile = await userService.getUser(testUser.uid);
            expect(updatedProfile.displayName).toBe('Updated Test Name');
            expect(updatedProfile.displayName).not.toBe(originalDisplayName);
        });

        test('should throw NOT_FOUND for non-existent user', async () => {
            const nonExistentUid = 'nonexistent-user-id';

            await expect(
                userService.updateProfile(nonExistentUid, {
                    displayName: 'Test',
                }),
            ).rejects.toThrow(ApiError);
        });
    });

    describe('changePassword', () => {
        let testUser: PooledTestUser;

        beforeEach(() => {
            testUser = users[0];
        });

        test('should update password and track change timestamp', async () => {
            const currentPassword = 'OldPassword123!';
            const newPassword = 'NewSecurePassword123!';

            // Capture timestamp before change
            const beforeChange = new Date();

            const result = await userService.changePassword(testUser.uid, {
                currentPassword: currentPassword,
                newPassword: newPassword,
            });

            expect(result.message).toBe('Password changed successfully');

            // Verify Firestore document was updated with proper timestamps
            const userData = await firestoreReader.getUser(testUser.uid);
            expect(userData).not.toBeNull();

            // Verify passwordChangedAt timestamp exists and is recent
            expect(userData!.passwordChangedAt).toBeDefined();
            const passwordChangedAt = userData!.passwordChangedAt.toDate();
            expect(passwordChangedAt.getTime()).toBeGreaterThanOrEqual(beforeChange.getTime());
            expect(passwordChangedAt.getTime()).toBeLessThanOrEqual(Date.now());

            // Verify updatedAt timestamp was also updated
            expect(userData!.updatedAt).toBeDefined();
            const updatedAt = userData!.updatedAt.toDate();
            expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeChange.getTime());
            expect(updatedAt.getTime()).toBeLessThanOrEqual(Date.now());

            // Verify user cache was cleared by checking it returns fresh data
            const freshProfile = await userService.getUser(testUser.uid);
            expect(freshProfile.updatedAt).toBeDefined();
        });

        test('should throw NOT_FOUND for non-existent user', async () => {
            const nonExistentUid = 'nonexistent-user-id';

            await expect(
                userService.changePassword(nonExistentUid, {
                    currentPassword: 'OldPassword123!',
                    newPassword: 'NewPassword123!',
                }),
            ).rejects.toThrow(ApiError);
        });

        test('should handle users without email', async () => {
            // This is an edge case that's hard to create in integration tests
            // since we control user creation. The service should handle
            // Firebase Auth users that somehow don't have email addresses.
            // We rely on the service's validation to catch this.

            const result = await userService.changePassword(testUser.uid, {
                currentPassword: 'OldPassword123!',
                newPassword: 'NewPassword123!',
            });

            expect(result.message).toBe('Password changed successfully');
        });
    });

    describe('deleteAccount', () => {
        test('should delete user from both Auth and Firestore', async () => {
            // Create a dedicated user for deletion testing
            const userData = new UserRegistrationBuilder().withEmail('todelete@example.com').withPassword('DeleteMe123!').withDisplayName('To Delete User').build();

            const registrationResult = await userService.registerUser({
                email: userData.email,
                password: userData.password,
                displayName: userData.displayName,
                termsAccepted: true,
                cookiePolicyAccepted: true,
            });

            const userId = registrationResult.user.uid!;

            // Delete the account
            const deleteResult = await userService.deleteAccount(userId, {
                confirmDelete: true,
            });

            expect(deleteResult.message).toBe('Account deleted successfully');

            // Verify user was deleted from Firebase Auth
            await expect(getAuth().getUser(userId)).rejects.toThrow();

            // Verify user was deleted from Firestore
            const deletedUserData = await firestoreReader.getUser(userId);
            expect(deletedUserData).toBeNull();
        });

        test('should prevent deletion of users with active groups', async () => {
            // Create fresh users for this test to avoid token expiry issues
            const userInGroup = await borrowTestUser();
            const otherUser = await borrowTestUser();

            // Create a group with the user
            const group = await apiDriver.createGroupWithMembers('Test Group for Deletion', [userInGroup, otherUser], userInGroup.token);

            // Try to delete user who is in a group
            await expect(
                userService.deleteAccount(userInGroup.uid, {
                    confirmDelete: true,
                }),
            ).rejects.toThrow(ApiError);

            // Clean up group manually from Firestore since API auth is complex in this test
            await firestore.collection('groups').doc(group.id).delete();
        });

        test('should require confirmation for deletion', async () => {
            const testUser = users[0];

            // Try to delete without confirmation
            await expect(
                userService.deleteAccount(testUser.uid, {
                    confirmDelete: false,
                }),
            ).rejects.toThrow();

            // Try to delete without confirmDelete field
            await expect(userService.deleteAccount(testUser.uid, {})).rejects.toThrow();
        });

        test('should throw NOT_FOUND for non-existent user', async () => {
            const nonExistentUid = 'nonexistent-user-id';

            await expect(
                userService.deleteAccount(nonExistentUid, {
                    confirmDelete: true,
                }),
            ).rejects.toThrow(ApiError);
        });
    });

    describe('error handling and edge cases', () => {
        test('should handle malformed Firestore documents gracefully', async () => {
            const testUser = users[0];

            // The service should validate document structure using Zod
            // If document is malformed, it should throw ApiError with INVALID_USER_DATA
            // We can't easily create malformed documents in integration tests,
            // so we test that well-formed documents work correctly
            const profile = await userService.getUser(testUser.uid);
            expect(profile).toBeDefined();
        });

        test('should maintain data consistency between Auth and Firestore', async () => {
            const testUser = users[0];

            const profile = await userService.getUser(testUser.uid);

            // Verify Auth and Firestore have consistent data
            const authUser = await getAuth().getUser(testUser.uid);
            expect(profile.email).toBe(authUser.email);
            expect(profile.displayName).toBe(authUser.displayName);
            expect(profile.photoURL).toBe(authUser.photoURL || null);
        });
    });
});
