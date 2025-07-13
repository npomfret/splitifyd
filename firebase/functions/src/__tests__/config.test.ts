import { getFirebaseConfigResponse, getEnhancedConfigResponse } from '../utils/config';
import { CONFIG } from '../config';
import { validateAppConfiguration } from '../middleware/config-validation';

// Mock the CONFIG object
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
  describe('getFirebaseConfigResponse', () => {
    it('should return legacy configuration format', () => {
      const config = getFirebaseConfigResponse();
      
      expect(config).toHaveProperty('apiKey', 'test-api-key');
      expect(config).toHaveProperty('authDomain', 'test.firebaseapp.com');
      expect(config).toHaveProperty('projectId', 'test-project');
      expect(config).toHaveProperty('storageBucket', 'test.firebasestorage.app');
      expect(config).toHaveProperty('messagingSenderId', '123456789');
      expect(config).toHaveProperty('appId', '1:123456789:web:abcdef');
      expect(config).toHaveProperty('measurementId', 'G-TEST123');
      expect(config).toHaveProperty('warningBanner', '⚠️ this is a demo - your data will be deleted without notice');
    });

    it('should include form defaults in development with emulator', () => {
      // Mock development environment
      (CONFIG as any).isDevelopment = true;
      (CONFIG as any).formDefaults = {
        displayName: 'test',
        email: 'test@test.com',
        password: 'rrRR44$$'
      };

      const config = getFirebaseConfigResponse();
      
      expect(config.formDefaults).toEqual({
        displayName: 'test',
        email: 'test@test.com',
        password: 'rrRR44$$'
      });
    });

    it('should throw error when client config is undefined', () => {
      (CONFIG as any).clientConfig = undefined;
      
      expect(() => getFirebaseConfigResponse()).toThrow();
    });
  });

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
        measurementId: 'G-TEST123'
      });
      
      expect(config.api).toEqual({
        baseUrl: '/api',
        timeout: 30000,
        retryAttempts: 3
      });
      
      expect(config.environment).toMatchObject({
        isDevelopment: false,
        isProduction: true,
        isEmulator: false, // No emulator in production config
        warningBanner: {
          enabled: true,
          message: '⚠️ this is a demo - your data will be deleted without notice'
        }
      });
    });


    it('should use development API base URL when not in production', () => {
      (CONFIG as any).isProduction = false;
      (CONFIG as any).isDevelopment = true;
      
      const config = getEnhancedConfigResponse();
      
      expect(config.api.baseUrl).toBe('http://localhost:5001/test-project/us-central1/api');
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
          baseUrl: '/api',
          timeout: 30000,
          retryAttempts: 3
        },
        features: {},
        environment: {
          isDevelopment: false,
          isProduction: true,
          isEmulator: false
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
          baseUrl: '/api',
          timeout: -1, // Negative timeout should fail
          retryAttempts: 3
        },
        features: {},
        environment: {
          isDevelopment: false,
          isProduction: true,
          isEmulator: false
        }
      };
      
      expect(() => validateAppConfiguration(invalidConfig)).toThrow();
    });
  });
});