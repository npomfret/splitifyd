import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { TermsOfServicePage } from '../TermsOfServicePage';

// Test Terms of Service page behavior
describe('TermsOfServicePage', () => {
  it('displays terms of service title', () => {
    render(<TermsOfServicePage />);
    
    expect(screen.getByRole('heading', { name: 'Terms of Service' })).toBeInTheDocument();
  });

  it('shows last updated date', () => {
    render(<TermsOfServicePage />);
    
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
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