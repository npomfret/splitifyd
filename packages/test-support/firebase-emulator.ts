import {getFirebaseEmulatorConfig} from '@splitifyd/test-support';

const config = getFirebaseEmulatorConfig();

export const FIRESTORE_URL = `http://localhost:${config.firestorePort}`;
export const FIREBASE_AUTH_URL = `http://localhost:${config.authPort}`;
export const API_BASE_URL = config.baseUrl;
export const FIREBASE_API_KEY = config.firebaseApiKey;
