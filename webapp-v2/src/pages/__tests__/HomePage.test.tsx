import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { HomePage } from '../HomePage';

// Test HomePage behavior - what users actually see and can do
describe('HomePage', () => {
  it('displays welcome message', () => {
    render(<HomePage />);
    
    expect(screen.getByRole('heading', { name: 'Welcome to Splitifyd v2' })).toBeInTheDocument();
  });

  it('shows technology stack information', () => {
    render(<HomePage />);
    
    expect(screen.getByText('Built with Preact + Vite + TypeScript')).toBeInTheDocument();
  });

  it('provides login and signup links', () => {
    render(<HomePage />);
    
    const loginLink = screen.getByRole('link', { name: 'Login' });
    const signupLink = screen.getByRole('link', { name: 'Sign Up' });
    
    expect(loginLink).toHaveAttribute('href', '/login');
    expect(signupLink).toHaveAttribute('href', '/register');
  });

  it('displays main action buttons prominently', () => {
    render(<HomePage />);
    
    const loginButton = screen.getByRole('link', { name: 'Login' });
    const signupButton = screen.getByRole('link', { name: 'Sign Up' });
    
    // Both buttons should be visible and accessible
    expect(loginButton).toBeVisible();
    expect(signupButton).toBeVisible();
  });
});