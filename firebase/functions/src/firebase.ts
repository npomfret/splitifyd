import * as admin from 'firebase-admin';
import assert from "node:assert";
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

export function isEmulator() {
    return process.env.NODE_ENV === "development" && process.env.FUNCTIONS_EMULATOR === "true";
}

export function isProduction() {
    return process.env.NODE_ENV === "production";
}

export function isTest() {
    return process.env.NODE_ENV !== "production" && process.env.FUNCTIONS_EMULATOR !== "true";
}

if (!process.env.GCLOUD_PROJECT) {
    if(isTest()) {
        throw Error("env.GCLOUD_PROJECT should be set in vitest.config.ts in any test environment - and make sure you are running from the correct directory!")
    } else {
        throw Error("env.GCLOUD_PROJECT should be set in vitest.config.ts in any test environment, or by firebase elsewhere")
    }
}

function _loadFirebaseConfig() {
    const firebaseJsonPath = join(__dirname, '../../firebase.json');

    try {
        const firebaseJsonContent = readFileSync(firebaseJsonPath, 'utf8');
        return JSON.parse(firebaseJsonContent);
    } catch (error) {
        throw new Error(`Failed to read firebase.json at ${firebaseJsonPath}: ${error}`);
    }
}

if (!admin.apps || admin.apps.length === 0) {
    // see https://firebase.google.com/docs/emulator-suite/connect_firestore#web
    const app = admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT!
    });

    if (!isProduction()) {
        // when running in a deployed firebase environment, NODE_ENV is production
        // otherwise we assume that we need to connect to the emulator (like in tests)
        //
        // when a function is running in the emulator it will see:
        //   "NODE_ENV": "development"
        //   "FUNCTIONS_EMULATOR": "true"
        // and no extra setup is needed
        //
        // however in a unit-test type environment, we need to configure the firebase API to connect to the emulator

        if (isEmulator()) {// we are in the emulator - do nothing
            // sanity checks

            // these are all set by firebase
            assert(process.env.FIREBASE_AUTH_EMULATOR_HOST);
            assert(process.env.FIRESTORE_EMULATOR_HOST);
            assert(process.env.FIREBASE_CONFIG);
        } else {
            assert(isTest(), "do not set env.FUNCTIONS_EMULATOR artificially!");

            const firebaseConfig = _loadFirebaseConfig();

            assert(firebaseConfig.emulators?.firestore?.port, "firestore port must be defined in firebase.json emulators configuration");
            const firestorePort = firebaseConfig.emulators.firestore.port;
            assert(typeof firestorePort === 'number', "firestore port in firebase.json must be a number");

            // console.log(`connecting to local firestore emulator on port ${firestorePort}`);
            const firestore = app.firestore();
            firestore.settings({
                host: `localhost:${firestorePort}`,
                ssl: false,
            });

            assert(firebaseConfig.emulators?.auth?.port, "firebase auth port must be defined in firebase.json emulators configuration");
            const authPort = firebaseConfig.emulators.auth.port;
            assert(typeof authPort === 'number', "firebase auth port in firebase.json must be a number");

            // Connect to Auth Emulator
            assert(authPort, "Auth emulator port not found in config.");
            process.env['FIREBASE_AUTH_EMULATOR_HOST'] = `localhost:${authPort}`;
        }
    }
}

const firestoreDb = admin.firestore();
const firebaseAuth = admin.auth();

const FieldPath = admin.firestore.FieldPath;

export {
    firestoreDb,
    firebaseAuth,
    admin,
    FieldPath
};