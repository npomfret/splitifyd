/**
 * Version utility for consistent version reporting across the application
 */

// Import version from package.json for single source of truth
import * as packageJson from '../../package.json';

/**
 * Application version from package.json
 */
export const APP_VERSION = packageJson.version;