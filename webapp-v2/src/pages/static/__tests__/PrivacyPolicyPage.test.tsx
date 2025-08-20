import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import { PrivacyPolicyPage } from '../PrivacyPolicyPage';

// Mock the usePolicy hook
vi.mock('@/hooks/usePolicy', () => ({
    usePolicy: vi.fn(() => ({
        policy: {
            id: 'privacy-policy',
            text: `# Privacy Policy

## Information We Collect
We collect information you provide directly to us, such as when you create an account or submit expense information.

## How We Use Your Information
We use the information we collect to:
- Provide and maintain our services
- Process transactions and send related information
- Send technical notices and support messages

## Information Sharing
We do not sell, trade, or otherwise transfer your personal information to third parties without your consent.

## Data Security
We implement appropriate technical and organizational measures to protect your personal information.

## Your Rights
You have the right to access, update, or delete your personal information at any time.

## Contact Us
If you have any questions about this Privacy Policy, please contact us.`,
            createdAt: '2025-01-22T00:00:00Z',
        },
        loading: false,
        error: null,
    })),
}));

describe('PrivacyPolicyPage', () => {
    it('renders without crashing', () => {
        render(<PrivacyPolicyPage />);
        const headings = screen.getAllByRole('heading', { name: 'Privacy Policy' });
        expect(headings.length).toBeGreaterThan(0);
    });

    it('uses StaticPageLayout structure', () => {
        render(<PrivacyPolicyPage />);
        // StaticPageLayout adds header with Splitifyd branding and footer
        expect(screen.getAllByText('Splitifyd').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('© 2025 Pomo Corp ltd. All rights reserved.')).toBeInTheDocument();
    });

    it('contains privacy-related sections', () => {
        render(<PrivacyPolicyPage />);
        // Just verify the page has multiple sections (h2 elements)
        const sections = screen.getAllByRole('heading', { level: 2 });
        expect(sections.length).toBeGreaterThan(5); // Privacy policies typically have many sections
    });
});
