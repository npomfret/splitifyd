import { render as originalRender } from '@testing-library/preact';
import { AuthContext } from './app/providers/AuthProvider';
import type { ComponentChildren } from 'preact';

// Mock auth store for tests
const mockAuthStore = {
    user: null,
    loading: false,
    error: null,
    initialized: true,
    login: () => Promise.resolve(),
    register: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    resetPassword: () => Promise.resolve(),
    updateUserProfile: () => Promise.resolve(),
    clearError: () => {},
    refreshAuthToken: () => Promise.resolve('mock-token'),
};

// Custom render function that wraps components with providers
function customRender(ui: ComponentChildren, options = {}) {
    return originalRender(<AuthContext.Provider value={mockAuthStore}>{ui}</AuthContext.Provider>, options);
}

// Re-export everything else from testing library
export * from '@testing-library/preact';

// Export custom render with same name
export { customRender as render };
