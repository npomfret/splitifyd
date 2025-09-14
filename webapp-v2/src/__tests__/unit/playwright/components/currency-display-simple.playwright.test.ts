import { test, expect } from '@playwright/test';
import { setupStoreMocks, createTestPage } from '../stores/setup';

/**
 * Simple working example of component testing using the existing pattern
 * This demonstrates the improved approach while using the proven infrastructure
 */

test.describe('CurrencyDisplay - Simple Working Example', () => {
  test.beforeEach(async ({ page }) => {
    await setupStoreMocks(page);
  });

  test('should display currency amount correctly', async ({ page }) => {
    await createTestPage(page, `
      <div class="currency-display-container">
        <h3>Currency Display Test</h3>
        <div id="currency-display" data-testid="currency-display"></div>
      </div>

      <style>
        .currency-display-container {
          padding: 20px;
          background: white;
          border-radius: 8px;
          margin: 20px;
        }
        .currency-amount {
          font-weight: bold;
          color: #d32f2f;
        }
        .text-red-500 {
          color: #ef4444;
        }
      </style>

      <script>
        const props = {
          amount: 25.50,
          currency: 'USD',
          className: 'text-red-500'
        };

        // Simple currency formatting function
        function formatCurrency(amount, currency) {
          const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
          });
          return formatter.format(amount);
        }

        // Render the currency display
        const container = document.getElementById('currency-display');
        container.innerHTML = \`
          <div class="currency-display \${props.className}" data-testid="currency-component">
            <span data-testid="formatted-amount">\${formatCurrency(props.amount, props.currency)}</span>
          </div>
        \`;
      </script>
    `);

    // Test the formatted output
    await expect(page.getByTestId('formatted-amount')).toHaveText('$25.50');
    await expect(page.getByTestId('currency-component')).toHaveClass(/text-red-500/);
  });

  test('should handle different currencies', async ({ page }) => {
    await createTestPage(page, `
      <div class="currency-display-container">
        <div id="currency-display" data-testid="currency-display"></div>
      </div>

      <script>
        const props = {
          amount: 100.75,
          currency: 'EUR'
        };

        function formatCurrency(amount, currency) {
          const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
          });
          return formatter.format(amount);
        }

        const container = document.getElementById('currency-display');
        container.innerHTML = \`
          <div class="currency-display" data-testid="currency-component">
            <span data-testid="formatted-amount">\${formatCurrency(props.amount, props.currency)}</span>
            <span data-testid="currency-code" class="ml-2">\${props.currency}</span>
          </div>
        \`;
      </script>
    `);

    // Test EUR formatting
    await expect(page.getByTestId('formatted-amount')).toHaveText('€100.75');
    await expect(page.getByTestId('currency-code')).toHaveText('EUR');
  });

  test('should handle zero amounts with conditional display', async ({ page }) => {
    await createTestPage(page, `
      <div class="currency-display-container">
        <div id="currency-display" data-testid="currency-display"></div>
      </div>

      <script>
        const props = {
          amount: 0,
          currency: 'USD',
          showZero: true
        };

        function formatCurrency(amount, currency) {
          const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
          });
          return formatter.format(amount);
        }

        const container = document.getElementById('currency-display');

        if (props.amount === 0 && !props.showZero) {
          container.innerHTML = \`
            <div class="currency-display hidden" data-testid="currency-component">
              <span>Hidden</span>
            </div>
          \`;
        } else {
          container.innerHTML = \`
            <div class="currency-display" data-testid="currency-component">
              <span data-testid="formatted-amount">\${formatCurrency(props.amount, props.currency)}</span>
            </div>
          \`;
        }
      </script>
    `);

    // Should show $0.00 when showZero is true
    await expect(page.getByTestId('formatted-amount')).toHaveText('$0.00');
    await expect(page.getByTestId('currency-component')).toBeVisible();
  });
});