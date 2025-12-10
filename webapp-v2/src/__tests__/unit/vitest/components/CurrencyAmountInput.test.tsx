import { CurrencyAmountInput } from '@/components/ui/CurrencyAmountInput';
import { render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            switch (key) {
                case 'uiComponents.currencyAmountInput.selectCurrency':
                    return 'Select currency';
                case 'uiComponents.currencyAmountInput.placeholder':
                    return 'Enter amount';
                case 'uiComponents.currencyAmountInput.unknown':
                    return '?';
                default:
                    return key;
            }
        },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

describe('CurrencyAmountInput', () => {
    const noop = () => {};

    it('displays both symbol and code for the selected currency', () => {
        render(
            <CurrencyAmountInput
                amount='0'
                currency='USD'
                onAmountChange={noop}
                onCurrencyChange={noop}
            />,
        );

        const button = screen.getByRole('button', { name: 'Select currency' });
        expect(button).toHaveTextContent(/\$/);
        expect(button).toHaveTextContent(/USD/);
    });

    it('distinguishes currencies that share the same symbol', () => {
        const { rerender } = render(
            <CurrencyAmountInput
                amount='0'
                currency='USD'
                onAmountChange={noop}
                onCurrencyChange={noop}
            />,
        );

        let button = screen.getByRole('button', { name: 'Select currency' });
        expect(button).toHaveTextContent(/\$/);
        expect(button).toHaveTextContent(/USD/);

        rerender(
            <CurrencyAmountInput
                amount='0'
                currency='CAD'
                onAmountChange={noop}
                onCurrencyChange={noop}
            />,
        );

        button = screen.getByRole('button', { name: 'Select currency' });
        expect(button).toHaveTextContent(/\$/);
        expect(button).toHaveTextContent(/CAD/);
    });
});
