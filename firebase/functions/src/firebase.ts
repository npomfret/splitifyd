import * as admin from 'firebase-admin';

console.log(`--------- app FIRESTORE_EMULATOR_HOST=${process.env.FIRESTORE_EMULATOR_HOST} ---------`);
console.log(`--------- app FIREBASE_AUTH_EMULATOR_HOST=${process.env.FIREBASE_AUTH_EMULATOR_HOST} ---------`);

if (!admin.apps || admin.apps.length === 0) {
    // If FIRESTORE_EMULATOR_HOST is set, we're connecting to the emulator
    // Otherwise, we're using default credentials (for production or testing)
    admin.initializeApp({projectId: 'splitifyd'});
}

const db = admin.firestore();

export {
    db,
    admin
};
