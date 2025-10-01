// Re-export currency utilities from shared package
// This provides a single source of truth for currency data across the entire application
import { type Currency, CURRENCIES, getCurrency, isValidCurrency } from '@splitifyd/shared';

export { type Currency, CURRENCIES, getCurrency, isValidCurrency };
