/**
 * Setup for integration tests
 * 
 * Unlike the regular setup.ts, this does NOT mock fetch or other APIs
 * because integration tests need to make real HTTP requests
 */

import '@testing-library/jest-dom';

// Don't mock fetch - we need the real implementation for integration tests
// Node.js 18+ has native fetch support, but jsdom doesn't provide it
// So we need to explicitly set it
if (!globalThis.fetch) {
  // Import node's native fetch
  globalThis.fetch = global.fetch;
  globalThis.Headers = global.Headers;
  globalThis.Request = global.Request;
  globalThis.Response = global.Response;
}

// Still need to mock some browser-only APIs that aren't used in integration tests
global.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Mock localStorage for any code that might use it
const localStorageMock = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});