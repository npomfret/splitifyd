import { getEnhancedConfigResponse } from '../utils/config';
import { CONFIG } from '../config';
import { validateAppConfiguration } from '../middleware/config-validation';

// Mock the CONFIG object and APP_CONFIG
jest.mock('../config', () => ({
  CONFIG: {
    isDevelopment: false,
    isProduction: true,
    isTest: false,
    projectId: 'test-project',
    clientConfig: {
      apiKey: 'test-api-key',
      authDomain: 'test.firebaseapp.com',
      storageBucket: 'test.firebasestorage.app',
      messagingSenderId: '123456789',
      appId: '1:123456789:web:abcdef',
      measurementId: 'G-TEST123',
    },
    formDefaults: undefined,
    warningBanner: '⚠️ this is a demo - your data will be deleted without notice',
    emulatorPorts: {}
  },
  APP_CONFIG: {
    appName: 'test-app',
    appDisplayName: 'Test App',
    firebaseProjectId: 'test-project',
    productionBaseUrl: 'https://test-project.web.app',
    apiBaseUrl: 'https://api.test-project.com'
  }
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
    beforeEach(() => {
      // Reset CONFIG for each test
      (CONFIG as any).clientConfig = {
        apiKey: 'test-api-key',
        authDomain: 'test.firebaseapp.com',
        storageBucket: 'test.firebasestorage.app',
        messagingSenderId: '123456789',
        appId: '1:123456789:web:abcdef',
        measurementId: 'G-TEST123',
      };
      (CONFIG as any).isProduction = true;
      (CONFIG as any).isDevelopment = false;
    });

    it('should return enhanced configuration format', () => {
      const config = getEnhancedConfigResponse();
      
      expect(config).toHaveProperty('firebase');
      expect(config).toHaveProperty('api');
      expect(config).toHaveProperty('features');
      expect(config).toHaveProperty('environment');
      
      expect(config.firebase).toEqual({
        apiKey: 'test-api-key',
        authDomain: 'test.firebaseapp.com',
        projectId: 'test-project',
        storageBucket: 'test.firebasestorage.app',
        messagingSenderId: '123456789',
        appId: '1:123456789:web:abcdef',
        measurementId: 'G-TEST123',
        firebaseAuthUrl: undefined
      });
      
      expect(config.api).toEqual({
        timeout: 30000,
        retryAttempts: 3
      });
      
      expect(config.environment).toMatchObject({
        isDevelopment: false,
        isProduction: true,
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

    it('should throw error when client config is undefined', () => {
      (CONFIG as any).clientConfig = undefined;
      
      expect(() => getEnhancedConfigResponse()).toThrow();
    });

    it('should not include warning banner when not set', () => {
      (CONFIG as any).warningBanner = '';
      
      const config = getEnhancedConfigResponse();
      
      expect(config.environment.warningBanner).toBeUndefined();
    });

    it('should include form defaults when available', () => {
      (CONFIG as any).formDefaults = {
        displayName: 'test',
        email: 'test@test.com',
        password: 'rrRR44$$'
      };
      
      const config = getEnhancedConfigResponse();
      
      // Form defaults now include password for development convenience
      // Credentials come from environment variables, not hardcoded values
      expect(config.formDefaults).toEqual({
        displayName: 'test',
        email: 'test@test.com',
        password: 'rrRR44$$'
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
        features: {},
        environment: {
          isDevelopment: false,
          isProduction: true
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
        features: {},
        environment: {
          isDevelopment: false,
          isProduction: true
        }
      };
      
      expect(() => validateAppConfiguration(invalidConfig)).toThrow();
    });
  });
});