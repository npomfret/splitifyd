const admin = require('firebase-admin');
const readline = require('readline');
const path = require('path');
const fs = require('fs');
const { logger } = require('../lib/logger');

// Load service account key
const serviceAccountPath = path.resolve(__dirname, '../../service-account-key.json');

if (!fs.existsSync(serviceAccountPath)) {
    logger.error('❌ Service account key not found', { path: serviceAccountPath });
    process.exit(1);
}

logger.info('🔑 Using service account key', { path: serviceAccountPath });
const serviceAccount = require(serviceAccountPath);

// Initialize Firebase Admin for deployed instance
const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
});

// Connect to deployed Firebase
const db = admin.firestore();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

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
        snapshot.docs.forEach((doc) => {
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

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

async function getAllCollections() {
    const collections = await db.listCollections();
    return collections.map(col => col.id);
}

async function getCollectionCount(collectionName) {
    const snapshot = await db.collection(collectionName).count().get();
    return snapshot.data().count;
}

async function deleteAllData() {
    try {
        logger.info('📋 Scanning Firebase collections...');
        
        const allCollections = await getAllCollections();
        
        if (allCollections.length === 0) {
            logger.info('✅ No collections found - database is already empty');
            rl.close();
            return;
        }

        logger.info('📊 Found collections:');
        const collectionCounts = {};
        
        for (const collectionName of allCollections) {
            try {
                const count = await getCollectionCount(collectionName);
                collectionCounts[collectionName] = count;
                logger.info(`  - ${collectionName}: ${count} documents`);
            } catch (error) {
                logger.info(`  - ${collectionName}: Unable to count documents (${error.message})`);
                collectionCounts[collectionName] = '?';
            }
        }

        const totalDocs = Object.values(collectionCounts).reduce((sum, count) => {
            return sum + (typeof count === 'number' ? count : 0);
        }, 0);
        
        console.log(`\n⚠️  This will delete ALL documents across ${allCollections.length} collections from Firebase project: ${serviceAccount.project_id}`);
        console.log('⚠️  THIS ACTION CANNOT BE UNDONE!');
        
        const confirm1 = await askQuestion('\nDo you want to proceed? (type "yes" to continue): ');
        
        if (confirm1.toLowerCase() !== 'yes') {
            logger.info('❌ Deletion cancelled');
            rl.close();
            return;
        }

        const confirm2 = await askQuestion('Are you absolutely sure? (type "DELETE ALL DATA" to confirm): ');
        
        if (confirm2 !== 'DELETE ALL DATA') {
            logger.info('❌ Deletion cancelled');
            rl.close();
            return;
        }

        logger.info('🗑️  Starting deletion...');

        let grandTotal = 0;

        for (const collectionName of allCollections) {
            try {
                const deleted = await deleteCollection(collectionName);
                grandTotal += deleted;
            } catch (error) {
                logger.error(`❌ Failed to delete collection ${collectionName}`, { error });
            }
        }

        logger.info(`✅ Successfully deleted ${grandTotal} documents across ${allCollections.length} collections`);
        rl.close();
        
    } catch (error) {
        logger.error('❌ Error during deletion process', { error });
        rl.close();
        process.exit(1);
    }
}

if (require.main === module) {
    deleteAllData()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            logger.error('💥 Data deletion failed', { error });
            process.exit(1);
        });
}
