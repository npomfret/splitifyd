import { test as base } from '@playwright/test';
import { setupConsoleErrorReporting } from '../helpers/console-error-reporter';

// Set up console error reporting for all tests
setupConsoleErrorReporting();

// Export the base test with console error reporting enabled
export const test = base;
export { expect } from '@playwright/test';