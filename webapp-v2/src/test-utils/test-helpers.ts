import { act } from '@testing-library/preact';

// Common test helpers and utilities

/**
 * Polling pattern for testing asynchronous operations
 * Use this for database triggers, message queues, search indexing, cache updates, etc.
 */
export async function pollUntil<T>(
  fetcher: () => Promise<T>,      // Function that retrieves data
  matcher: (value: T) => boolean, // Function that tests the condition
  options: {
    timeout?: number;    // Total timeout in ms (default: 10000)
    interval?: number;   // Polling interval in ms (default: 500)
    errorMsg?: string;   // Custom error message
  } = {}
): Promise<T> {
  const { timeout = 10000, interval = 500, errorMsg = 'Condition not met' } = options;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await fetcher();
      if (matcher(result)) {
        return result;
      }
    } catch (error) {
      // Log but continue polling (or fail fast if needed)
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`${errorMsg} after ${timeout}ms`);
}

/**
 * Common matcher functions for polling
 */
export const matchers = {
  // Wait for specific status
  hasStatus: (status: string) => (data: any) => data.status === status,
  
  // Wait for property to exist
  hasProperty: (property: string) => (obj: any) => obj[property] !== undefined,
  
  // Wait for minimum count
  hasMinCount: (minCount: number) => (list: any[]) => list.length >= minCount,
  
  // Wait for value change
  valueChanged: (initialValue: any) => (data: any) => data.value !== initialValue,
  
  // Wait for element to be visible
  isVisible: () => (element: HTMLElement | null) => element && element.style.display !== 'none',
};

/**
 * Flush all pending promises
 */
export async function flushPromises(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

/**
 * Simple mock function helper for tests
 */
export function createMockFn<T extends (...args: any[]) => any>() {
  const calls: Parameters<T>[] = [];
  const fn = (...args: Parameters<T>) => {
    calls.push(args);
    return undefined as ReturnType<T>;
  };
  
  return Object.assign(fn, {
    getCalls: () => [...calls],
    callCount: () => calls.length,
  });
}

/**
 * Mock localStorage for testing
 */
export const mockLocalStorage = {
  data: new Map<string, string>(),
  
  getItem: (key: string) => mockLocalStorage.data.get(key) || null,
  
  setItem: (key: string, value: string) => {
    mockLocalStorage.data.set(key, value);
  },
  
  removeItem: (key: string) => {
    mockLocalStorage.data.delete(key);
  },
  
  clear: () => {
    mockLocalStorage.data.clear();
  },
  
  key: (index: number) => {
    const keys = Array.from(mockLocalStorage.data.keys());
    return keys[index] || null;
  },
  
  get length() {
    return mockLocalStorage.data.size;
  },
  
  reset() {
    this.data.clear();
  }
};

/**
 * Mock fetch for API testing
 */
export function mockFetch(responses: { [url: string]: any } = {}) {
  const fetchMock = (url: string, _options?: RequestInit) => {
    const response = responses[url];
    
    if (!response) {
      return Promise.reject(new Error(`No mock response configured for ${url}`));
    }
    
    return Promise.resolve({
      ok: response.status ? response.status < 400 : true,
      status: response.status || 200,
      json: () => Promise.resolve(response.data || response),
      text: () => Promise.resolve(typeof response === 'string' ? response : JSON.stringify(response)),
    });
  };
  
  global.fetch = fetchMock as any;
  return fetchMock;
}

/**
 * Test error boundary helper
 */
export function expectToThrow(fn: () => void, expectedError?: string | RegExp) {
  expect(fn).toThrow(expectedError);
}