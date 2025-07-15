import { APP_CONFIG } from '../config';
import { AppConfiguration } from '../types/config.types';

export const getEnhancedConfigResponse = (): AppConfiguration => {
  // Return the pre-built, validated configuration
  return APP_CONFIG;
};