import * as admin from 'firebase-admin';
import assert from "node:assert";
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

if (!admin.apps || admin.apps.length === 0) {

    // see https://firebase.google.com/docs/emulator-suite/connect_firestore#web
    assert(process.env.GCLOUD_PROJECT, "GCLOUD_PROJECT env var must be set");
    const app = admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT
    });

    if (process.env.NODE_ENV !== 'production') {
        const firebaseJsonPath = join(__dirname, '../../firebase.json');
        let firebaseConfig;
        
        try {
            const firebaseJsonContent = readFileSync(firebaseJsonPath, 'utf8');
            firebaseConfig = JSON.parse(firebaseJsonContent);
        } catch (error) {
            throw new Error(`Failed to read firebase.json at ${firebaseJsonPath}: ${error}`);
        }
        
        assert(firebaseConfig.emulators?.firestore?.port, "firestore port must be defined in firebase.json emulators configuration");
        const firestorePort = firebaseConfig.emulators.firestore.port;
        assert(typeof firestorePort === 'number', "firestore port in firebase.json must be a number");

        console.log(`connecting to local firestore emulator on port ${firestorePort}`);
        const firestore = app.firestore();
        firestore.settings({
            host: `localhost:${firestorePort}`,
            ssl: false,
        });
    }
}

const db = admin.firestore();

export {
    db,
    admin
};
