import {
    isValidCurrency,
} from '../../utils/currency';

export class CurrencyService {
    private static instance: CurrencyService;
    private recentCurrencies: Set<string> = new Set();
    private readonly MAX_RECENT_CURRENCIES = 5;

    private constructor() {
        this.loadRecentCurrencies();
    }

    static getInstance(): CurrencyService {
        if (!CurrencyService.instance) {
            CurrencyService.instance = new CurrencyService();
        }
        return CurrencyService.instance;
    }

    private loadRecentCurrencies(): void {
        const stored = localStorage.getItem('recentCurrencies');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    parsed.slice(0, this.MAX_RECENT_CURRENCIES).forEach(code => {
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
        const recent = Array.from(this.recentCurrencies);
        localStorage.setItem('recentCurrencies', JSON.stringify(recent));
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

