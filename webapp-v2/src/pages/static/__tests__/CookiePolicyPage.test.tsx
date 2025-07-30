import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { CookiePolicyPage } from '../CookiePolicyPage';

describe('CookiePolicyPage', () => {
  it('renders without crashing', () => {
    render(<CookiePolicyPage />);
    expect(screen.getByRole('heading', { name: 'Cookie Policy' })).toBeInTheDocument();
  });

  it('uses StaticPageLayout structure', () => {
    render(<CookiePolicyPage />);
    // StaticPageLayout adds header with Splitifyd branding and footer
    expect(screen.getAllByText('Splitifyd').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('© 2025 Splitifyd. All rights reserved.')).toBeInTheDocument();
  });

  it('contains cookie-related sections', () => {
    render(<CookiePolicyPage />);
    // Just verify the page has multiple sections (h2 elements)
    const sections = screen.getAllByRole('heading', { level: 2 });
    expect(sections.length).toBeGreaterThan(3); // Cookie policies typically have several sections
  });
});