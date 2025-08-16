// Jest setup file for Firebase Functions tests
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK for tests
if (!admin.apps.length) {
  // Set emulator ports
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  
  admin.initializeApp({
    projectId: 'test-project',
  });
}

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Suppress console logs during tests unless explicitly debugging
if (process.env.DEBUG_TESTS !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}