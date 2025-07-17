const admin = require('firebase-admin');
const { loadAppConfig } = require('./load-app-config');
const { logger } = require('../lib/logger');

// Load app configuration
const appConfig = loadAppConfig();

// Load service account key dynamically based on project ID
const serviceAccount = require(`../${appConfig.firebaseProjectId}-service-account-key.json`);

// Initialize Firebase Admin for deployed instance
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: appConfig.firebaseProjectId
});

// Connect to deployed Firebase
const db = admin.firestore();

const COLLECTIONS_TO_DELETE = [
  'documents',
  'expenses', 
  '_health_check',
  'rate_limits',
  'group-balances'
];

async function deleteCollection(collectionName) {
  const collectionRef = db.collection(collectionName);
  const batchSize = 100;
  
  
  let totalDeleted = 0;
  let hasMore = true;
  
  while (hasMore) {
    const snapshot = await collectionRef.limit(batchSize).get();
    
    if (snapshot.empty) {
      hasMore = false;
      break;
    }
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    totalDeleted += snapshot.size;
    
    
    if (snapshot.size < batchSize) {
      hasMore = false;
    }
  }
  
  logger.info(`✅ Deleted ${totalDeleted} documents from ${collectionName}`);
  return totalDeleted;
}

async function deleteAllTestData() {
  logger.warn('🗑️  Starting deletion of test data from DEPLOYED Firebase', {
    project: appConfig.firebaseProjectId,
    collections: COLLECTIONS_TO_DELETE,
    note: 'This will delete all data except users collection'
  });
  
  try {
    let grandTotal = 0;
    
    for (const collectionName of COLLECTIONS_TO_DELETE) {
      const deleted = await deleteCollection(collectionName);
      grandTotal += deleted;
    }
    
    logger.info(`✅ Successfully deleted ${grandTotal} documents across ${COLLECTIONS_TO_DELETE.length} collections`, {
      usersPreserved: true
    });
    
  } catch (error) {
    logger.error('❌ Error during deletion', { error });
    process.exit(1);
  }
}

if (require.main === module) {
  deleteAllTestData()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      logger.error('💥 Data deletion failed', { error });
      process.exit(1);
    });
}

module.exports = { deleteAllTestData, deleteCollection };