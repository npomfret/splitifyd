// Suppress expected JSDOM errors that clutter test output
const originalConsoleError = console.error;
console.error = (...args) => {
  const errorString = args[0]?.toString() || '';
  
  // Suppress JSDOM navigation not implemented errors
  if (errorString.includes('Error: Not implemented: navigation')) {
    return;
  }
  
  // Suppress Error in state change handler messages that are intentionally tested
  if (errorString.includes('Error in state change handler:')) {
    return;
  }
  
  originalConsoleError.call(console, ...args);
};