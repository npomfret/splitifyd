import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { PrivacyPolicyPage } from '../PrivacyPolicyPage';

// Test Privacy Policy page behavior  
describe('PrivacyPolicyPage', () => {
  it('displays privacy policy title', () => {
    render(<PrivacyPolicyPage />);
    
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
  });

  it('shows last updated date', () => {
    render(<PrivacyPolicyPage />);
    
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    expect(screen.getByText(/January 22, 2025/)).toBeInTheDocument();
  });

  it('explains data collection practices', () => {
    render(<PrivacyPolicyPage />);
    
    expect(screen.getByText('1. Information We Collect')).toBeInTheDocument();
    expect(screen.getByText('Personal Information')).toBeInTheDocument();
    expect(screen.getByText('Automatically Collected Information')).toBeInTheDocument();
    
    // Should mention key data types
    expect(screen.getByText(/Name and email address/)).toBeInTheDocument();
    expect(screen.getByText(/Device information \(IP address/)).toBeInTheDocument();
  });

  it('describes how data is used', () => {
    render(<PrivacyPolicyPage />);
    
    expect(screen.getByText('2. How We Use Your Information')).toBeInTheDocument();
    expect(screen.getByText(/Provide, maintain, and improve our services/)).toBeInTheDocument();
    expect(screen.getByText(/Process transactions and send notifications/)).toBeInTheDocument();
  });

  it('explains data sharing practices', () => {
    render(<PrivacyPolicyPage />);
    
    expect(screen.getByText('3. Information Sharing')).toBeInTheDocument();
    expect(screen.getByText('With Other Users')).toBeInTheDocument();
    expect(screen.getByText('Service Providers')).toBeInTheDocument();
    expect(screen.getByText('Legal Requirements')).toBeInTheDocument();
  });

  it('describes user rights', () => {
    render(<PrivacyPolicyPage />);
    
    expect(screen.getByText('5. Your Rights')).toBeInTheDocument();
    expect(screen.getByText(/Access to your personal information/)).toBeInTheDocument();
    expect(screen.getByText(/Deletion of your personal information/)).toBeInTheDocument();
  });

  it('provides contact information', () => {
    render(<PrivacyPolicyPage />);
    
    expect(screen.getByText('9. Contact Us')).toBeInTheDocument();
    expect(screen.getByText(/privacy@splitifyd.com/)).toBeInTheDocument();
  });

  it('has proper page structure', () => {
    render(<PrivacyPolicyPage />);
    
    // Should use StaticPageLayout
    expect(screen.getAllByText('Splitifyd').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('© 2025 Splitifyd. All rights reserved.')).toBeInTheDocument();
  });
});