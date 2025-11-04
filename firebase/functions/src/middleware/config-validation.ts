import { AppConfiguration, AppConfigurationSchema } from '@splitifyd/shared';

export function validateAppConfiguration(config: unknown): AppConfiguration {
    return AppConfigurationSchema.parse(config);
}
