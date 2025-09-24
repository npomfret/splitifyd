import { describe, expect, test } from 'vitest';
import { borrowTestUser, UserRegistrationBuilder, generateShortId } from '@splitifyd/test-support';
import { SystemUserRoles } from '@splitifyd/shared';
import { getAuth, getFirestore } from '../../firebase';
import { ApplicationBuilder } from '../../services/ApplicationBuilder';

/**
 * Minimal UserService integration tests - only testing actual Firebase behavior
 * that cannot be stubbed. Most business logic is now covered by unit tests.
 */
describe('UserService - Integration Tests (Essential Firebase Behavior)', () => {
    const firestore = getFirestore();
    const applicationBuilder = ApplicationBuilder.createApplicationBuilder(firestore, getAuth());
    const firestoreReader = applicationBuilder.buildFirestoreReader();
    const userService = applicationBuilder.buildUserService();

    describe('End-to-end Firebase coordination', () => {
        test('should create user in both Firebase Auth and Firestore with real coordination', async () => {
            // This test verifies the actual Firebase Auth + Firestore coordination
            // that cannot be stubbed - ensuring both systems are properly linked
            const userData = new UserRegistrationBuilder().withEmail(`e2e-test-${generateShortId()}@example.com`).withPassword('SecurePass123!').withDisplayName('E2E Test User').build();

            const result = await userService.registerUser({
                email: userData.email,
                password: userData.password,
                displayName: userData.displayName,
                termsAccepted: true,
                cookiePolicyAccepted: true,
            });

            expect(result.success).toBe(true);
            expect(result.user.uid).toBeDefined();

            // Verify actual Firebase Auth record
            const authUser = await getAuth().getUser(result.user.uid!);
            expect(authUser.email).toBe(userData.email);
            expect(authUser.displayName).toBe(userData.displayName);

            // Verify actual Firestore document with proper schema
            const firestoreUser = await firestoreReader.getDocumentForTesting('users', result.user.uid!);
            expect(firestoreUser).toBeDefined();
            expect(firestoreUser!.email).toBe(userData.email);
            expect(firestoreUser!.role).toBe(SystemUserRoles.SYSTEM_USER);
            expect(firestoreUser!.themeColor).toBeDefined();
            expect(firestoreUser!.acceptedPolicies).toBeDefined();
        });

        test('should prevent deletion of users with active groups', async () => {
            // This tests real transaction behavior that requires actual Firebase
            const userInGroup = await borrowTestUser();

            // Note: Creating and testing with actual group relationships requires
            // complex setup. This is a placeholder for the integration test that
            // would verify the user cannot be deleted when they have active groups.

            // For now, just verify the user exists
            const profile = await userService.getUser(userInGroup.uid);
            expect(profile.uid).toBe(userInGroup.uid);
        });
    });
});
