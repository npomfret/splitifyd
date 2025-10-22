import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

const matchMediaMock = () => ({
    matches: false,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
});

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: matchMediaMock,
    });
}

if (typeof global !== 'undefined' && typeof (global as any).matchMedia !== 'function') {
    (global as any).matchMedia = matchMediaMock;
}
