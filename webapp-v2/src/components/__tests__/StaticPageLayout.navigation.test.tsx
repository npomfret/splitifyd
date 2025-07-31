import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { StaticPageLayout } from '../StaticPageLayout';

// Unit tests for navigation elements in StaticPageLayout
describe('StaticPageLayout - Navigation', () => {
  it('provides consistent navigation across all static pages', () => {
    render(
      <StaticPageLayout title="Test Page" description="Test description">
        <p>Test content</p>
      </StaticPageLayout>
    );
    
    // Navigation should be consistent across all pages
    const logoLink = screen.getByRole('link', { name: 'Splitifyd' });
    const pricingLink = screen.getByRole('link', { name: 'Pricing' });
    
    expect(logoLink).toHaveAttribute('href', '/');
    expect(pricingLink).toHaveAttribute('href', '/v2/pricing');
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
    // Logo in header (as img alt text) + "Splitifyd" text in footer
    expect(screen.getByAltText('Splitifyd')).toBeInTheDocument(); // Header logo
    expect(screen.getByText('Splitifyd')).toBeInTheDocument(); // Footer heading
    expect(screen.getByText('© 2025 Pomo Corp ltd. All rights reserved.')).toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: 'Splitifyd' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Pricing' })).toBeVisible();
  });
});