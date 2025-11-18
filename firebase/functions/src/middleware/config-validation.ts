import { AppConfiguration, AppConfigurationSchema } from '@billsplit-wl/shared';

export function validateAppConfiguration(config: unknown): AppConfiguration {
    return AppConfigurationSchema.parse(config);
}
