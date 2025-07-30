import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { PricingPage } from '../PricingPage';

describe('PricingPage', () => {
  it('renders without crashing', () => {
    render(<PricingPage />);
    expect(screen.getByRole('heading', { name: /Pricing/ })).toBeInTheDocument();
  });

  it('uses StaticPageLayout structure', () => {
    render(<PricingPage />);
    // StaticPageLayout adds header with Splitifyd branding and footer
    expect(screen.getAllByText('Splitifyd').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('© 2025 Splitifyd. All rights reserved.')).toBeInTheDocument();
  });

  it('displays pricing cards', () => {
    render(<PricingPage />);
    // Just verify there are pricing-related elements without checking specific content
    const headings = screen.getAllByRole('heading', { level: 3 }); // Plan names
    expect(headings.length).toBeGreaterThanOrEqual(2); // At least 2 pricing plans
  });

  it('has call-to-action elements', () => {
    render(<PricingPage />);
    // Verify there are links/buttons without checking specific text
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(2); // Should have multiple CTA links
  });
});