import { describe, it, expect } from 'vitest';
import { ApiClient } from './utils';

describe('System Endpoints API Integration', () => {
  const client = new ApiClient();

  describe('/config endpoint', () => {
    it('should return Firebase configuration', async () => {
      const response = await client.get<any>('/config');
      
      // Should have firebase config object
      expect(response).toHaveProperty('firebase');
      const firebaseConfig = response.firebase;
      
      // Should have apiKey
      expect(firebaseConfig).toHaveProperty('apiKey');
      expect(typeof firebaseConfig.apiKey).toBe('string');
      expect(firebaseConfig.apiKey.length).toBeGreaterThan(10);
      
      // Should have projectId
      expect(firebaseConfig).toHaveProperty('projectId');
      expect(typeof firebaseConfig.projectId).toBe('string');
      
      // Should have other Firebase config fields
      expect(firebaseConfig).toHaveProperty('authDomain');
      expect(firebaseConfig).toHaveProperty('storageBucket');
      expect(firebaseConfig).toHaveProperty('messagingSenderId');
      expect(firebaseConfig).toHaveProperty('appId');
    });

    it('should include enhanced config fields', async () => {
      const response = await client.get<any>('/config');
      
      // Should have environment info
      expect(response).toHaveProperty('environment');
      expect(response.environment).toHaveProperty('warningBanner');
      
      // Should have api config
      expect(response).toHaveProperty('api');
      expect(response.api).toHaveProperty('timeout');
      expect(response.api).toHaveProperty('retryAttempts');
      
      // Should have formDefaults
      expect(response).toHaveProperty('formDefaults');
      expect(response.formDefaults).toHaveProperty('displayName');
      expect(response.formDefaults).toHaveProperty('email');
      expect(response.formDefaults).toHaveProperty('password');
      
      // Should have firebaseAuthUrl
      expect(response).toHaveProperty('firebaseAuthUrl');
      expect(typeof response.firebaseAuthUrl).toBe('string');
    });
  });

  describe('/health endpoint', () => {
    it('should return healthy status', async () => {
      const response = await client.get<any>('/health');
      
      // Should have status
      expect(response).toHaveProperty('status');
      expect(response.status).toBe('healthy');
      
      // Should have timestamp
      expect(response).toHaveProperty('timestamp');
      expect(typeof response.timestamp).toBe('string');
      
      // Should have checks
      expect(response).toHaveProperty('checks');
      expect(typeof response.checks).toBe('object');
    });

    it('should include firestore health check', async () => {
      const response = await client.get<any>('/health');
      
      expect(response.checks).toHaveProperty('firestore');
      expect(response.checks.firestore).toHaveProperty('status');
      expect(response.checks.firestore.status).toBe('healthy');
      expect(response.checks.firestore).toHaveProperty('responseTime');
      expect(typeof response.checks.firestore.responseTime).toBe('number');
    });

    it('should include auth health check', async () => {
      const response = await client.get<any>('/health');
      
      expect(response.checks).toHaveProperty('auth');
      expect(response.checks.auth).toHaveProperty('status');
      expect(response.checks.auth.status).toBe('healthy');
      expect(response.checks.auth).toHaveProperty('responseTime');
      expect(typeof response.checks.auth.responseTime).toBe('number');
    });

    it('should have reasonable response times', async () => {
      const response = await client.get<any>('/health');
      
      // Firestore should respond within 5 seconds
      expect(response.checks.firestore.responseTime).toBeLessThan(5000);
      
      // Auth should respond within 5 seconds
      expect(response.checks.auth.responseTime).toBeLessThan(5000);
    });
  });

  describe('/status endpoint', () => {
    it('should return system status', async () => {
      const response = await client.get<any>('/status');
      
      // Should have timestamp
      expect(response).toHaveProperty('timestamp');
      expect(typeof response.timestamp).toBe('string');
      
      // Should have uptime
      expect(response).toHaveProperty('uptime');
      expect(typeof response.uptime).toBe('number');
      expect(response.uptime).toBeGreaterThanOrEqual(0);
      
      // Should have version
      expect(response).toHaveProperty('version');
      expect(typeof response.version).toBe('string');
      
      // Should have nodeVersion
      expect(response).toHaveProperty('nodeVersion');
      expect(response.nodeVersion).toMatch(/^v\d+\.\d+\.\d+/);
      
      // Should have environment
      expect(response).toHaveProperty('environment');
      expect(['production', 'development', 'staging']).toContain(response.environment);
    });

    it('should return memory usage', async () => {
      const response = await client.get<any>('/status');
      
      expect(response).toHaveProperty('memory');
      expect(response.memory).toHaveProperty('rss');
      expect(response.memory).toHaveProperty('heapUsed');
      expect(response.memory).toHaveProperty('heapTotal');
      expect(response.memory).toHaveProperty('external');
      
      // All memory values should be strings with MB suffix
      expect(response.memory.rss).toMatch(/^\d+ MB$/);
      expect(response.memory.heapUsed).toMatch(/^\d+ MB$/);
      expect(response.memory.heapTotal).toMatch(/^\d+ MB$/);
      expect(response.memory.external).toMatch(/^\d+ MB$/);
    });
  });

  describe('/env endpoint', () => {
    it('should return environment information', async () => {
      const response = await client.get<any>('/env');
      
      // Should have env object
      expect(response).toHaveProperty('env');
      expect(typeof response.env).toBe('object');
      
      // Should have build info
      expect(response).toHaveProperty('build');
      expect(response.build).toHaveProperty('timestamp');
      expect(response.build).toHaveProperty('date');
      expect(response.build).toHaveProperty('version');
      
      // Should have runtime info
      expect(response).toHaveProperty('runtime');
      expect(response.runtime).toHaveProperty('startTime');
      expect(response.runtime).toHaveProperty('uptime');
      expect(response.runtime).toHaveProperty('uptimeHuman');
      
      // Should have memory info
      expect(response).toHaveProperty('memory');
      expect(response.memory).toHaveProperty('rss');
      expect(response.memory).toHaveProperty('heapTotal');
      expect(response.memory).toHaveProperty('heapUsed');
      
      // Should have filesystem info
      expect(response).toHaveProperty('filesystem');
      expect(response.filesystem).toHaveProperty('currentDirectory');
      expect(response.filesystem).toHaveProperty('files');
      expect(Array.isArray(response.filesystem.files)).toBe(true);
    });

    it('should format memory values correctly', async () => {
      const response = await client.get<any>('/env');
      
      // Memory values should be human-readable
      const memoryKeys = ['rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers'];
      memoryKeys.forEach(key => {
        if (response.memory[key]) {
          expect(response.memory[key]).toMatch(/^\d+(\.\d+)?\s+(B|KB|MB|GB)$/);
        }
      });
    });

    it('should list files in current directory', async () => {
      const response = await client.get<any>('/env');
      
      expect(response.filesystem.files.length).toBeGreaterThan(0);
      
      // Each file should have expected properties
      const firstFile = response.filesystem.files[0];
      if (!firstFile.error) {
        expect(firstFile).toHaveProperty('name');
        expect(firstFile).toHaveProperty('type');
        expect(['file', 'dir']).toContain(firstFile.type);
        expect(firstFile).toHaveProperty('modified');
      }
    });
  });

  describe('CSP violation reporting', () => {
    it('should accept CSP violation reports', async () => {
      const violation = {
        'document-uri': 'http://example.com',
        'referrer': '',
        'blocked-uri': 'http://evil.com/script.js',
        'violated-directive': 'script-src',
        'original-policy': "default-src 'self'",
      };

      // Should return 204 No Content
      await expect(client.post('/csp-violation-report', violation)).resolves.toBe('');
    });

    it('should handle empty CSP reports', async () => {
      // Should still return 204
      await expect(client.post('/csp-violation-report', {})).resolves.toBe('');
    });

    it('should handle malformed CSP reports', async () => {
      // Should still return 204 (graceful handling)
      await expect(client.post('/csp-violation-report', null)).resolves.toBe('');
    });
  });

  describe('404 handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      await expect(client.get('/non-existent-endpoint')).rejects.toThrow(/404/);
    });

    it('should return proper error structure for 404s', async () => {
      try {
        await client.get('/this-does-not-exist');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('404');
        expect(error.message).toContain('NOT_FOUND');
      }
    });
  });
});