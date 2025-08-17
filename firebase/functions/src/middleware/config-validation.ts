import { z } from 'zod';
import { AppConfiguration } from '../shared/shared-types';

const FirebaseConfigSchema = z.object({
    apiKey: z.string().min(1),
    authDomain: z.string().min(1),
    projectId: z.string().min(1),
    storageBucket: z.string().min(1),
    messagingSenderId: z.string().min(1),
    appId: z.string().min(1),
    measurementId: z.string().optional(),
});

const ApiConfigSchema = z.object({
    timeout: z.number().positive(),
    retryAttempts: z.number().int().positive(),
});

const WarningBannerSchema = z.object({
    enabled: z.boolean(),
    message: z.string(),
});

const EnvironmentConfigSchema = z.object({
    warningBanner: WarningBannerSchema.optional(),
});

const FormDefaultsSchema = z.object({
    displayName: z.string(),
    email: z.string(),
    password: z.string(),
});

const AppConfigurationSchema = z.object({
    firebase: FirebaseConfigSchema,
    api: ApiConfigSchema,
    environment: EnvironmentConfigSchema,
    formDefaults: FormDefaultsSchema,
    firebaseAuthUrl: z.string().optional(),
});

export function validateAppConfiguration(config: unknown): AppConfiguration {
    return AppConfigurationSchema.parse(config);
}
