"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupTestApp = setupTestApp;
exports.cleanupTestData = cleanupTestData;
const admin = __importStar(require("firebase-admin"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("../src/config/config");
const middleware_1 = require("../src/auth/middleware");
const constants_1 = require("../src/constants");
const handlers_1 = require("../src/documents/handlers");
// Test configuration
const testConfig = {
    cors: {
        origin: [`http://localhost:${constants_1.PORTS.LOCAL_3000}`, `http://localhost:${constants_1.PORTS.LOCAL_5000}`],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        optionsSuccessStatus: constants_1.HTTP_STATUS.OK,
    },
};
let isInitialized = false;
async function setupTestApp() {
    if (!isInitialized) {
        // Initialize Firebase Admin for testing
        if (admin.apps.length === 0) {
            admin.initializeApp({
                projectId: 'test-project',
                credential: admin.credential.applicationDefault(),
            });
        }
        // Set emulator environment variables
        process.env.FIRESTORE_EMULATOR_HOST = `localhost:${constants_1.PORTS.FIRESTORE_EMULATOR}`;
        process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${constants_1.PORTS.AUTH_EMULATOR}`;
        process.env.NODE_ENV = 'test';
        isInitialized = true;
    }
    const app = (0, express_1.default)();
    // Apply middleware in the same order as production
    app.use((0, cors_1.default)(testConfig.cors));
    app.use(express_1.default.json({ limit: config_1.CONFIG.request.bodyLimit }));
    // Enhanced health check endpoint
    app.get('/health', async (req, res) => {
        const startTime = Date.now();
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            environment: 'test',
            checks: {
                firestore: { status: 'unknown' },
                auth: { status: 'unknown' },
            },
        };
        try {
            // Test Firestore connection
            const firestoreStart = Date.now();
            const testRef = admin.firestore().collection('_health_check').doc('test');
            await testRef.set({ timestamp: new Date() }, { merge: true });
            await testRef.get();
            health.checks.firestore = {
                status: 'healthy',
                responseTime: Date.now() - firestoreStart,
            };
        }
        catch (error) {
            health.status = 'unhealthy';
            health.checks.firestore = {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
        try {
            // Test Firebase Auth
            const authStart = Date.now();
            await admin.auth().listUsers(constants_1.SYSTEM.AUTH_LIST_LIMIT);
            health.checks.auth = {
                status: 'healthy',
                responseTime: Date.now() - authStart,
            };
        }
        catch (error) {
            health.status = 'unhealthy';
            health.checks.auth = {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
        health.totalResponseTime = Date.now() - startTime;
        const statusCode = health.status === 'healthy' ? constants_1.HTTP_STATUS.OK : constants_1.HTTP_STATUS.SERVICE_UNAVAILABLE;
        res.status(statusCode).json(health);
    });
    // Status endpoint
    app.get('/status', (req, res) => {
        const memUsage = process.memoryUsage();
        res.json({
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                rss: `${Math.round(memUsage.rss / constants_1.SYSTEM.BYTES_PER_KB / constants_1.SYSTEM.BYTES_PER_KB)} MB`,
                heapUsed: `${Math.round(memUsage.heapUsed / constants_1.SYSTEM.BYTES_PER_KB / constants_1.SYSTEM.BYTES_PER_KB)} MB`,
                heapTotal: `${Math.round(memUsage.heapTotal / constants_1.SYSTEM.BYTES_PER_KB / constants_1.SYSTEM.BYTES_PER_KB)} MB`,
                external: `${Math.round(memUsage.external / constants_1.SYSTEM.BYTES_PER_KB / constants_1.SYSTEM.BYTES_PER_KB)} MB`,
            },
            version: '1.0.0',
            nodeVersion: process.version,
            environment: 'test',
        });
    });
    // Document endpoints
    app.post('/createDocument', middleware_1.authenticate, handlers_1.createDocument);
    app.get('/getDocument', middleware_1.authenticate, handlers_1.getDocument);
    app.put('/updateDocument', middleware_1.authenticate, handlers_1.updateDocument);
    app.delete('/deleteDocument', middleware_1.authenticate, handlers_1.deleteDocument);
    app.get('/listDocuments', middleware_1.authenticate, handlers_1.listDocuments);
    // 404 handler
    app.use((req, res) => {
        res.status(constants_1.HTTP_STATUS.NOT_FOUND).json({
            error: {
                code: 'NOT_FOUND',
                message: 'Endpoint not found',
                correlationId: req.headers['x-correlation-id'],
            },
        });
    });
    // Error handler
    app.use((err, req, res, next) => {
        console.error('Test app error:', err);
        res.status(constants_1.HTTP_STATUS.INTERNAL_ERROR).json({
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
                correlationId: req.headers['x-correlation-id'],
            },
        });
    });
    return app;
}
// Cleanup function for tests
async function cleanupTestData() {
    try {
        // Clean up test documents
        const firestore = admin.firestore();
        const documentsRef = firestore.collection('documents');
        const snapshot = await documentsRef.get();
        const batch = firestore.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        // Clean up rate limit documents
        const rateLimitsRef = firestore.collection('rate_limits');
        const rateLimitSnapshot = await rateLimitsRef.get();
        const rateLimitBatch = firestore.batch();
        rateLimitSnapshot.docs.forEach(doc => {
            rateLimitBatch.delete(doc.ref);
        });
        await rateLimitBatch.commit();
    }
    catch (error) {
        console.warn('Cleanup warning:', error);
    }
}
// Setup for Jest
beforeAll(async () => {
    // Ensure emulators are running
    const isEmulatorRunning = process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST;
    if (!isEmulatorRunning) {
        console.warn('Warning: Firebase emulators may not be running. Tests might fail.');
        console.warn('Run: firebase emulators:start --only auth,firestore');
    }
}, constants_1.TEST_CONFIG.SETUP_TIMEOUT_MS);
afterAll(async () => {
    await cleanupTestData();
});
// Global test timeout
jest.setTimeout(constants_1.TEST_CONFIG.JEST_TIMEOUT_MS);
//# sourceMappingURL=test-setup.js.map