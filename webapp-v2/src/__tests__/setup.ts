import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.API_BASE_URL which is injected by the build process
(window as any).API_BASE_URL = 'http://localhost:6001/splitifyd/us-central1';

// Mock fetch for API client tests
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));