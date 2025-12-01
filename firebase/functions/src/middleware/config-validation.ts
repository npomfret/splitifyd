import { ClientAppConfiguration, AppConfigurationSchema } from '@billsplit-wl/shared';

export function validateAppConfiguration(config: unknown): ClientAppConfiguration {
    return AppConfigurationSchema.parse(config);
}
