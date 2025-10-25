import * as fs from 'fs';
import * as path from 'path';
import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { getConfig } from '../client-config';
import { SYSTEM, HTTP_STATUS } from '../constants';
import { getAuth } from '../firebase';
import { BUILD_INFO } from '../utils/build-info';
import { timestampToISO } from '../utils/dateHelpers';
import { APP_VERSION } from '../utils/version';

export type HealthCheckMap = Record<
    string,
    {
        status: 'healthy' | 'unhealthy';
        responseTime?: number;
        error?: string;
    }
>;

const formatBytes = (bytes: number): string => {
    if (bytes === 0) {
        return '0 B';
    }

    const k = SYSTEM.BYTES_PER_KB;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, index)).toFixed(2))} ${sizes[index]}`;
};

const describeWorkspace = () => {
    const currentDirectory = process.cwd();

    try {
        const entries = fs.readdirSync(currentDirectory);
        const files = entries
            .map((name) => {
                try {
                    const fullPath = path.join(currentDirectory, name);
                    const stats = fs.statSync(fullPath);

                    return {
                        name,
                        type: stats.isDirectory() ? 'dir' : 'file',
                        size: stats.isDirectory() ? null : formatBytes(stats.size),
                        modified: stats.mtime.toISOString(),
                        mode: stats.mode.toString(8),
                        isSymbolicLink: stats.isSymbolicLink(),
                    };
                } catch (error) {
                    return {
                        name,
                        error: error instanceof Error ? error.message : 'Unable to stat entry',
                    };
                }
            })
            .sort((a, b) => {
                if (a.type === 'dir' && b.type !== 'dir') return -1;
                if (a.type !== 'dir' && b.type === 'dir') return 1;
                return a.name.localeCompare(b.name);
            });

        return {
            currentDirectory,
            files,
        };
    } catch (error) {
        return {
            currentDirectory,
            files: [
                {
                    error: error instanceof Error ? error.message : 'Unable to read directory',
                },
            ],
        };
    }
};

export const buildEnvPayload = () => {
    const uptimeSeconds = process.uptime();
    const memUsage = process.memoryUsage();

    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    let uptimeText = '';
    if (days > 0) uptimeText += `${days}d `;
    if (hours > 0) uptimeText += `${hours}h `;
    if (minutes > 0) uptimeText += `${minutes}m `;
    uptimeText += `${seconds}s`;

    return {
        env: process.env,
        build: {
            timestamp: BUILD_INFO.timestamp,
            date: BUILD_INFO.date,
            version: APP_VERSION,
        },
        runtime: {
            startTime: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
            uptime: uptimeSeconds,
            uptimeHuman: uptimeText.trim(),
        },
        memory: {
            rss: formatBytes(memUsage.rss),
            heapTotal: formatBytes(memUsage.heapTotal),
            heapUsed: formatBytes(memUsage.heapUsed),
            external: formatBytes(memUsage.external),
            arrayBuffers: formatBytes(memUsage.arrayBuffers),
            heapAvailable: formatBytes(memUsage.heapTotal - memUsage.heapUsed),
        },
        filesystem: describeWorkspace(),
    };
};

export const buildStatusPayload = () => {
    const memUsage = process.memoryUsage();

    return {
        timestamp: timestampToISO(new Date()),
        uptime: process.uptime(),
        memory: {
            rss: `${Math.round(memUsage.rss / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
            external: `${Math.round(memUsage.external / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
        },
        version: APP_VERSION,
        nodeVersion: process.version,
        environment: getConfig().instanceMode,
    };
};

export const runHealthChecks = async (): Promise<HealthCheckMap> => {
    const checks: HealthCheckMap = {};

    const appBuilder = getAppBuilder();
    const firestoreWriter = appBuilder.buildFirestoreWriter();

    const firestoreHealthCheck = await firestoreWriter.performHealthCheck();
    checks.firestore = {
        status: firestoreHealthCheck.success ? 'healthy' : 'unhealthy',
        responseTime: firestoreHealthCheck.responseTime,
    };

    const authStart = Date.now();
    try {
        const auth = getAuth();

        if (auth) {
            checks.auth = {
                status: 'healthy',
                responseTime: Date.now() - authStart,
            };
        } else {
            checks.auth = {
                status: 'unhealthy',
                responseTime: Date.now() - authStart,
                error: 'Auth service not available',
            };
        }
    } catch (error) {
        checks.auth = {
            status: 'unhealthy',
            responseTime: Date.now() - authStart,
            error: error instanceof Error ? error.message : 'Unknown auth error',
        };
    }

    return checks;
};

export const calculateOverallHealth = (checks: HealthCheckMap): 'healthy' | 'unhealthy' => {
    return Object.values(checks).every((check) => check.status === 'healthy') ? 'healthy' : 'unhealthy';
};

export const buildHealthPayload = (checks: HealthCheckMap) => ({
    status: calculateOverallHealth(checks),
    timestamp: timestampToISO(new Date()),
    checks,
});

export const resolveHealthStatusCode = (checks: HealthCheckMap) =>
    calculateOverallHealth(checks) === 'healthy' ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;
