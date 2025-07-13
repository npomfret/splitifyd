import { z } from 'zod';
import { AppConfiguration } from '../types/config.types';

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
  baseUrl: z.string().url().or(z.string().regex(/^\/api$/)),
  timeout: z.number().positive(),
  retryAttempts: z.number().int().positive(),
});

const WarningBannerSchema = z.object({
  enabled: z.boolean(),
  message: z.string(),
});

const EmulatorPortsSchema = z.object({
  auth: z.number().int().positive().optional(),
  firestore: z.number().int().positive().optional(),
  functions: z.number().int().positive().optional(),
  hosting: z.number().int().positive().optional(),
});

const EnvironmentConfigSchema = z.object({
  isDevelopment: z.boolean(),
  isProduction: z.boolean(),
  isEmulator: z.boolean(),
  warningBanner: WarningBannerSchema.optional(),
  emulatorPorts: EmulatorPortsSchema.optional(),
});

const FormDefaultsSchema = z.object({
  displayName: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().optional(),
});

const AppMetadataSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  firebaseProjectId: z.string().min(1),
  productionBaseUrl: z.string().url(),
  apiBaseUrl: z.string().url(),
});

const AppConfigurationSchema = z.object({
  firebase: FirebaseConfigSchema,
  api: ApiConfigSchema,
  features: z.record(z.string(), z.boolean()),
  environment: EnvironmentConfigSchema,
  app: AppMetadataSchema,
  formDefaults: FormDefaultsSchema.optional(),
});

export function validateAppConfiguration(config: unknown): AppConfiguration {
  return AppConfigurationSchema.parse(config);
}

export function validatePartialAppConfiguration(config: unknown): Partial<AppConfiguration> {
  return AppConfigurationSchema.partial().parse(config);
}