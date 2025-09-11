import { getCurrenciesAsync, getCurrency, isValidCurrency, type Currency } from '@/utils/currency';
import type { UserScopedStorage } from '@/utils/userScopedStorage.ts';

export interface GroupedCurrencies {
    recent: Currency[];
    common: Currency[];
    others: Currency[];
}

export type { Currency };

/**
 * Comprehensive service for managing currency data, filtering, and grouping
 * Combines recent currency tracking with currency data management
 */
export class CurrencyService {
    private static instance: CurrencyService;
    private recentCurrencies: Set<string> = new Set();
    private readonly MAX_RECENT_CURRENCIES = 5;
    private storage: UserScopedStorage | null = null;

    // Currency data caching
    private currencies: Currency[] = [];
    private isLoaded = false;
    private loadingPromise: Promise<Currency[]> | null = null;

    private readonly commonCurrencyCodes = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];

    private constructor() {
        // Storage will be set later by setStorage method
        // This avoids the chicken-and-egg problem with auth initialization
    }

    static getInstance(): CurrencyService {
        if (!CurrencyService.instance) {
            CurrencyService.instance = new CurrencyService();
        }
        return CurrencyService.instance;
    }

    // Recent currencies management (existing functionality)

    /**
     * Set the user-scoped storage instance and load recent currencies
     * Called by auth store after user authentication
     */
    setStorage(storage: UserScopedStorage): void {
        this.storage = storage;
        this.loadRecentCurrencies();
    }

    /**
     * Clear storage reference and recent currencies
     * Called on logout to ensure clean state
     */
    clearStorage(): void {
        this.storage = null;
        this.recentCurrencies.clear();
        // Also clear currency cache on logout
        this.resetCurrencyCache();
    }

    private loadRecentCurrencies(): void {
        if (!this.storage) {
            return;
        }

        const stored = this.storage.getItem('recentCurrencies');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    this.recentCurrencies.clear();
                    parsed.slice(0, this.MAX_RECENT_CURRENCIES).forEach((code) => {
                        if (isValidCurrency(code)) {
                            this.recentCurrencies.add(code);
                        }
                    });
                }
            } catch (error) {
                console.error('Failed to load recent currencies:', error);
            }
        }
    }

    private saveRecentCurrencies(): void {
        if (!this.storage) {
            return;
        }

        const recent = Array.from(this.recentCurrencies);
        this.storage.setItem('recentCurrencies', JSON.stringify(recent));
    }

    addToRecentCurrencies(currencyCode: string): void {
        if (!isValidCurrency(currencyCode)) return;

        const code = currencyCode.toUpperCase();

        this.recentCurrencies.delete(code);
        this.recentCurrencies.add(code);

        if (this.recentCurrencies.size > this.MAX_RECENT_CURRENCIES) {
            const iterator = this.recentCurrencies.values();
            const firstValue = iterator.next().value;
            if (firstValue) {
                this.recentCurrencies.delete(firstValue);
            }
        }

        this.saveRecentCurrencies();
    }

    getRecentCurrencies(): string[] {
        return Array.from(this.recentCurrencies).reverse();
    }

    // New currency data management functionality

    /**
     * Load currencies asynchronously (with caching)
     */
    async loadCurrencies(): Promise<Currency[]> {
        if (this.isLoaded) {
            return this.currencies;
        }

        // If already loading, return the existing promise
        if (this.loadingPromise) {
            return this.loadingPromise;
        }

        this.loadingPromise = getCurrenciesAsync().then((currencies) => {
            this.currencies = currencies;
            this.isLoaded = true;
            this.loadingPromise = null;
            return currencies;
        });

        return this.loadingPromise;
    }

    /**
     * Get all loaded currencies (synchronous)
     */
    getCurrencies(): Currency[] {
        return this.currencies;
    }

    /**
     * Check if currencies are currently loading
     */
    isLoading(): boolean {
        return this.loadingPromise !== null;
    }

    /**
     * Get currency by code
     */
    getCurrencyByCode(code: string): Currency | undefined {
        return getCurrency(code);
    }

    /**
     * Filter currencies based on search term
     */
    filterCurrencies(currencies: Currency[], searchTerm: string): Currency[] {
        if (!searchTerm.trim()) return currencies;

        const searchLower = searchTerm.toLowerCase();
        return currencies.filter(
            (curr) =>
                curr.symbol.toLowerCase().includes(searchLower) ||
                curr.acronym.toLowerCase().includes(searchLower) ||
                curr.name.toLowerCase().includes(searchLower) ||
                curr.countries.some((country) => country.toLowerCase().includes(searchLower)),
        );
    }

    /**
     * Group currencies into recent, common, and others
     */
    groupCurrencies(currencies: Currency[], recentCurrencies: string[] = []): GroupedCurrencies {
        const recent = recentCurrencies.map((code) => currencies.find((c) => c.acronym === code)).filter((c): c is Currency => !!c);

        const common = this.commonCurrencyCodes.map((code) => currencies.find((c) => c.acronym === code)).filter((c): c is Currency => !!c && !recent.some((r) => r.acronym === c.acronym));

        const others = currencies.filter((c) => !recent.some((r) => r.acronym === c.acronym) && !common.some((cm) => cm.acronym === c.acronym));

        return { recent, common, others };
    }

    /**
     * Calculate min and step values based on currency decimal digits
     */
    getCurrencyInputConfig(currencyCode: string): { minValue: string; stepValue: string } {
        const currency = this.getCurrencyByCode(currencyCode);
        const decimalDigits = currency?.decimal_digits ?? 2; // Default to 2 if unknown
        const step = Math.pow(10, -decimalDigits); // 0.01 for 2 digits, 1 for 0 digits, 0.001 for 3 digits
        const min = step; // Use the step as minimum

        return {
            minValue: min.toString(),
            stepValue: step.toString(),
        };
    }

    /**
     * Get flat array of currencies for keyboard navigation
     */
    getFlatCurrencyArray(groupedCurrencies: GroupedCurrencies): Currency[] {
        return [...groupedCurrencies.recent, ...groupedCurrencies.common, ...groupedCurrencies.others];
    }

    /**
     * Reset currency cache only (keep recent currencies)
     */
    private resetCurrencyCache(): void {
        this.currencies = [];
        this.isLoaded = false;
        this.loadingPromise = null;
    }
}
