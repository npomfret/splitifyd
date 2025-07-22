import '@testing-library/jest-dom';

// Global test setup
global.ResizeObserver = global.ResizeObserver || 
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

global.IntersectionObserver = global.IntersectionObserver ||
  class IntersectionObserver {
    root: Element | Document | null = null;
    rootMargin: string = '0px';
    thresholds: ReadonlyArray<number> = [0];
    
    constructor(public callback: IntersectionObserverCallback) {}
    
    observe() {
      // Simulate immediate intersection
      this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  };

global.matchMedia = global.matchMedia || 
  function(query: string) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    };
  };