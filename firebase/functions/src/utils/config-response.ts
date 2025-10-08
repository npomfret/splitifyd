import { AppConfiguration } from '@splitifyd/shared';
import { getAppConfig } from '../client-config';

export const getEnhancedConfigResponse = (): AppConfiguration => {
    // Return the lazily-loaded, validated configuration
    return getAppConfig();
};
