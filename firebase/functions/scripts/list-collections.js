const admin = require('firebase-admin');
const { loadAppConfig } = require('./load-app-config');

// Set emulator environment variables
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

// Load app configuration
const appConfig = loadAppConfig();

// Initialize Firebase Admin for emulator
const app = admin.initializeApp({
  projectId: appConfig.firebaseProjectId
});

const db = admin.firestore();

async function listAllCollections() {
  try {
    console.log('📋 Listing all collections in Firebase emulator...');
    
    const collections = await db.listCollections();
    
    console.log(`\n📊 Found ${collections.length} collections:`);
    collections.forEach((collection, index) => {
      console.log(`${index + 1}. ${collection.id}`);
    });
    
    console.log('\n🔍 Comparing with delete script...');
    
    const COLLECTIONS_TO_DELETE = [
      'documents',
      'expenses', 
      '_health_check',
      'rate_limits'
    ];
    
    const actualCollections = collections.map(c => c.id);
    const missing = actualCollections.filter(name => 
      name !== 'users' && !COLLECTIONS_TO_DELETE.includes(name)
    );
    
    if (missing.length > 0) {
      console.log('⚠️  Collections NOT in delete script:');
      missing.forEach(name => console.log(`  - ${name}`));
    } else {
      console.log('✅ All collections (except users) are covered by delete script');
    }
    
    const notFound = COLLECTIONS_TO_DELETE.filter(name => 
      !actualCollections.includes(name)
    );
    
    if (notFound.length > 0) {
      console.log('📝 Collections in delete script but not found:');
      notFound.forEach(name => console.log(`  - ${name}`));
    }
    
    return { actualCollections, missing, notFound };
    
  } catch (error) {
    console.error('❌ Error listing collections:', error);
    throw error;
  }
}

if (require.main === module) {
  listAllCollections()
    .then(() => {
      console.log('\n✅ Collection listing completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Collection listing failed:', error);
      process.exit(1);
    });
}

module.exports = { listAllCollections };