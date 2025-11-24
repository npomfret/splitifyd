import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = path.join(__dirname, '../../../../../..');
const INSTANCES_FILE = path.join(PROJECT_ROOT, 'firebase/instances.json');

type PortKey = 'ui' | 'auth' | 'functions' | 'firestore' | 'hosting' | 'storage';
const REQUIRED_PORT_KEYS: PortKey[] = ['ui', 'auth', 'functions', 'firestore', 'hosting', 'storage'];

describe('instances.json', () => {
    const fileContents = readFileSync(INSTANCES_FILE, 'utf8');
    const config = JSON.parse(fileContents) as Record<
        string,
        {
            instanceName: string;
            ports: Record<PortKey, number>;
        }
    >;

    it('includes all expected instance entries', () => {
        expect(config).toHaveProperty('dev1');
        expect(config).toHaveProperty('dev2');
        expect(config).toHaveProperty('dev3');
        expect(config).toHaveProperty('dev4');
        expect(config).toHaveProperty('prod');
    });

    it('defines ports for every emulator service per instance', () => {
        Object.entries(config).forEach(([instance, entry]) => {
            expect(entry).toHaveProperty('instanceName');
            expect(typeof entry.instanceName).toBe('string');

            REQUIRED_PORT_KEYS.forEach((key) => {
                const value = entry.ports[key];
                expect(typeof value).toBe('number');
                expect(Number.isInteger(value)).toBe(true);
                if (instance === 'prod') {
                    expect(value).toBeLessThanOrEqual(0);
                } else {
                    expect(value).toBeGreaterThan(0);
                }
            }, instance);
        });
    });

    it('uses unique port numbers across dev instances', () => {
        const seen = new Map<number, string>();

        Object
            .entries(config)
            .filter(([name]) => name.startsWith('dev'))
            .forEach(([name, entry]) => {
                REQUIRED_PORT_KEYS.forEach((key) => {
                    const port = entry.ports[key];
                    const duplicate = seen.get(port);
                    if (duplicate && duplicate !== name) {
                        throw new Error(`Port ${port} is shared by ${duplicate} and ${name}`);
                    }
                    seen.set(port, name);
                });
            });

        expect(seen.size).toBeGreaterThan(0);
    });
});
