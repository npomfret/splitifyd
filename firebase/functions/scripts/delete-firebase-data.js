const admin = require('firebase-admin');
const { loadAppConfig } = require('./load-app-config');

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
  
  console.log(`Starting deletion of collection: ${collectionName}`);
  
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
    
    console.log(`Deleted ${snapshot.size} documents from ${collectionName} (total: ${totalDeleted})`);
    
    if (snapshot.size < batchSize) {
      hasMore = false;
    }
  }
  
  console.log(`✅ Completed deletion of ${collectionName}: ${totalDeleted} documents deleted`);
  return totalDeleted;
}

async function deleteAllTestData() {
  console.log('🗑️  Starting deletion of test data from DEPLOYED Firebase...');
  console.log('⚠️  This will delete all data except users collection');
  console.log(`🌐 Connected to project: ${appConfig.firebaseProjectId} (deployed instance)`);
  console.log('Collections to delete:', COLLECTIONS_TO_DELETE);
  
  try {
    let grandTotal = 0;
    
    for (const collectionName of COLLECTIONS_TO_DELETE) {
      const deleted = await deleteCollection(collectionName);
      grandTotal += deleted;
    }
    
    console.log(`\n✅ Successfully deleted ${grandTotal} documents across ${COLLECTIONS_TO_DELETE.length} collections`);
    console.log('👥 Users collection preserved');
    
  } catch (error) {
    console.error('❌ Error during deletion:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  deleteAllTestData()
    .then(() => {
      console.log('🎉 Data deletion completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Data deletion failed:', error);
      process.exit(1);
    });
}

module.exports = { deleteAllTestData, deleteCollection };