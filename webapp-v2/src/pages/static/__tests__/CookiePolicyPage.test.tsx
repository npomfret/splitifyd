import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { CookiePolicyPage } from '../CookiePolicyPage';

// Test Cookie Policy page behavior
describe('CookiePolicyPage', () => {
  it('displays cookie policy title', () => {
    render(<CookiePolicyPage />);
    
    expect(screen.getByRole('heading', { name: 'Cookie Policy' })).toBeInTheDocument();
  });

  it('shows last updated date', () => {
    render(<CookiePolicyPage />);
    
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    expect(screen.getByText(/January 22, 2025/)).toBeInTheDocument();
  });

  it('explains what cookies are', () => {
    render(<CookiePolicyPage />);
    
    expect(screen.getByText('What Are Cookies?')).toBeInTheDocument();
    expect(screen.getByText(/Cookies are small text files/)).toBeInTheDocument();
  });

  it('describes cookie types used', () => {
    render(<CookiePolicyPage />);
    
    expect(screen.getByText('How We Use Cookies')).toBeInTheDocument();
    expect(screen.getByText('Essential Cookies')).toBeInTheDocument();
    expect(screen.getByText('Functional Cookies')).toBeInTheDocument();  
    expect(screen.getByText('Analytics Cookies')).toBeInTheDocument();
    
    // Should mention specific uses
    expect(screen.getByText(/Authentication tokens/)).toBeInTheDocument();
    expect(screen.getAllByText(/Google Analytics/)[0]).toBeInTheDocument();
  });

  it('explains third-party cookies', () => {
    render(<CookiePolicyPage />);
    
    expect(screen.getByText('Third-Party Cookies')).toBeInTheDocument();
    expect(screen.getByText('Google Analytics')).toBeInTheDocument();
    expect(screen.getByText('Firebase/Google Services')).toBeInTheDocument();
  });

  it('provides cookie management information', () => {
    render(<CookiePolicyPage />);
    
    expect(screen.getByText('Managing Cookies')).toBeInTheDocument();
    expect(screen.getByText('Browser Settings')).toBeInTheDocument();
    expect(screen.getByText('Impact of Disabling Cookies')).toBeInTheDocument();
    
    expect(screen.getByText(/Most web browsers allow you to control cookies/)).toBeInTheDocument();
  });

  it('warns about functionality impact', () => {
    render(<CookiePolicyPage />);
    
    expect(screen.getByText(/disabling cookies may affect the functionality/)).toBeInTheDocument();
    expect(screen.getByText(/Staying logged in to your account/)).toBeInTheDocument();
  });

  it('provides contact information', () => {
    render(<CookiePolicyPage />);
    
    expect(screen.getByText('Contact Us')).toBeInTheDocument();
    expect(screen.getByText(/cookies@splitifyd.com/)).toBeInTheDocument();
  });

  it('has external links to third-party policies', () => {
    render(<CookiePolicyPage />);
    
    const googlePrivacyLink = screen.getByRole('link', { name: 'Google Privacy Policy' });
    const firebasePrivacyLink = screen.getByRole('link', { name: 'Firebase Privacy Policy' });
    
    expect(googlePrivacyLink).toHaveAttribute('href', 'https://policies.google.com/privacy');
    expect(firebasePrivacyLink).toHaveAttribute('href', 'https://firebase.google.com/support/privacy');
  });

  it('has proper page structure', () => {
    render(<CookiePolicyPage />);
    
    // Should use StaticPageLayout
    expect(screen.getAllByText('Splitifyd').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('© 2025 Splitifyd. All rights reserved.')).toBeInTheDocument();
  });
});