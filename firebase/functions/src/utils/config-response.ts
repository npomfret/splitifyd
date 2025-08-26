import { getAppConfig } from '../client-config';
import { AppConfiguration } from '@splitifyd/shared';

export const getEnhancedConfigResponse = (): AppConfiguration => {
    // Return the lazily-loaded, validated configuration
    return getAppConfig();
};
