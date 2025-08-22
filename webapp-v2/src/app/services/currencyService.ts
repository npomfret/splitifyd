import { isValidCurrency } from '@/utils/currency';
import { logError } from '@/utils/browser-logger.ts';
import type { UserScopedStorage } from '@/utils/userScopedStorage.ts';

export class CurrencyService {
    private static instance: CurrencyService;
    private recentCurrencies: Set<string> = new Set();
    private readonly MAX_RECENT_CURRENCIES = 5;
    private storage: UserScopedStorage | null = null;

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
    }

    private loadRecentCurrencies(): void {
        if (!this.storage) {
            // No storage available yet - wait for setStorage to be called
            return;
        }

        const stored = this.storage.getItem('recentCurrencies');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    // Clear existing currencies before loading
                    this.recentCurrencies.clear();
                    parsed.slice(0, this.MAX_RECENT_CURRENCIES).forEach((code) => {
                        if (isValidCurrency(code)) {
                            this.recentCurrencies.add(code);
                        }
                    });
                }
            } catch (error) {
                logError('Failed to load recent currencies', error);
            }
        }
    }

    private saveRecentCurrencies(): void {
        if (!this.storage) {
            // No storage available - likely user not authenticated
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
}
