#!/usr/bin/env npx tsx
/**
 * Promote a user to admin role in the Firebase emulator (dev-only)
 *
 * This script uses the test-pool API endpoint which is only available in emulator mode.
 * For production environments, use the Firebase Console to manually update user roles.
 *
 * Usage:
 *   npx tsx firebase/scripts/dev/promote-user-to-admin.ts <email>
 *
 * Example:
 *   npx tsx firebase/scripts/dev/promote-user-to-admin.ts user@example.com
 */

import { toEmail, toUserId } from '@billsplit-wl/shared';
import { ApiDriver, getApiDriverConfig } from '@billsplit-wl/test-support';

const email = process.argv[2];

if (!email || !email.includes('@')) {
    console.error('❌ Error: Email address is required');
    console.log('\nUsage:');
    console.log('  npx tsx firebase/scripts/dev/promote-user-to-admin.ts <email>');
    console.log('\nExample:');
    console.log('  npx tsx firebase/scripts/dev/promote-user-to-admin.ts user@example.com');
    console.log('\nNote: This script only works with the Firebase emulator.');
    console.log('For production, use the Firebase Console to update user roles.');
    process.exit(1);
}

async function main(): Promise<void> {
    console.log('🔧 Connecting to Firebase emulator...');

    const config = await getApiDriverConfig();
    const driver = new ApiDriver(config);

    // First, find the user by email using the auth emulator
    console.log(`📧 Looking up user: ${email}`);

    // Use the Firebase Auth REST API to find user by email
    const signInUrl = `${config.authBaseUrl}/v1/accounts:signInWithPassword?key=${config.firebaseApiKey}`;

    // We need to get the UID. Try signing in with a dummy password to get the error with UID,
    // or use the listUsers endpoint if available
    // Actually, we need to use the admin browser endpoint which lists users

    // Get an admin token first by signing in as the default admin
    const DEFAULT_ADMIN_EMAIL = 'test1@test.com';
    const DEFAULT_PASSWORD = 'passwordpass';

    let adminToken: string;
    try {
        const signInResponse = await fetch(signInUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: DEFAULT_ADMIN_EMAIL,
                password: DEFAULT_PASSWORD,
                returnSecureToken: true,
            }),
        });

        if (!signInResponse.ok) {
            throw new Error('Default admin user not found. Make sure the emulator is running with seeded data.');
        }

        const signInData = (await signInResponse.json()) as { idToken?: string; };
        if (!signInData.idToken) {
            throw new Error('Failed to get admin token');
        }
        adminToken = signInData.idToken;
    } catch (error) {
        console.error('❌ Failed to sign in as default admin (test1@test.com)');
        console.error('   Make sure the emulator is running and policies have been seeded.');
        throw error;
    }

    // List auth users to find the target user by email (server-side search)
    const authUsers = await driver.listAuthUsers({ email: toEmail(email) }, adminToken);
    // Server filters by email, so first result is the match (if any)
    const targetUser = authUsers.users[0];

    if (!targetUser) {
        console.error(`❌ User not found: ${email}`);
        console.error('   Make sure the user has registered in the emulator.');
        process.exit(1);
    }

    const uid = toUserId(targetUser.uid);
    console.log(`✅ Found user: ${targetUser.displayName} (${uid})`);

    // Promote using the test-pool endpoint
    console.log('👑 Promoting to system_admin...');
    await driver.promoteUserToAdmin(uid);

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ USER PROMOTED TO SYSTEM ADMIN');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log(`  Email: ${email}`);
    console.log(`  User ID: ${uid}`);
    console.log(`  Role: system_admin`);
    console.log('');
    console.log('The user can now access all /admin/* endpoints.');
    console.log('');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('💥 Script failed:', error.message || error);
        process.exit(1);
    });
