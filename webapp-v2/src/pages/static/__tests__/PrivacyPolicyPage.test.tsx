import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { PrivacyPolicyPage } from '../PrivacyPolicyPage';

describe('PrivacyPolicyPage', () => {
  it('renders without crashing', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
  });

  it('uses StaticPageLayout structure', () => {
    render(<PrivacyPolicyPage />);
    // StaticPageLayout adds header with Splitifyd branding and footer
    expect(screen.getAllByText('Splitifyd').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('© 2025 Splitifyd. All rights reserved.')).toBeInTheDocument();
  });

  it('contains privacy-related sections', () => {
    render(<PrivacyPolicyPage />);
    // Just verify the page has multiple sections (h2 elements)
    const sections = screen.getAllByRole('heading', { level: 2 });
    expect(sections.length).toBeGreaterThan(5); // Privacy policies typically have many sections
  });
});