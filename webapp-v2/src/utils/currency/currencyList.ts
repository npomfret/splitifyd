// Re-export currency utilities from shared package
// This provides a single source of truth for currency data across the entire application
import { CURRENCIES, type Currency, getCurrency, isValidCurrency } from '@splitifyd/shared';

export { CURRENCIES, type Currency, getCurrency, isValidCurrency };
