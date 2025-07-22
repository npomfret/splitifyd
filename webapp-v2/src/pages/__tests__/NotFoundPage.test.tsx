import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { NotFoundPage } from '../NotFoundPage';

// Test 404 page behavior
describe('NotFoundPage', () => {
  it('displays 404 error message', () => {
    render(<NotFoundPage />);
    
    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('provides a way to return home', () => {
    render(<NotFoundPage />);
    
    const homeLink = screen.getByRole('link', { name: 'Go Home' });
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('provides clear visual hierarchy', () => {
    render(<NotFoundPage />);
    
    const heading = screen.getByRole('heading', { name: '404' });
    const homeButton = screen.getByRole('link', { name: 'Go Home' });
    
    // 404 heading should be prominent and home button should be visible
    expect(heading).toBeVisible();
    expect(homeButton).toBeVisible();
  });
});