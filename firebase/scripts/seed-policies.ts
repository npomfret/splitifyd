#!/usr/bin/env npx tsx
/**
 * Seed policy documents using the Admin API.
 *
 * Usage:
 *   npx tsx scripts/seed-policies.ts <base-url> <email> <password> [options]
 *
 * Examples:
 *   # Local emulator
 *   npx tsx scripts/seed-policies.ts http://localhost:6005 test1@test.com passwordpass
 *
 *   # Staging/production
 *   npx tsx scripts/seed-policies.ts https://splitifyd.web.app admin@example.com yourpassword
 *
 *   # Single policy
 *   npx tsx scripts/seed-policies.ts http://localhost:6005 test1@test.com passwordpass --policy-id terms-of-service
 *
 * Options:
 *   --policy-id <id>   Only sync specific policy (terms-of-service, cookie-policy, privacy-policy)
 */
import { type PolicyId, PolicyIds, toPolicyId, toPolicyName, toPolicyText } from '@billsplit-wl/shared';
import { ApiDriver } from '@billsplit-wl/test-support';
import * as fs from 'fs';
import * as path from 'path';
import { createAdminContext, parseBaseCliArgs, showUsageAndExit } from './lib/admin-cli';

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
 * Get existing policy if it exists, null otherwise
 */
async function getExistingPolicy(apiDriver: ApiDriver, policyId: PolicyId): Promise<{ currentVersionHash: string; text: string; } | null> {
    try {
        const policy = await apiDriver.getCurrentPolicy(policyId);
        return { currentVersionHash: policy.currentVersionHash, text: policy.text };
    } catch {
        return null;
    }
}

/**
 * Seed a single policy using Admin API (creates or updates)
 */
async function seedPolicy(
    apiDriver: ApiDriver,
    policyId: PolicyId,
    policyName: string,
    filename: string,
    adminToken: string,
): Promise<void> {
    const text = toPolicyText(readPolicyFile(filename));
    const existing = await getExistingPolicy(apiDriver, policyId);

    if (existing) {
        if (existing.text === text) {
            console.log(`  ✓ Policy up to date: ${policyName}`);
            return;
        }

        console.log(`  📝 Updating policy: ${policyName}`);
        const updateResponse = await apiDriver.updatePolicy(
            policyId,
            { text, publish: true },
            adminToken,
        );
        console.log(`     ✓ Updated and published (hash: ${updateResponse.currentVersionHash})`);
    } else {
        console.log(`  📄 Creating policy: ${policyName}`);
        const createResponse = await apiDriver.createPolicy(
            { policyName: toPolicyName(policyName), text },
            adminToken,
        );
        console.log(`     ✓ Created policy: ${createResponse.id}`);

        const publishResponse = await apiDriver.publishPolicy(
            createResponse.id,
            createResponse.versionHash,
            adminToken,
        );
        console.log(`     ✓ Published policy (hash: ${publishResponse.currentVersionHash})`);
    }
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
    policyId?: string;
}

const VALID_POLICY_IDS = [PolicyIds.TERMS_OF_SERVICE, PolicyIds.COOKIE_POLICY, PolicyIds.PRIVACY_POLICY] as const;

function parseArgs(): CliOptions {
    const parsed = parseBaseCliArgs(process.argv.slice(2));

    if (!parsed) {
        showUsageAndExit(
            'seed-policies.ts',
            'Seed policy documents using the Admin API.',
            [
                'npx tsx scripts/seed-policies.ts http://localhost:6005 test1@test.com passwordpass',
                'npx tsx scripts/seed-policies.ts https://splitifyd.web.app admin@example.com yourpassword',
                'npx tsx scripts/seed-policies.ts http://localhost:6005 test1@test.com passwordpass --policy-id terms-of-service',
            ],
            [{ flag: '--policy-id <id>', desc: 'Only sync specific policy (terms-of-service, cookie-policy, privacy-policy)' }],
        );
    }

    const policyId = parsed.flags.get('policy-id');
    if (policyId && typeof policyId === 'string' && !VALID_POLICY_IDS.includes(policyId as typeof VALID_POLICY_IDS[number])) {
        console.error(`Invalid policy ID: ${policyId}`);
        console.error(`Valid IDs: ${VALID_POLICY_IDS.join(', ')}`);
        process.exit(1);
    }

    return {
        ...parsed.config,
        policyId: typeof policyId === 'string' ? policyId : undefined,
    };
}

const POLICY_CONFIGS = [
    { id: PolicyIds.TERMS_OF_SERVICE, name: 'Terms of Service', filename: 'terms-and-conditions.md' },
    { id: PolicyIds.COOKIE_POLICY, name: 'Cookie Policy', filename: 'cookie-policy.md' },
    { id: PolicyIds.PRIVACY_POLICY, name: 'Privacy Policy', filename: 'privacy-policy.md' },
] as const;

async function main(): Promise<void> {
    const { baseUrl, email, password, policyId } = parseArgs();

    console.log(`🎯 Seeding policies to ${baseUrl}`);

    // Filter to single policy if specified
    const policiesToSeed = policyId
        ? POLICY_CONFIGS.filter((p) => p.id === policyId)
        : POLICY_CONFIGS;

    // Verify policy files exist first
    console.log('\n📂 Checking policy files...');
    try {
        for (const policy of policiesToSeed) {
            readPolicyFile(policy.filename);
        }
        console.log(`   ✓ ${policiesToSeed.length} policy document(s) found`);
    } catch (error) {
        throw new Error(`Failed to read policy documents: ${error instanceof Error ? error.message : error}`);
    }

    // Create authenticated context
    console.log(`\n🔑 Authenticating as ${email}...`);
    const { apiDriver, adminToken } = await createAdminContext({ baseUrl, email, password });
    console.log('   ✓ Authenticated');

    // Seed policies
    console.log('\n📚 Seeding policies...');
    for (const policy of policiesToSeed) {
        await seedPolicy(
            apiDriver,
            toPolicyId(policy.id),
            policy.name,
            policy.filename,
            adminToken,
        );
    }

    // Verify policies are accessible
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
