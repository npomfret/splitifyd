import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { findProjectRoot, getFirebaseEmulatorConfig } from '@splitifyd/test-support';

// Mock window.API_BASE_URL - use dynamic port from shared config
const config = getFirebaseEmulatorConfig(findProjectRoot(__dirname));
(window as any).API_BASE_URL = config.baseUrl;

// Mock fetch for API client tests
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

// Mock window.matchMedia for GSAP
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // Deprecated
        removeListener: vi.fn(), // Deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock auth store
const mockAuthStore = {
    user: null,
    loading: false,
    error: null,
    initialized: true,
    login: vi.fn(() => Promise.resolve()),
    register: vi.fn(() => Promise.resolve()),
    logout: vi.fn(() => Promise.resolve()),
    resetPassword: vi.fn(() => Promise.resolve()),
    clearError: vi.fn(),
};

vi.mock('../app/stores/auth-store', () => ({
    getAuthStore: vi.fn(() => Promise.resolve(mockAuthStore)),
    createAuthStore: vi.fn(() => Promise.resolve(mockAuthStore)),
}));

// Mock auth hooks
vi.mock('../app/hooks/useAuth', () => ({
    useAuth: vi.fn(() => mockAuthStore),
}));

vi.mock('../app/hooks/useAuthRequired', () => ({
    useAuthRequired: vi.fn(() => ({
        ...mockAuthStore,
        user: { uid: 'test-user', email: 'test@example.com' },
    })),
}));

// Mock GSAP modules
vi.mock('gsap', () => ({
    gsap: {
        registerPlugin: vi.fn(),
        timeline: vi.fn(() => ({
            to: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            fromTo: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            add: vi.fn().mockReturnThis(),
            play: vi.fn().mockReturnThis(),
            pause: vi.fn().mockReturnThis(),
            kill: vi.fn().mockReturnThis(),
        })),
        to: vi.fn(),
        from: vi.fn(),
        fromTo: vi.fn(),
        set: vi.fn(),
        killTweensOf: vi.fn(),
    },
    ScrollTrigger: {
        create: vi.fn(),
        refresh: vi.fn(),
        killAll: vi.fn(),
    },
    default: {
        registerPlugin: vi.fn(),
        timeline: vi.fn(() => ({
            to: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            fromTo: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            add: vi.fn().mockReturnThis(),
            play: vi.fn().mockReturnThis(),
            pause: vi.fn().mockReturnThis(),
            kill: vi.fn().mockReturnThis(),
        })),
        to: vi.fn(),
        from: vi.fn(),
        fromTo: vi.fn(),
        set: vi.fn(),
        killTweensOf: vi.fn(),
    },
}));
