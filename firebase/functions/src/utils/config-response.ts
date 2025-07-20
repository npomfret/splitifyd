import { getAppConfig } from '../config';
import { AppConfiguration } from '../types/webapp-shared-types';

export const getEnhancedConfigResponse = (): AppConfiguration => {
  // Return the lazily-loaded, validated configuration
  return getAppConfig();
};