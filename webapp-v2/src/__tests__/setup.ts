import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            // Map specific keys to expected values for tests
            const translations: Record<string, string> = {
                'comments.commentsSection.placeholderExpense': 'Add a comment to this expense...',
                'comments.commentsSection.placeholderGroup': 'Add a comment to this group...',
                'comments.commentInput.tooLong': 'Comment is too long',
            };
            return translations[key] || key;
        },
        i18n: {
            changeLanguage: () => new Promise(() => {}),
        },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: () => {},
    },
}));

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

// Mock requestAnimationFrame and cancelAnimationFrame for Preact
global.requestAnimationFrame = vi.fn((callback) => {
    return setTimeout(callback, 0) as unknown as number;
});
global.cancelAnimationFrame = vi.fn((id) => {
    clearTimeout(id);
});

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
