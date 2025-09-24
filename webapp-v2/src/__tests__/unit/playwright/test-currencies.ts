/**
 * Test currencies with diverse symbols to flush out hardcoded currency assumptions
 * Uses a mix of lesser-used real currencies with varied formatting rules
 */

export interface TestCurrency {
    acronym: string;
    name: string;
    symbol: string;
    decimal_digits: number;
    countries: string[];
}

// Test currencies chosen for their diverse formatting characteristics
export const TEST_CURRENCIES: TestCurrency[] = [
    {
        acronym: 'PLN',
        name: 'Polish Złoty',
        symbol: 'zł',
        decimal_digits: 2,
        countries: ['Poland']
    },
    {
        acronym: 'ISK',
        name: 'Icelandic Króna',
        symbol: 'kr',
        decimal_digits: 0, // Tests 0-decimal handling
        countries: ['Iceland']
    },
    {
        acronym: 'THB',
        name: 'Thai Baht',
        symbol: '฿',
        decimal_digits: 2,
        countries: ['Thailand']
    },
    {
        acronym: 'RON',
        name: 'Romanian Leu',
        symbol: 'lei',
        decimal_digits: 2,
        countries: ['Romania']
    },
    {
        acronym: 'VND',
        name: 'Vietnamese Dong',
        symbol: '₫',
        decimal_digits: 0, // Tests 0-decimal handling
        countries: ['Vietnam']
    },
    {
        acronym: 'HUF',
        name: 'Hungarian Forint',
        symbol: 'Ft',
        decimal_digits: 2,
        countries: ['Hungary']
    },
    {
        acronym: 'CZK',
        name: 'Czech Koruna',
        symbol: 'Kč',
        decimal_digits: 2,
        countries: ['Czech Republic']
    }
];

// Primary test currencies to use instead of USD/EUR/GBP
export const PRIMARY_TEST_CURRENCY = TEST_CURRENCIES[0]; // PLN (zł)
export const SECONDARY_TEST_CURRENCY = TEST_CURRENCIES[2]; // THB (฿)
export const TERTIARY_TEST_CURRENCY = TEST_CURRENCIES[3]; // RON (lei)

// Currency mapping for consistent replacement
export const CURRENCY_REPLACEMENTS = {
    USD: PRIMARY_TEST_CURRENCY,    // zł instead of $
    EUR: SECONDARY_TEST_CURRENCY,  // ฿ instead of €
    GBP: TERTIARY_TEST_CURRENCY    // lei instead of £
} as const;

// Helper function to get test currency by acronym
export const getTestCurrency = (acronym: string): TestCurrency | undefined => {
    return TEST_CURRENCIES.find(c => c.acronym === acronym);
};

// Helper function to format currency amount for testing
export const formatTestCurrency = (amount: number, currency: TestCurrency): string => {
    if (currency.decimal_digits === 0) {
        return `${currency.symbol}${Math.round(amount)}`;
    }
    return `${currency.symbol}${amount.toFixed(currency.decimal_digits)}`;
};
