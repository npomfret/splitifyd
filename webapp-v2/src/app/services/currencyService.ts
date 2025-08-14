import { 
  getSmartDefaultCurrency,
  setLastUsedCurrencyByUser,
  currencies,
  Currency,
  getCurrency,
  isValidCurrency,
  COMMON_CURRENCIES
} from '../../utils/currency';
import type { ExpenseData } from '@shared/shared-types';

export class CurrencyService {
  private static instance: CurrencyService;
  private currencyCache: Map<string, Currency> = new Map();
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

  getSuggestedCurrencies(): Currency[] {
    const recent = this.getRecentCurrencies();
    const suggested = new Set([...recent, ...COMMON_CURRENCIES]);
    
    return Array.from(suggested)
      .slice(0, 12)
      .map(code => getCurrency(code))
      .filter((currency): currency is Currency => currency !== undefined);
  }

  getAllCurrencies(): Currency[] {
    return currencies;
  }

  getCurrencyInfo(code: string): Currency | undefined {
    const upperCode = code.toUpperCase();
    
    if (this.currencyCache.has(upperCode)) {
      return this.currencyCache.get(upperCode);
    }
    
    const currency = getCurrency(upperCode);
    if (currency) {
      this.currencyCache.set(upperCode, currency);
    }
    
    return currency;
  }

  getDefaultCurrency(
    userId: string,
    groupId: string,
    expenses?: ExpenseData[]
  ): string {
    let lastUsedInGroup: string | undefined;
    
    if (expenses && expenses.length > 0) {
      const expensesWithCurrency = expenses.filter(e => e.currency);
      if (expensesWithCurrency.length > 0) {
        lastUsedInGroup = expensesWithCurrency[expensesWithCurrency.length - 1].currency;
      }
    }
    
    return getSmartDefaultCurrency({
      userId,
      groupId,
      lastUsedInGroup,
      locale: navigator.language
    });
  }

  recordCurrencyUsage(
    userId: string,
    groupId: string,
    currencyCode: string
  ): void {
    if (!isValidCurrency(currencyCode)) return;
    
    const code = currencyCode.toUpperCase();
    setLastUsedCurrencyByUser(userId, groupId, code);
    this.addToRecentCurrencies(code);
  }

  searchCurrencies(query: string): Currency[] {
    const lowerQuery = query.toLowerCase();
    
    return currencies.filter(currency => 
      currency.acronym.toLowerCase().includes(lowerQuery) ||
      currency.name.toLowerCase().includes(lowerQuery) ||
      currency.countries.some(country => 
        country.toLowerCase().includes(lowerQuery)
      )
    ).slice(0, 20);
  }

  validateCurrency(code: string): boolean {
    return isValidCurrency(code);
  }

  clearCache(): void {
    this.currencyCache.clear();
  }
}

export const currencyService = CurrencyService.getInstance();