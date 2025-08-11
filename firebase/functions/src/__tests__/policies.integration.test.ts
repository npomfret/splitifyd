import * as admin from 'firebase-admin';
import { FirestoreCollections, PolicyIds } from '../shared/shared-types';
import * as crypto from 'crypto';

// Set up environment for tests
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8180';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const API_BASE_URL = 'http://127.0.0.1:5001/splitifyd/us-central1/api';

describe('Policies API Integration Tests', () => {
  beforeAll(async () => {
    // Initialize admin SDK for test setup
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: 'splitifyd'
      });
    }

    // Seed test data
    const firestore = admin.firestore();
    const now = new Date().toISOString();
    
    const testPolicyText = '# Test Policy\n\nThis is a test policy for integration testing.';
    const testPolicyHash = crypto.createHash('sha256').update(testPolicyText, 'utf8').digest('hex');
    
    await firestore.collection(FirestoreCollections.POLICIES).doc(PolicyIds.TERMS_OF_SERVICE).set({
      id: PolicyIds.TERMS_OF_SERVICE,
      policyName: 'Terms of Service',
      currentVersionHash: testPolicyHash,
      versions: {
        [testPolicyHash]: {
          text: testPolicyText,
          version: '1.0.0',
          createdAt: now,
          updatedAt: now,
          publishedAt: now,
          status: 'published'
        }
      },
      createdAt: now,
      updatedAt: now
    });

    // Add cookie policy for testing multiple policies
    const cookiePolicyText = '# Cookie Policy\n\nThis is a test cookie policy.';
    const cookiePolicyHash = crypto.createHash('sha256').update(cookiePolicyText, 'utf8').digest('hex');
    
    await firestore.collection(FirestoreCollections.POLICIES).doc(PolicyIds.COOKIE_POLICY).set({
      id: PolicyIds.COOKIE_POLICY,
      policyName: 'Cookie Policy',
      currentVersionHash: cookiePolicyHash,
      versions: {
        [cookiePolicyHash]: {
          text: cookiePolicyText,
          version: '1.0.0',
          createdAt: now,
          updatedAt: now,
          publishedAt: now,
          status: 'published'
        }
      },
      createdAt: now,
      updatedAt: now
    });
  });

  afterAll(async () => {
    // Clean up test data
    const firestore = admin.firestore();
    await firestore.collection(FirestoreCollections.POLICIES).doc(PolicyIds.TERMS_OF_SERVICE).delete();
    await firestore.collection(FirestoreCollections.POLICIES).doc(PolicyIds.COOKIE_POLICY).delete();
  });

  describe('GET /policies/current', () => {
    it('should return all current policy versions', async () => {
      const response = await fetch(`${API_BASE_URL}/policies/current`);
      
      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data).toHaveProperty('policies');
      expect(data).toHaveProperty('count');
      expect(data.count).toBeGreaterThanOrEqual(2);
      
      // Check that our test policies are included
      expect(data.policies).toHaveProperty(PolicyIds.TERMS_OF_SERVICE);
      expect(data.policies[PolicyIds.TERMS_OF_SERVICE]).toHaveProperty('policyName', 'Terms of Service');
      expect(data.policies[PolicyIds.TERMS_OF_SERVICE]).toHaveProperty('currentVersionHash');
      
      expect(data.policies).toHaveProperty(PolicyIds.COOKIE_POLICY);
      expect(data.policies[PolicyIds.COOKIE_POLICY]).toHaveProperty('policyName', 'Cookie Policy');
    });
  });

  describe('GET /policies/:id/current', () => {
    it('should return the current version of a specific policy', async () => {
      const response = await fetch(`${API_BASE_URL}/policies/${PolicyIds.TERMS_OF_SERVICE}/current`);
      
      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data).toHaveProperty('id', PolicyIds.TERMS_OF_SERVICE);
      expect(data).toHaveProperty('policyName', 'Terms of Service');
      expect(data).toHaveProperty('currentVersionHash');
      expect(data).toHaveProperty('text');
      expect(data).toHaveProperty('createdAt');
      
      // Verify the text contains our test content
      expect(data.text).toContain('Test Policy');
    });

    it('should return 404 for non-existent policy', async () => {
      const response = await fetch(`${API_BASE_URL}/policies/non-existent-policy/current`);
      
      expect(response.status).toBe(404);
      
      const data = await response.json() as any;
      expect(data).toHaveProperty('error');
      expect(data.error).toHaveProperty('code', 'POLICY_NOT_FOUND');
    });

    it('should handle different policy IDs correctly', async () => {
      const response = await fetch(`${API_BASE_URL}/policies/${PolicyIds.COOKIE_POLICY}/current`);
      
      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data).toHaveProperty('id', PolicyIds.COOKIE_POLICY);
      expect(data).toHaveProperty('policyName', 'Cookie Policy');
      expect(data.text).toContain('Cookie Policy');
    });
  });

  describe('Policy document structure validation', () => {
    it('should handle corrupted policy documents gracefully', async () => {
      const firestore = admin.firestore();
      
      // Create a corrupted policy document (missing required fields)
      await firestore.collection(FirestoreCollections.POLICIES).doc('corrupted-policy').set({
        id: 'corrupted-policy',
        policyName: 'Corrupted Policy'
        // Missing currentVersionHash and versions
      });

      const response = await fetch(`${API_BASE_URL}/policies/corrupted-policy/current`);
      
      expect(response.status).toBe(500);
      
      const data = await response.json() as any;
      expect(data).toHaveProperty('error');
      expect(data.error).toHaveProperty('code', 'CORRUPT_POLICY_DATA');
      
      // Clean up
      await firestore.collection(FirestoreCollections.POLICIES).doc('corrupted-policy').delete();
    });

    it('should handle missing version data gracefully', async () => {
      const firestore = admin.firestore();
      
      // Create a policy with invalid version reference
      await firestore.collection(FirestoreCollections.POLICIES).doc('invalid-version').set({
        id: 'invalid-version',
        policyName: 'Invalid Version Policy',
        currentVersionHash: 'non-existent-hash',
        versions: {}
      });

      const response = await fetch(`${API_BASE_URL}/policies/invalid-version/current`);
      
      expect(response.status).toBe(500);
      
      const data = await response.json() as any;
      expect(data).toHaveProperty('error');
      expect(data.error).toHaveProperty('code', 'VERSION_NOT_FOUND');
      
      // Clean up
      await firestore.collection(FirestoreCollections.POLICIES).doc('invalid-version').delete();
    });
  });
});