#!/usr/bin/env npx tsx
/**
 * Seed policy documents using the Admin API.
 *
 * Usage:
 *   npx tsx scripts/seed-policies.ts <base-url> <email> <password>
 *
 * Examples:
 *   # Local emulator
 *   npx tsx scripts/seed-policies.ts http://localhost:6005 test1@test.com passwordpass
 *
 *   # Staging/production
 *   npx tsx scripts/seed-policies.ts https://splitifyd.web.app admin@example.com yourpassword
 */
import {
    type ClientAppConfiguration,
    type PolicyId,
    PolicyIds,
    SIGN_IN_WITH_PASSWORD_ENDPOINT,
    toPolicyId,
    toPolicyName,
    toPolicyText,
} from '@billsplit-wl/shared';
import { ApiDriver, type ApiDriverConfig } from '@billsplit-wl/test-support';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Fetch Firebase API key from the bootstrap-config endpoint
 */
async function fetchApiKey(baseUrl: string): Promise<string> {
    const apiUrl = baseUrl.endsWith('/') ? `${baseUrl}api` : `${baseUrl}/api`;
    const response = await fetch(`${apiUrl}/bootstrap-config`);
    if (!response.ok) {
        throw new Error(`Failed to fetch bootstrap config from ${apiUrl}/bootstrap-config: ${response.status}`);
    }
    const config: ClientAppConfiguration = await response.json();
    return config.firebase.apiKey;
}

/**
 * Authenticate with email/password and return ID token
 */
async function authenticateWithCredentials(config: ApiDriverConfig, email: string, password: string): Promise<string> {
    const signInResponse = await fetch(`${config.authBaseUrl}${SIGN_IN_WITH_PASSWORD_ENDPOINT}?key=${config.firebaseApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email,
            password,
            returnSecureToken: true,
        }),
    });

    if (!signInResponse.ok) {
        const error = (await signInResponse.json()) as { error?: { message?: string; }; };
        throw new Error(`Authentication failed: ${error.error?.message || 'Unknown error'}`);
    }

    const authData = (await signInResponse.json()) as { idToken: string; };
    return authData.idToken;
}

/**
 * Create ApiDriver from base URL by fetching config from bootstrap-config endpoint.
 */
async function createApiDriverFromUrl(baseUrl: string): Promise<{ apiDriver: ApiDriver; config: ApiDriverConfig; }> {
    const apiKey = await fetchApiKey(baseUrl);
    const apiUrl = baseUrl.endsWith('/') ? `${baseUrl}api` : `${baseUrl}/api`;

    // Determine auth base URL - use emulator auth if localhost, otherwise production
    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

    // For localhost, we need to fetch the full config to get the auth emulator URL
    let authBaseUrl = 'https://identitytoolkit.googleapis.com';
    if (isLocalhost) {
        const configResponse = await fetch(`${apiUrl}/bootstrap-config`);
        if (configResponse.ok) {
            const appConfig: ClientAppConfiguration = await configResponse.json();
            if (appConfig.firebaseAuthUrl) {
                authBaseUrl = `${appConfig.firebaseAuthUrl}/identitytoolkit.googleapis.com`;
            }
        }
    }

    const driverConfig: ApiDriverConfig = {
        baseUrl: apiUrl,
        firebaseApiKey: apiKey,
        authBaseUrl,
    };
    return { apiDriver: new ApiDriver(driverConfig), config: driverConfig };
}

/**
 * Read policy file from docs/policies directory
 */
function readPolicyFile(filename: string): string {
    const policyPath = path.join(__dirname, '../docs/policies', filename);
    try {
        return fs.readFileSync(policyPath, 'utf8');
    } catch (error) {
        console.error(`Error reading policy file ${filename}:`, error);
        throw error;
    }
}

/**
 * Check if a policy already exists
 */
async function policyExists(apiDriver: ApiDriver, policyId: PolicyId): Promise<boolean> {
    try {
        await apiDriver.getCurrentPolicy(policyId);
        return true;
    } catch {
        return false;
    }
}

/**
 * Seed a single policy using Admin API
 */
async function seedPolicy(
    apiDriver: ApiDriver,
    policyId: PolicyId,
    policyName: string,
    filename: string,
    adminToken: string,
): Promise<void> {
    // Check if policy already exists
    if (await policyExists(apiDriver, policyId)) {
        console.log(`  ⏭️  Policy already exists: ${policyName}`);
        return;
    }

    console.log(`  📄 Creating policy: ${policyName}`);

    // Read policy text
    const text = toPolicyText(readPolicyFile(filename));

    // Create policy via Admin API
    const createResponse = await apiDriver.createPolicy(
        { policyName: toPolicyName(policyName), text },
        adminToken,
    );
    console.log(`     ✓ Created policy: ${createResponse.id}`);

    // Publish the policy
    const publishResponse = await apiDriver.publishPolicy(
        createResponse.id,
        createResponse.versionHash,
        adminToken,
    );
    console.log(`     ✓ Published policy (hash: ${publishResponse.currentVersionHash})`);
}

/**
 * Verify policies are accessible via public API
 */
async function verifyPolicies(apiDriver: ApiDriver): Promise<void> {
    console.log('\n🔍 Verifying policies via public API...');

    const policyIds = [PolicyIds.TERMS_OF_SERVICE, PolicyIds.COOKIE_POLICY, PolicyIds.PRIVACY_POLICY];

    for (const policyId of policyIds) {
        const policy = await apiDriver.getCurrentPolicy(policyId);
        console.log(`   ✓ ${policy.policyName}: ${policy.text.length} chars`);
    }
}

interface CliOptions {
    baseUrl: string;
    email: string;
    password: string;
}

function parseArgs(): CliOptions {
    const args = process.argv.slice(2);
    const [baseUrl, email, password] = args;

    if (!baseUrl || !email || !password) {
        console.error('Usage: npx tsx scripts/seed-policies.ts <base-url> <email> <password>');
        console.error('');
        console.error('Examples:');
        console.error('  npx tsx scripts/seed-policies.ts http://localhost:6005 test1@test.com passwordpass');
        console.error('  npx tsx scripts/seed-policies.ts https://splitifyd.web.app admin@example.com yourpassword');
        process.exit(1);
    }

    return { baseUrl, email, password };
}

async function main(): Promise<void> {
    const { baseUrl, email, password } = parseArgs();

    console.log(`🎯 Seeding policies to ${baseUrl}`);

    // Verify all policy files exist first
    console.log('\n📂 Checking policy files...');
    try {
        readPolicyFile('terms-and-conditions.md');
        readPolicyFile('cookie-policy.md');
        readPolicyFile('privacy-policy.md');
        console.log('   ✓ All policy documents found');
    } catch (error) {
        throw new Error(`Failed to read policy documents: ${error instanceof Error ? error.message : error}`);
    }

    // Create ApiDriver from base URL
    const { apiDriver, config } = await createApiDriverFromUrl(baseUrl);

    // Authenticate with provided credentials
    console.log(`\n🔑 Authenticating as ${email}...`);
    const token = await authenticateWithCredentials(config, email, password);
    console.log('   ✓ Authenticated');

    // Seed all policies
    console.log('\n📚 Seeding policies...');
    await seedPolicy(
        apiDriver,
        toPolicyId(PolicyIds.TERMS_OF_SERVICE),
        'Terms of Service',
        'terms-and-conditions.md',
        token,
    );
    await seedPolicy(
        apiDriver,
        toPolicyId(PolicyIds.COOKIE_POLICY),
        'Cookie Policy',
        'cookie-policy.md',
        token,
    );
    await seedPolicy(
        apiDriver,
        toPolicyId(PolicyIds.PRIVACY_POLICY),
        'Privacy Policy',
        'privacy-policy.md',
        token,
    );

    // Verify all policies are accessible
    await verifyPolicies(apiDriver);

    console.log('\n🎉 Policy seeding completed successfully!');
}

/**
 * Seed policies for local emulator using default admin credentials.
 * Used by start-with-data.ts for local development.
 *
 * IMPORTANT: The admin user must already exist before calling this function.
 * Use ensureAdminUser() from start-with-data.ts to create the admin first.
 */
export async function seedPolicies(): Promise<void> {
    const { emulatorHostingURL } = await import('@billsplit-wl/test-support');
    const { ApiDriver } = await import('@billsplit-wl/test-support');

    const baseUrl = emulatorHostingURL();
    console.log(`🎯 Seeding policies to local emulator at ${baseUrl}`);

    // Verify all policy files exist first
    console.log('\n📂 Checking policy files...');
    readPolicyFile('terms-and-conditions.md');
    readPolicyFile('cookie-policy.md');
    readPolicyFile('privacy-policy.md');
    console.log('   ✓ All policy documents found');

    // Create ApiDriver for emulator
    const apiDriver = await ApiDriver.create();

    // Get admin user (must already exist - created by ensureAdminUser in start-with-data.ts)
    console.log('\n🔑 Authenticating admin user...');
    const admin = await apiDriver.getDefaultAdminUser();
    console.log(`   ✓ Authenticated as ${admin.email}`);

    // Seed all policies
    console.log('\n📚 Seeding policies...');
    await seedPolicy(
        apiDriver,
        toPolicyId(PolicyIds.TERMS_OF_SERVICE),
        'Terms of Service',
        'terms-and-conditions.md',
        admin.token,
    );
    await seedPolicy(
        apiDriver,
        toPolicyId(PolicyIds.COOKIE_POLICY),
        'Cookie Policy',
        'cookie-policy.md',
        admin.token,
    );
    await seedPolicy(
        apiDriver,
        toPolicyId(PolicyIds.PRIVACY_POLICY),
        'Privacy Policy',
        'privacy-policy.md',
        admin.token,
    );

    // Verify all policies are accessible
    await verifyPolicies(apiDriver);

    console.log('\n🎉 Policy seeding completed successfully!');
}

// Run CLI if executed directly
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Policy seeding failed:', error);
        process.exit(1);
    });
}
