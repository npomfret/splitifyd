import { getAppConfig } from '../config';
import { AppConfiguration } from '../shared/shared-types';

export const getEnhancedConfigResponse = (): AppConfiguration => {
    // Return the lazily-loaded, validated configuration
    return getAppConfig();
};
