import { AppConfiguration } from '@splitifyd/shared';
import { z } from 'zod';

const FirebaseConfigSchema = z.object({
    apiKey: z.string().min(1),
    authDomain: z.string().min(1),
    projectId: z.string().min(1),
    storageBucket: z.string().min(1),
    messagingSenderId: z.string().min(1),
    appId: z.string().min(1),
    measurementId: z.string().optional(),
});

const EnvironmentConfigSchema = z.object({
    warningBanner: z.string().optional(),
});

const FormDefaultsSchema = z.object({
    displayName: z.string(),
    email: z.string(),
    password: z.string(),
});

const AppConfigurationSchema = z.object({
    firebase: FirebaseConfigSchema,
    environment: EnvironmentConfigSchema,
    formDefaults: FormDefaultsSchema,
    firebaseAuthUrl: z.string().optional(),
    firebaseFirestoreUrl: z.string().optional(),
});

export function validateAppConfiguration(config: unknown): AppConfiguration {
    return AppConfigurationSchema.parse(config);
}
