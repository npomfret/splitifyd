import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import { TermsOfServicePage } from '../TermsOfServicePage';

// Mock the usePolicy hook
vi.mock('@/hooks/usePolicy', () => ({
    usePolicy: vi.fn(() => ({
        policy: {
            id: 'terms-of-service',
            text: `# Terms of Service

Last updated: January 22, 2025

## 1. Acceptance of Terms

By accessing and using Splitifyd, you accept and agree to be bound by the terms and provision of this agreement.

## 2. Use License

Permission is granted to temporarily download one copy of Splitifyd for personal, non-commercial transitory viewing only.

## 3. User Accounts

When you create an account with us, you must provide information that is accurate, complete, and current at all times. You are responsible for safeguarding the password and for all activities that occur under your account.

## 4. Privacy Policy

Your use of Splitifyd is also governed by our Privacy Policy.

## 5. Prohibited Uses

You may not use our service:
- For any unlawful purpose
- To solicit others to perform unlawful acts
- To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances

## 6. Termination

We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever.

## 7. Limitation of Liability

In no event shall Splitifyd, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages.

## 8. Contact Information

If you have any questions about these Terms, please contact us at terms@splitifyd.com.`,
            createdAt: '2025-01-22T00:00:00Z',
        },
        loading: false,
        error: null,
    })),
}));

// Test Terms of Service page behavior
describe('TermsOfServicePage', () => {
    it('displays terms of service title', () => {
        render(<TermsOfServicePage />);

        const headings = screen.getAllByRole('heading', { name: 'Terms of Service' });
        expect(headings.length).toBeGreaterThan(0);
    });

    it('shows last updated date', () => {
        render(<TermsOfServicePage />);

        const lastUpdatedTexts = screen.getAllByText(/Last updated:/);
        expect(lastUpdatedTexts.length).toBeGreaterThan(0);
        expect(screen.getByText(/January 22, 2025/)).toBeInTheDocument();
    });

    it('includes key legal sections', () => {
        render(<TermsOfServicePage />);

        // Check for main legal sections
        expect(screen.getByText('1. Acceptance of Terms')).toBeInTheDocument();
        expect(screen.getByText('2. Use License')).toBeInTheDocument();
        expect(screen.getByText('3. User Accounts')).toBeInTheDocument();
        expect(screen.getByText('4. Privacy Policy')).toBeInTheDocument();
        expect(screen.getByText('5. Prohibited Uses')).toBeInTheDocument();
    });

    it('provides contact information', () => {
        render(<TermsOfServicePage />);

        expect(screen.getByText('8. Contact Information')).toBeInTheDocument();
        expect(screen.getByText(/terms@splitifyd.com/)).toBeInTheDocument();
    });

    it('explains user responsibilities', () => {
        render(<TermsOfServicePage />);

        expect(screen.getByText(/When you create an account with us/)).toBeInTheDocument();
        expect(screen.getByText(/You are responsible for safeguarding/)).toBeInTheDocument();
    });

    it('has proper page structure with layout', () => {
        render(<TermsOfServicePage />);

        // Should use StaticPageLayout
        expect(screen.getAllByText('Splitifyd').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('© 2025 Pomo Corp ltd. All rights reserved.')).toBeInTheDocument();
    });
});
