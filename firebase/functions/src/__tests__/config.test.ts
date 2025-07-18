import { getEnhancedConfigResponse } from '../utils/config-response';
import { getAppConfig, getConfig } from '../config';
import { validateAppConfiguration } from '../middleware/config-validation';

// Mock the getConfig and getAppConfig functions
jest.mock('../config', () => ({
  getConfig: () => ({
    isDevelopment: false,
    isProduction: true,
    requestBodyLimit: '1mb',
    rateLimiting: {
      windowMs: 60000,
      maxRequests: 100,
      cleanupIntervalMs: 300000
    },
    validation: {
      maxRequestSizeBytes: 1048576,
      maxObjectDepth: 10,
      maxStringLength: 10000,
      maxPropertyCount: 100,
      maxPropertyNameLength: 100
    },
    document: {
      listLimit: 50,
      previewLength: 100
    },
    formDefaults: {
      displayName: '',
      email: '',
      password: ''
    },
    warningBanner: '⚠️ this is a demo - your data will be deleted without notice'
  }),
  getAppConfig: () => ({
    firebase: {
      apiKey: 'test-api-key',
      authDomain: 'test.firebaseapp.com',
      projectId: 'test-project',
      storageBucket: 'test.firebasestorage.app',
      messagingSenderId: '123456789',
      appId: '1:123456789:web:abcdef',
      measurementId: 'G-TEST123'
    },
    api: {
      timeout: 30000,
      retryAttempts: 3
    },
    environment: {
      warningBanner: {
        enabled: true,
        message: '⚠️ this is a demo - your data will be deleted without notice'
      }
    },
    formDefaults: {
      displayName: '',
      email: '',
      password: ''
    },
    firebaseAuthUrl: undefined
  })
}));

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe('Configuration Response Functions', () => {

  describe('getEnhancedConfigResponse', () => {

    it('should return enhanced configuration format', () => {
      const config = getEnhancedConfigResponse();
      
      expect(config).toHaveProperty('firebase');
      expect(config).toHaveProperty('api');
      expect(config).toHaveProperty('environment');
      expect(config).toHaveProperty('formDefaults');
      expect(config).toHaveProperty('firebaseAuthUrl');
      
      expect(config.firebase).toEqual({
        apiKey: 'test-api-key',
        authDomain: 'test.firebaseapp.com',
        projectId: 'test-project',
        storageBucket: 'test.firebasestorage.app',
        messagingSenderId: '123456789',
        appId: '1:123456789:web:abcdef',
        measurementId: 'G-TEST123'
      });
      
      expect(config.api).toEqual({
        timeout: 30000,
        retryAttempts: 3
      });
      
      expect(config.environment).toMatchObject({
        warningBanner: {
          enabled: true,
          message: '⚠️ this is a demo - your data will be deleted without notice'
        }
      });
    });



    it('should validate configuration schema', () => {
      const config = getEnhancedConfigResponse();
      
      expect(() => validateAppConfiguration(config)).not.toThrow();
    });

    it('should return pre-built configuration', () => {
      // Since APP_CONFIG is built at startup, getEnhancedConfigResponse just returns it
      const config = getEnhancedConfigResponse();
      
      expect(config).toBe((APP_CONFIG as any));
    });

    it('should include warning banner when configured', () => {
      const config = getEnhancedConfigResponse();
      
      // Warning banner is configured in the mock
      expect(config.environment.warningBanner).toEqual({
        enabled: true,
        message: '⚠️ this is a demo - your data will be deleted without notice'
      });
    });

    it('should include form defaults as empty strings in production', () => {
      const config = getEnhancedConfigResponse();
      
      // Form defaults are empty strings in production
      expect(config.formDefaults).toEqual({
        displayName: '',
        email: '',
        password: ''
      });
    });
  });

  describe('Configuration Validation', () => {
    it('should validate a complete configuration', () => {
      const validConfig = {
        firebase: {
          apiKey: 'test-key',
          authDomain: 'test.firebaseapp.com',
          projectId: 'test-project',
          storageBucket: 'test.firebasestorage.app',
          messagingSenderId: '123456',
          appId: '1:123456:web:abc'
        },
        api: {
          timeout: 30000,
          retryAttempts: 3
        },
        environment: {},
        formDefaults: {
          displayName: '',
          email: '',
          password: ''
        }
      };
      
      expect(() => validateAppConfiguration(validConfig)).not.toThrow();
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        firebase: {
          apiKey: '', // Empty string should fail
          authDomain: 'test.firebaseapp.com',
          projectId: 'test-project',
          storageBucket: 'test.firebasestorage.app',
          messagingSenderId: '123456',
          appId: '1:123456:web:abc'
        },
        api: {
          timeout: -1, // Negative timeout should fail
          retryAttempts: 3
        },
        environment: {},
        formDefaults: {
          displayName: '',
          email: '',
          password: ''
        }
      };
      
      expect(() => validateAppConfiguration(invalidConfig)).toThrow();
    });
  });
});