import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { PricingPage } from '../PricingPage';

// Test pricing page behavior - what users actually see and can interact with
describe('PricingPage', () => {
  it('displays pricing information clearly', () => {
    render(<PricingPage />);
    
    expect(screen.getByRole('heading', { name: 'Pricing' })).toBeInTheDocument();
    expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument();
  });

  it('shows free plan with benefits', () => {
    render(<PricingPage />);
    
    // Free plan should be prominently displayed
    expect(screen.getByRole('heading', { name: 'Free' })).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getAllByText('/month')[0]).toBeInTheDocument();
    
    // Key benefits should be listed
    expect(screen.getByText('Split bills with unlimited friends')).toBeInTheDocument();
    expect(screen.getByText('Track expenses and balances')).toBeInTheDocument();
    expect(screen.getByText('Email notifications')).toBeInTheDocument();
  });

  it('shows premium plan as coming soon', () => {
    render(<PricingPage />);
    
    expect(screen.getByRole('heading', { name: 'Premium' })).toBeInTheDocument();
    expect(screen.getByText('$5')).toBeInTheDocument();
    expect(screen.getAllByText('Coming Soon')[0]).toBeInTheDocument();
    
    // Premium features should be listed
    expect(screen.getByText('Everything in Free')).toBeInTheDocument();
    expect(screen.getByText('Advanced reporting')).toBeInTheDocument();
    expect(screen.getByText('Receipt scanning')).toBeInTheDocument();
  });

  it('provides FAQ section with helpful information', () => {
    render(<PricingPage />);
    
    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
    expect(screen.getByText('Is Splitifyd really free?')).toBeInTheDocument();
    expect(screen.getByText(/Yes! All core features for splitting bills/)).toBeInTheDocument();
  });

  it('includes call-to-action buttons', () => {
    render(<PricingPage />);
    
    const freeButton = screen.getByRole('button', { name: 'Get Started Free' });
    const comingSoonButton = screen.getByRole('button', { name: 'Coming Soon' });
    
    expect(freeButton).toBeInTheDocument();
    expect(comingSoonButton).toBeInTheDocument();
    // Coming soon button should not be actionable (has cursor-not-allowed class)
    expect(comingSoonButton).toHaveClass('cursor-not-allowed');
  });

  it('has call-to-action section at bottom', () => {
    render(<PricingPage />);
    
    expect(screen.getByText('Ready to Split Bills Fairly?')).toBeInTheDocument();
    expect(screen.getByText(/Join thousands of users who trust Splitifyd/)).toBeInTheDocument();
    
    const ctaButton = screen.getByRole('link', { name: 'Start Splitting Bills' });
    expect(ctaButton).toHaveAttribute('href', '/');
  });

  it('has proper page structure', () => {
    render(<PricingPage />);
    
    // Should use StaticPageLayout which provides header/footer
    expect(screen.getAllByText('Splitifyd').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('© 2025 Splitifyd. All rights reserved.')).toBeInTheDocument();
  });
});