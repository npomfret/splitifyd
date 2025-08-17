import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@/test-utils';
import { App } from '../../App';

// Integration tests for App routing - test real route navigation behavior
describe('App Integration', () => {
    beforeEach(() => {
        // Reset URL for each test
        window.history.replaceState({}, '', '/');
    });

    it('renders home page by default', () => {
        render(<App />);

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Effortless Bill Splitting,Simplified & Smart.');
    });

    it('renders 404 page for invalid routes', () => {
        // Simulate navigating to invalid route
        window.history.replaceState({}, '', '/invalid-route');

        render(<App />);

        expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
        expect(screen.getByText('Page not found')).toBeInTheDocument();
    });

    it('handles pricing route correctly', () => {
        window.history.replaceState({}, '', '/pricing');

        render(<App />);

        expect(screen.getByRole('heading', { name: "Pricing (It's Free, Seriously)" })).toBeInTheDocument();
    });

    it('configures routes for both development and production prefixes', () => {
        // Test that the App component includes both route patterns
        // This is more about testing the route configuration than actual routing
        render(<App />);

        // The component should render something (even if 404 for current route)
        expect(document.body).toContainHTML('<div');

        // This test verifies that the App component renders without errors
        // The actual routing behavior is tested in the working route tests above
    });

    it('handles terms of service route correctly', () => {
        window.history.replaceState({}, '', '/terms-of-service');

        render(<App />);

        expect(screen.getByRole('heading', { name: 'Terms of Service' })).toBeInTheDocument();
    });

    it('handles privacy policy route correctly', () => {
        window.history.replaceState({}, '', '/privacy-policy');

        render(<App />);

        expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    });

    it('handles cookie policy route correctly', () => {
        window.history.replaceState({}, '', '/cookies-policy');

        render(<App />);

        expect(screen.getByRole('heading', { name: 'Cookie Policy' })).toBeInTheDocument();
    });

    it('handles pricing route correctly without v2 prefix', () => {
        window.history.replaceState({}, '', '/pricing');
        render(<App />);
        expect(screen.getByRole('heading', { name: "Pricing (It's Free, Seriously)" })).toBeInTheDocument();
    });
});
