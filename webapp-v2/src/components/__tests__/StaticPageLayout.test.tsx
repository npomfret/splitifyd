import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { StaticPageLayout } from '../StaticPageLayout';

// Test the StaticPageLayout behavior - what it actually renders
describe('StaticPageLayout', () => {
  it('renders the page title correctly', () => {
    render(
      <StaticPageLayout title="Test Page" description="Test description">
        <p>Test content</p>
      </StaticPageLayout>
    );
    
    expect(screen.getByRole('heading', { name: 'Test Page' })).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <StaticPageLayout title="Test Page" description="Test description">
        <p>Custom test content</p>
      </StaticPageLayout>
    );
    
    expect(screen.getByText('Custom test content')).toBeInTheDocument();
  });

  it('includes navigation links', () => {
    render(
      <StaticPageLayout title="Test Page" description="Test description">
        <p>Content</p>
      </StaticPageLayout>
    );
    
    // Check for main navigation links - there might be multiple Pricing links (header + footer)
    expect(screen.getByRole('link', { name: 'Splitifyd' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/v2/pricing');
  });

  it('includes footer with legal links', () => {
    render(
      <StaticPageLayout title="Test Page" description="Test description">
        <p>Content</p>
      </StaticPageLayout>
    );
    
    // Check for footer legal links
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/v2/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/v2/privacy');
    expect(screen.getByRole('link', { name: 'Cookie Policy' })).toHaveAttribute('href', '/v2/cookies');
  });

  it('displays company branding', () => {
    render(
      <StaticPageLayout title="Test Page" description="Test description">
        <p>Content</p>
      </StaticPageLayout>
    );
    
    // Check for Splitifyd branding - expect multiple instances (header + footer)
    expect(screen.getAllByText('Splitifyd').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('© 2025 Pomo Corp ltd. All rights reserved.')).toBeInTheDocument();
  });

  it('includes company description in footer', () => {
    render(
      <StaticPageLayout title="Test Page" description="Test description">
        <p>Content</p>
      </StaticPageLayout>
    );
    
    expect(screen.getByText(/Split bills easily with friends and family/)).toBeInTheDocument();
  });
});