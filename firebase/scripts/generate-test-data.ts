#!/usr/bin/env tsx

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateBillSplitterUser, generateFullTestData } from './test-data-generator';

async function main(): Promise<void> {
    await generateFullTestData();
}

const isDirectExecution = (() => {
    const invokedScript = process.argv[1];
    if (!invokedScript) return false;
    const resolvedInvokedScript = resolve(invokedScript);
    const currentModulePath = fileURLToPath(import.meta.url);
    return resolvedInvokedScript === currentModulePath;
})();

if (isDirectExecution) {
    main().catch((error) => {
        console.error('❌ Failed to generate full test data', error);
        process.exit(1);
    });
}

export { generateBillSplitterUser, generateFullTestData };
