import * as admin from 'firebase-admin';
import { findProjectRoot, getFirebaseEmulatorConfig } from '@splitifyd/test-support';//todo: is this ok??

const projectRoot = findProjectRoot(__dirname);
const config = getFirebaseEmulatorConfig(projectRoot);
const API_BASE_URL = config.baseUrl;

const FIRESTORE_EMULATOR_HOST = `localhost:${config.firestorePort}`;
const FIREBASE_AUTH_EMULATOR_HOST = `localhost:${config.authPort}`;
const FIREBASE_API_KEY = config.firebaseApiKey;

// we have to set these until we find a way to pass them in (it's just for the emulator)
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR_HOST
process.env.FIREBASE_AUTH_EMULATOR_HOST = FIREBASE_AUTH_EMULATOR_HOST

// console.log(`FIRESTORE_EMULATOR_HOST=${FIRESTORE_EMULATOR_HOST}`);
// console.log(`FIREBASE_AUTH_EMULATOR_HOST=${FIREBASE_AUTH_EMULATOR_HOST}`);

const FIRESTORE_URL = `http://${FIRESTORE_EMULATOR_HOST}`;
const FIREBASE_AUTH_URL = `http://${FIREBASE_AUTH_EMULATOR_HOST}`;

if (!admin.apps || admin.apps.length === 0) {
    // If FIRESTORE_EMULATOR_HOST is set, we're connecting to the emulator
    // Otherwise, we're using default credentials (for production or testing)
    admin.initializeApp({projectId: 'splitifyd'});
}

const db = admin.firestore();

export {
    admin,
    db,
    FIREBASE_API_KEY,
    API_BASE_URL,
    FIRESTORE_URL,
    FIREBASE_AUTH_URL
};
