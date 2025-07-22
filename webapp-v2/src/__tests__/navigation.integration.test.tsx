import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { StaticPageLayout } from '../components/StaticPageLayout';

// Integration tests for navigation flows - test cross-component behavior
describe('Navigation Integration', () => {
  it('provides consistent navigation across all static pages', () => {
    render(
      <StaticPageLayout title="Test Page" description="Test description">
        <p>Test content</p>
      </StaticPageLayout>
    );
    
    // Navigation should be consistent across all pages
    const homeLink = screen.getByRole('link', { name: 'Home' });
    const pricingLinks = screen.getAllByRole('link', { name: 'Pricing' });
    
    expect(homeLink).toHaveAttribute('href', '/');
    expect(pricingLinks[0]).toHaveAttribute('href', '/v2/pricing');
  });

  it('provides footer legal navigation on all static pages', () => {
    render(
      <StaticPageLayout title="Test Page" description="Test description">
        <p>Test content</p>
      </StaticPageLayout>
    );
    
    // Footer should have legal links
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/v2/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/v2/privacy');
    expect(screen.getByRole('link', { name: 'Cookie Policy' })).toHaveAttribute('href', '/v2/cookies');
  });

  it('maintains consistent branding across pages', () => {
    render(
      <StaticPageLayout title="Test Page" description="Test description">
        <p>Test content</p>
      </StaticPageLayout>
    );
    
    // Branding should be consistent
    expect(screen.getAllByText('Splitifyd').length).toBeGreaterThanOrEqual(2); // Header + Footer
    expect(screen.getByText('© 2025 Splitifyd. All rights reserved.')).toBeInTheDocument();
  });

  it('includes company description consistently in footer', () => {
    render(
      <StaticPageLayout title="Test Page" description="Test description">
        <p>Test content</p>
      </StaticPageLayout>
    );
    
    expect(screen.getByText(/Split bills easily with friends and family/)).toBeInTheDocument();
  });

  it('provides breadcrumb-like navigation structure', () => {
    render(
      <StaticPageLayout title="Test Page" description="Test description">
        <p>Test content</p>
      </StaticPageLayout>
    );
    
    // Users should always be able to navigate back to home and main sections
    expect(screen.getByRole('link', { name: 'Home' })).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Pricing' })[0]).toBeVisible();
  });
});