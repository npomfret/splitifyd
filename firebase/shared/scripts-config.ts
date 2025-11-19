/**
 * Shared runtime configuration loader for Firebase scripts.
 *
 * This module provides a centralized way to load and validate environment variables
 * for Firebase scripts (not functions - functions use client-config.ts). It eliminates
 * the need for manual .env loading and validation in individual scripts.
 *
 * Usage in scripts:
 * ```typescript
 * import { loadRuntimeConfig, getInstanceEnvironment } from '../shared/scripts-config';
 *
 * // Load and validate environment
 * const config = loadRuntimeConfig();
 * const env = getInstanceEnvironment();
 *
 * console.log(`Running in ${env.environment} mode`);
 * console.log(`Instance: ${config.INSTANCE_MODE}`);
 * ```
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { assertValidInstanceMode, isDevInstanceMode, type InstanceMode } from '../functions/src/shared/instance-mode';

/**
 * Runtime environment variable schema.
 * Focused on variables needed by scripts and runtime configuration.
 *
 * Note: This is a subset of the full envSchema in client-config.ts,
 * containing only the variables needed for runtime behavior (not client config).
 */
const runtimeEnvSchema = z.object({
    INSTANCE_MODE: z
        .string()
        .optional()
        .default('prod')
        .superRefine((value, ctx) => {
            try {
                assertValidInstanceMode(value);
            } catch (error) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        })
        .transform((value) => value as InstanceMode),
    GCLOUD_PROJECT: z.string().optional(),
    FUNCTIONS_EMULATOR: z.string().optional(),
    FIRESTORE_EMULATOR_HOST: z.string().optional(),
    FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
    FIREBASE_STORAGE_EMULATOR_HOST: z.string().optional(),
});

/**
 * Runtime configuration type
 */
export type RuntimeConfig = z.infer<typeof runtimeEnvSchema>;

/**
 * Script environment information
 */
export interface ScriptEnvironment {
    isEmulator: boolean;
    isProduction: boolean;
    environment: 'EMULATOR' | 'PRODUCTION' | 'TEST';
    instanceMode: InstanceMode;
}

/**
 * Load .env file from firebase/functions directory if it exists.
 * This is useful for scripts that need to load environment variables.
 *
 * @param envPath - Optional custom path to .env file
 * @returns true if .env was loaded, false if not found
 */
export function loadEnvFile(envPath?: string): boolean {
    const defaultPath = path.join(__dirname, '../functions/.env');
    const targetPath = envPath ?? defaultPath;

    if (fs.existsSync(targetPath)) {
        dotenv.config({ path: targetPath });
        return true;
    }

    return false;
}

/**
 * Get and validate runtime configuration from environment variables.
 *
 * This function validates process.env against the runtime schema.
 * Call loadEnvFile() first if you need to load from a .env file.
 *
 * @throws {Error} If environment variables fail validation
 */
export function getRuntimeConfig(): RuntimeConfig {
    try {
        return runtimeEnvSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
            throw new Error(`Runtime environment validation failed: ${errorMessages}`);
        }
        throw new Error(`Runtime environment validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Load .env file and return validated runtime configuration.
 * Convenience function that combines loadEnvFile() and getRuntimeConfig().
 *
 * @param envPath - Optional custom path to .env file
 * @throws {Error} If .env file not found or validation fails
 */
export function loadRuntimeConfig(): RuntimeConfig {
    const loaded = loadEnvFile();
    if (!loaded) {
        // Only warn if using default path - custom paths might be intentionally missing
        console.warn('⚠️  .env file not found at default location, using existing environment variables');
    }
    return getRuntimeConfig();
}

/**
 * Get script environment information based on INSTANCE_MODE.
 *
 * This determines whether the script is running against:
 * - Emulator (dev1, dev2, dev3, dev4)
 * - Production (prod)
 * - Test (test)
 *
 * @param config - Optional pre-loaded config. If not provided, will load from environment.
 */
export function getInstanceEnvironment(config?: RuntimeConfig): ScriptEnvironment {
    const cfg = config ?? getRuntimeConfig();
    const mode = cfg.INSTANCE_MODE;
    const isEmulator = isDevInstanceMode(mode);
    const isTest = mode === 'test';
    const isProduction = mode === 'prod';

    return {
        isEmulator,
        isProduction,
        environment: isTest ? 'TEST' : isEmulator ? 'EMULATOR' : 'PRODUCTION',
        instanceMode: mode,
    };
}

/**
 * Require that INSTANCE_MODE is set and valid.
 * Convenience function for scripts that need instance mode validation.
 *
 * @returns The validated instance mode
 * @throws {Error} If INSTANCE_MODE is not set or invalid
 */
export function requireInstanceMode(): InstanceMode {
    const config = getRuntimeConfig();
    return config.INSTANCE_MODE;
}
