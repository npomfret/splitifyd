/**
 * Shared runtime configuration loader for Firebase scripts.
 *
 * This module provides a centralized way to load and validate environment variables
 * for Firebase scripts (not functions - functions use client-config.ts). It eliminates
 * the need for manual .env loading and validation in individual scripts.
 *
 * Usage in scripts:
 * ```typescript
 * import { loadRuntimeConfig, getInstanceEnvironment } from './scripts-config';
 *
 * // Load and validate environment
 * const config = loadRuntimeConfig();
 * const env = getInstanceEnvironment();
 *
 * console.log(`Running in ${env.environment} mode`);
 * console.log(`Instance: ${config.__INSTANCE_NAME}`);
 * ```
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { assertValidInstanceName, type InstanceName, isDevInstanceName } from '../functions/src/shared/instance-name';

/**
 * Read instance name from .current-instance file if it exists.
 * This serves as a fallback when INSTANCE_NAME is not in the environment.
 *
 * @returns The instance name from the file, or undefined if file doesn't exist
 */
function readCurrentInstanceFile(): string | undefined {
    const currentInstancePath = path.join(__dirname, '../.current-instance');
    try {
        if (fs.existsSync(currentInstancePath)) {
            const content = fs.readFileSync(currentInstancePath, 'utf8').trim();
            return content || undefined;
        }
    } catch (error) {
        // Silently ignore read errors - we'll fall back to default
    }
    return undefined;
}

/**
 * Runtime environment variable schema.
 * Focused on variables needed by scripts and runtime configuration.
 *
 * Note: This is a subset of the full envSchema in client-config.ts,
 * containing only the variables needed for runtime behavior (not client config).
 */
const runtimeEnvSchema = z.object({
    __INSTANCE_NAME: z
        .string()
        .optional()
        .transform((value) => {
            // Priority order:
            // 1. Explicit environment variable (highest priority)
            // 2. .current-instance file (fallback)
            // No default - configuration must be explicit
            if (value) {
                return value;
            }
            const fromFile = readCurrentInstanceFile();
            if (!fromFile) {
                throw new Error('__INSTANCE_NAME must be set via environment variable or .current-instance file');
            }
            return fromFile;
        })
        .superRefine((value, ctx) => {
            try {
                assertValidInstanceName(value);
            } catch (error) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        })
        .transform((value) => value as InstanceName),
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
    isDeployed: boolean;
    environment: 'EMULATOR' | 'DEPLOYED' | 'TEST';
    instanceName: InstanceName;
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
 * Get script environment information based on __INSTANCE_NAME.
 *
 * This determines whether the script is running against:
 * - Emulator (dev1, dev2, dev3, dev4)
 * - Deployed (staging-1, staging-2, etc.)
 * - Test (test)
 *
 * @param config - Optional pre-loaded config. If not provided, will load from environment.
 */
export function getInstanceEnvironment(config?: RuntimeConfig): ScriptEnvironment {
    const cfg = config ?? getRuntimeConfig();
    const name = cfg.__INSTANCE_NAME;
    const isEmulator = isDevInstanceName(name);
    const isDeployed = !isEmulator;

    return {
        isEmulator,
        isDeployed,
        environment: isEmulator ? 'EMULATOR' : 'DEPLOYED',
        instanceName: name,
    };
}

/**
 * Require that __INSTANCE_NAME is set and valid.
 * Convenience function for scripts that need instance name validation.
 *
 * @returns The validated instance name
 * @throws {Error} If __INSTANCE_NAME is not set or invalid
 */
export function requireInstanceName(): InstanceName {
    const config = getRuntimeConfig();
    return config.__INSTANCE_NAME;
}
