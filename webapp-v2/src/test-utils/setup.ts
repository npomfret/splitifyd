import '@testing-library/jest-dom';

// Global test setup
global.ResizeObserver = global.ResizeObserver || 
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
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