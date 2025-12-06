import { AppConfigurationSchema, ClientAppConfiguration } from '@billsplit-wl/shared';

export function validateAppConfiguration(config: unknown): ClientAppConfiguration {
    return AppConfigurationSchema.parse(config);
}
