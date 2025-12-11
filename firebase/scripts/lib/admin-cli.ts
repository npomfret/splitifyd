/**
 * Shared CLI utilities for admin scripts that authenticate against the API.
 *
 * Provides common functionality for scripts like seed-policies.ts and sync-tenant-configs.ts:
 * - API key fetching from bootstrap-config endpoint
 * - Authentication with email/password
 * - ApiDriver creation from base URL
 * - CLI argument parsing helpers
 */
import { type ClientAppConfiguration, SIGN_IN_WITH_PASSWORD_ENDPOINT } from '@billsplit-wl/shared';
import { ApiDriver, type ApiDriverConfig } from '@billsplit-wl/test-support';

/**
 * Admin CLI configuration from command line arguments.
 */
export interface AdminCliConfig {
    baseUrl: string;
    email: string;
    password: string;
}

/**
 * Context object containing authenticated API access.
 */
export interface AdminCliContext {
    apiDriver: ApiDriver;
    adminToken: string;
    config: ApiDriverConfig;
}

/**
 * Parsed CLI arguments with positional args and flags.
 */
export interface ParsedCliArgs {
    positional: string[];
    flags: Map<string, string | true>;
}

/**
 * Option definition for help text.
 */
export interface CliOption {
    flag: string;
    desc: string;
}

/**
 * Fetch Firebase API key from the app's bootstrap-config endpoint.
 */
export async function fetchApiKey(baseUrl: string): Promise<string> {
    const apiUrl = normalizeApiUrl(baseUrl);
    const response = await fetch(`${apiUrl}/bootstrap-config`);
    if (!response.ok) {
        throw new Error(`Failed to fetch bootstrap config from ${apiUrl}/bootstrap-config: ${response.status}`);
    }
    const config: ClientAppConfiguration = await response.json();
    return config.firebase.apiKey;
}

/**
 * Create ApiDriver from base URL by fetching config from bootstrap-config endpoint.
 */
export async function createApiDriverFromUrl(baseUrl: string): Promise<{ apiDriver: ApiDriver; config: ApiDriverConfig }> {
    const apiKey = await fetchApiKey(baseUrl);
    const apiUrl = normalizeApiUrl(baseUrl);

    // Determine auth base URL - use emulator auth if localhost, otherwise production
    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

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
 * Authenticate with email/password via Firebase REST API.
 */
export async function authenticateWithCredentials(
    config: ApiDriverConfig,
    email: string,
    password: string,
): Promise<string> {
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
        const error = (await signInResponse.json()) as { error?: { message?: string } };
        throw new Error(`Authentication failed: ${error.error?.message || 'Unknown error'}`);
    }

    const authData = (await signInResponse.json()) as { idToken: string };
    return authData.idToken;
}

/**
 * Create a fully authenticated admin context from CLI config.
 * Convenience function that combines createApiDriverFromUrl and authenticateWithCredentials.
 */
export async function createAdminContext(opts: AdminCliConfig): Promise<AdminCliContext> {
    const { apiDriver, config } = await createApiDriverFromUrl(opts.baseUrl);
    const adminToken = await authenticateWithCredentials(config, opts.email, opts.password);
    return { apiDriver, adminToken, config };
}

/**
 * Parse CLI arguments into positional args and flags.
 *
 * Flags can be:
 * - Boolean: `--flag` (value is `true`)
 * - Key-value: `--flag value` (value is the next argument)
 */
export function parseCliArgs(args: string[]): ParsedCliArgs {
    const positional: string[] = [];
    const flags = new Map<string, string | true>();

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const flagName = arg.slice(2);
            // Check if next arg exists and is not a flag
            if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
                flags.set(flagName, args[++i]);
            } else {
                flags.set(flagName, true);
            }
        } else {
            positional.push(arg);
        }
    }

    return { positional, flags };
}

/**
 * Show usage information and exit with code 1.
 */
export function showUsageAndExit(
    scriptName: string,
    description: string,
    examples: string[],
    options?: CliOption[],
): never {
    console.error(`Usage: npx tsx scripts/${scriptName} <base-url> <email> <password> [options]`);
    console.error('');
    console.error(description);
    console.error('');
    console.error('Examples:');
    for (const example of examples) {
        console.error(`  ${example}`);
    }
    if (options && options.length > 0) {
        console.error('');
        console.error('Options:');
        for (const opt of options) {
            console.error(`  ${opt.flag.padEnd(24)} ${opt.desc}`);
        }
    }
    process.exit(1);
}

/**
 * Parse base CLI args (base-url, email, password) from command line.
 * Returns null if required args are missing (caller should show usage).
 */
export function parseBaseCliArgs(args: string[]): { config: AdminCliConfig; flags: Map<string, string | true> } | null {
    const parsed = parseCliArgs(args);
    const [baseUrl, email, password] = parsed.positional;

    if (!baseUrl || !email || !password) {
        return null;
    }

    return {
        config: { baseUrl, email, password },
        flags: parsed.flags,
    };
}

/**
 * Normalize base URL to API URL (append /api if needed).
 */
function normalizeApiUrl(baseUrl: string): string {
    return baseUrl.endsWith('/') ? `${baseUrl}api` : `${baseUrl}/api`;
}
