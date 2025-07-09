import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

interface TestConfig {
  baseUrl: string;
  isProduction: boolean;
}

interface TestUser {
  email: string;
  password: string;
  idToken?: string;
}

class EndpointTester {
  private client: request.SuperTest<request.Test>;
  private config: TestConfig;
  private testUser: TestUser;
  
  constructor(config: TestConfig) {
    this.config = config;
    this.client = request(config.baseUrl);
    
    const uniqueId = uuidv4().substring(0, 8);
    this.testUser = {
      email: `test-${uniqueId}@example.com`,
      password: `TestPass123_${uniqueId}`,
    };
  }
  
  private async createTestUser(): Promise<void> {
    console.log(`\n📝 Creating test user: ${this.testUser.email}`);
    
    const response = await this.client.post('/api/register')
      .send({
        email: this.testUser.email,
        password: this.testUser.password,
      })
      .expect(200);
    
    console.log('✅ Test user created successfully');
  }
  
  private async authenticateUser(): Promise<void> {
    console.log(`\n🔐 Authenticating user: ${this.testUser.email}`);
    
    const response = await this.client.post('/api/login')
      .send({
        email: this.testUser.email,
        password: this.testUser.password,
      })
      .expect(200);
    
    if (!response.body.idToken) {
      throw new Error(`Failed to authenticate user: ${JSON.stringify(response.body)}`);
    }
    
    this.testUser.idToken = response.body.idToken;
    console.log('✅ User authenticated successfully');
  }
  
  private async testCorsHeaders(endpoint: string, method: string = 'GET'): Promise<void> {
    console.log(`\n🌐 Testing CORS for ${method} ${endpoint}`);
    
    const testOrigins = this.config.isProduction 
      ? [`https://${this.config.baseUrl.split('.')[0]}.web.app`]
      : ['http://localhost:3000', 'http://localhost:5000'];
    
    for (const origin of testOrigins) {
      try {
        const response = await this.client.options(endpoint)
          .set('Origin', origin)
          .set('Access-Control-Request-Method', method)
          .set('Access-Control-Request-Headers', 'Content-Type,Authorization')
          .expect(200);
        
        const corsHeaders = {
          'access-control-allow-origin': response.headers['access-control-allow-origin'],
          'access-control-allow-methods': response.headers['access-control-allow-methods'],
          'access-control-allow-headers': response.headers['access-control-allow-headers'],
          'access-control-allow-credentials': response.headers['access-control-allow-credentials'],
        };
        
        console.log(`  Origin: ${origin}`);
        console.log(`  CORS Headers:`, corsHeaders);
        
        if (!corsHeaders['access-control-allow-origin']) {
          console.warn(`  ⚠️  No CORS headers returned for origin: ${origin}`);
        } else {
          console.log(`  ✅ CORS preflight successful`);
        }
      } catch (error) {
        console.error(`  ❌ CORS preflight failed for ${origin}:`, error);
      }
    }
  }
  
  private async testSecurityHeaders(endpoint: string): Promise<void> {
    console.log(`\n🔒 Testing security headers for ${endpoint}`);
    
    const response = await this.client.get(endpoint);
    
    const securityHeaders = {
      'x-content-type-options': response.headers['x-content-type-options'],
      'x-frame-options': response.headers['x-frame-options'],
      'x-xss-protection': response.headers['x-xss-protection'],
      'referrer-policy': response.headers['referrer-policy'],
      'permissions-policy': response.headers['permissions-policy'],
      'strict-transport-security': response.headers['strict-transport-security'],
      'content-security-policy': response.headers['content-security-policy'],
    };
    
    console.log('  Security Headers:', securityHeaders);
    
    const requiredHeaders = ['x-content-type-options', 'x-frame-options', 'x-xss-protection'];
    const missingHeaders = requiredHeaders.filter(h => !securityHeaders[h as keyof typeof securityHeaders]);
    
    if (missingHeaders.length > 0) {
      console.warn(`  ⚠️  Missing security headers: ${missingHeaders.join(', ')}`);
    } else {
      console.log('  ✅ All required security headers present');
    }
    
    if (this.config.isProduction && !securityHeaders['strict-transport-security']) {
      console.warn('  ⚠️  HSTS header missing in production');
    }
  }
  
  private async testPublicEndpoint(endpoint: string, method: string = 'GET'): Promise<void> {
    console.log(`\n🌍 Testing public endpoint: ${method} ${endpoint}`);
    
    await this.testCorsHeaders(endpoint, method);
    await this.testSecurityHeaders(endpoint);
    
    const response = await this.client.get(endpoint).expect(200);
    
    console.log(`  Response Status: ${response.status}`);
    console.log(`  Response Data:`, JSON.stringify(response.body).substring(0, 200));
    
    if (response.status >= 200 && response.status < 300) {
      console.log('  ✅ Public endpoint accessible');
    } else {
      console.warn(`  ⚠️  Unexpected status code: ${response.status}`);
    }
  }
  
  private async testSecureEndpoint(endpoint: string, method: string = 'GET', data?: any): Promise<void> {
    console.log(`\n🔐 Testing secure endpoint: ${method} ${endpoint}`);
    
    if (!this.testUser.idToken) {
      console.error('  ❌ No authentication token available');
      return;
    }
    
    await this.testCorsHeaders(endpoint, method);
    
    // Test without auth
    console.log('  Testing without authentication...');
    await this.client.post(endpoint).send(data).expect(401);
    console.log('  ✅ Correctly rejected unauthenticated request');
    
    // Test with auth
    console.log('  Testing with authentication...');
    const authResponse = await this.client.post(endpoint)
      .set('Authorization', `Bearer ${this.testUser.idToken}`)
      .send(data)
      .expect(200);
    
    console.log(`  Response Status: ${authResponse.status}`);
    console.log(`  Response Data:`, JSON.stringify(authResponse.body).substring(0, 200));
    
    if (authResponse.status >= 200 && authResponse.status < 300) {
      console.log('  ✅ Secure endpoint accessible with auth');
    } else {
      console.warn(`  ⚠️  Unexpected status code: ${authResponse.status}`);
    }
  }
  
  async runTests(): Promise<void> {
    console.log('='.repeat(50));
    console.log(`🧪 API Endpoint Tests`);
    console.log(`📍 Base URL: ${this.config.baseUrl}`);
    console.log(`🌍 Environment: ${this.config.isProduction ? 'Production' : 'Development'}`);
    console.log('='.repeat(50));
    
    try {
      // Test public endpoints
      await this.testPublicEndpoint('/api/health');
      await this.testPublicEndpoint('/api/status');
      await this.testPublicEndpoint('/api/config');
      
      // Create and authenticate test user
      await this.createTestUser();
      await this.authenticateUser();
      
      // Test secure endpoints
      await this.testSecureEndpoint('/api/createUserDocument', 'POST', {
        displayName: 'Test User',
      });
      
      const testDocId = uuidv4();
      await this.testSecureEndpoint('/api/createDocument', 'POST', {
        collection: 'test-collection',
        documentId: testDocId,
        data: { test: true, timestamp: new Date().toISOString() },
      });
      
      await this.testSecureEndpoint('/api/getDocument', 'GET');
      await this.testSecureEndpoint('/api/listDocuments', 'GET');
      
      console.log('\n' + '='.repeat(50));
      console.log('✅ All tests completed');
      console.log('='.repeat(50));
      
    } catch (error) {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const environment = args[0] || 'local';
  
  let config: TestConfig;
  
  switch (environment) {
    case 'local':
      config = {
        baseUrl: 'http://localhost:5001/splitifyd/us-central1',
        isProduction: false,
      };
      break;
    case 'production':
      config = {
        baseUrl: 'https://api-xxxxxxxxxxx.cloudfunctions.net',
        isProduction: true,
      };
      console.log('⚠️  Note: Update the production URL with your actual Cloud Functions URL');
      break;
    default:
      console.error('Usage: npm run test:endpoints [local|production]');
      process.exit(1);
  }
  
  const tester = new EndpointTester(config);
  await tester.runTests();
}

// Run tests
main().catch(console.error);