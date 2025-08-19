import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import { CookiePolicyPage } from '../CookiePolicyPage';

// Mock the usePolicy hook
vi.mock('@/hooks/usePolicy', () => ({
    usePolicy: vi.fn(() => ({
        policy: {
            id: 'cookie-policy',
            text: `# Cookie Policy

## What Are Cookies
Cookies are small text files that are placed on your device when you visit our website.

## How We Use Cookies
We use cookies to improve your experience on our platform, including:
- Keeping you signed in
- Remembering your preferences
- Analyzing site usage

## Types of Cookies We Use
### Essential Cookies
These cookies are necessary for the website to function properly.

### Analytics Cookies
We use these to understand how visitors interact with our website.

### Preference Cookies
These cookies remember your settings and preferences.

## Managing Cookies
You can control and/or delete cookies as you wish. You can delete all cookies that are already on your computer and you can set most browsers to prevent them from being placed.`,
            createdAt: '2025-01-22T00:00:00Z',
        },
        loading: false,
        error: null,
    })),
}));

describe('CookiePolicyPage', () => {
    it('renders without crashing', () => {
        render(<CookiePolicyPage />);
        const headings = screen.getAllByRole('heading', { name: 'Cookie Policy' });
        expect(headings.length).toBeGreaterThan(0);
    });

    it('uses StaticPageLayout structure', () => {
        render(<CookiePolicyPage />);
        // StaticPageLayout adds header with Splitifyd branding and footer
        expect(screen.getAllByText('Splitifyd').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('© 2025 Pomo Corp ltd. All rights reserved.')).toBeInTheDocument();
    });

    it('contains cookie-related sections', () => {
        render(<CookiePolicyPage />);
        // Just verify the page has multiple sections (h2 elements)
        const sections = screen.getAllByRole('heading', { level: 2 });
        expect(sections.length).toBeGreaterThan(3); // Cookie policies typically have several sections
    });
});
