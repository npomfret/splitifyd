import { createFirestoreDatabase } from '../functions/src/firestore-wrapper';

let firestoreDb: ReturnType<typeof createFirestoreDatabase>;

function getFirestoreDb() {
    if (!firestoreDb) {
        const { getFirestore } = require('../functions/src/firebase');
        firestoreDb = createFirestoreDatabase(getFirestore());
    }
    return firestoreDb;
}

async function checkTenants() {
    const db = getFirestoreDb();
    const snapshot = await db.collection('tenants').get();

    console.log('Total tenants:', snapshot.size);

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`\nTenant: ${doc.id}`);
        console.log('  Domains:', data.domains);
        console.log('  Primary:', data.primaryDomain);
        console.log('  App Name:', data.branding?.appName);
        console.log('  Primary Color:', data.branding?.primaryColor);
        console.log('  Header BG:', data.branding?.headerBackgroundColor);
    });
}

checkTenants().catch(console.error);
