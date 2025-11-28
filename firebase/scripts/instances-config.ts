import { existsSync, readFileSync } from 'fs';
import path from 'path';

export interface InstancePorts {
    ui: number;
    auth: number;
    functions: number;
    firestore: number;
    hosting: number;
    storage: number;
    tasks: number;
}

export interface InstanceConfig {
    instanceName: string;
    ports: InstancePorts;
}

type InstancesMap = Record<string, InstanceConfig>;

const FIREBASE_DIR = path.join(__dirname, '..');
const INSTANCES_FILE = path.join(FIREBASE_DIR, 'instances.json');

let cachedInstances: InstancesMap | null = null;

function loadInstancesFile(): InstancesMap {
    if (cachedInstances) {
        return cachedInstances;
    }

    if (!existsSync(INSTANCES_FILE)) {
        throw new Error('instances.json not found. Ensure firebase/instances.json exists and is committed.');
    }

    const raw = readFileSync(INSTANCES_FILE, 'utf8');
    const config = JSON.parse(raw) as InstancesMap;
    cachedInstances = config;
    return config;
}

export function getInstancesConfig(): InstancesMap {
    return loadInstancesFile();
}

export function requireInstanceConfig(instanceKey: string): InstanceConfig {
    const instances = loadInstancesFile();
    const entry = instances[instanceKey];
    if (!entry) {
        throw new Error(`Instance "${instanceKey}" is not defined in firebase/instances.json`);
    }
    return entry;
}

export function resolvePortsForMode(instanceName: string): InstancePorts {
    const instances = loadInstancesFile();
    const entry = Object.values(instances).find((candidate) => candidate.instanceName === instanceName);
    if (!entry) {
        throw new Error(`No port configuration found for INSTANCE_NAME="${instanceName}"`);
    }
    return entry.ports;
}
