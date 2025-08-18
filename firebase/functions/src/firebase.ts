import * as admin from 'firebase-admin';


if (!admin.apps || admin.apps.length === 0) {
    if(process.env.FIRESTORE_EMULATOR_HOST) {
        console.log(`--------- emulator detected ---------`);
        console.log(`--------- app FIRESTORE_EMULATOR_HOST=${process.env.FIRESTORE_EMULATOR_HOST} ---------`);
        console.log(`--------- app FIREBASE_AUTH_EMULATOR_HOST=${process.env.FIREBASE_AUTH_EMULATOR_HOST} ---------`);
    }

    // If FIRESTORE_EMULATOR_HOST is set, we're connecting to the emulator
    // Otherwise, we're using default credentials (for production or testing)
    admin.initializeApp({projectId: 'splitifyd'});
}

const db = admin.firestore();

export {
    db,
    admin
};
