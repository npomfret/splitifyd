#!/usr/bin/env npx tsx

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';
import { logger } from '../lib/logger';

interface DeployedFunction {
    name: string;
    sourceUploadUrl: string;
    status: string;
    updateTime: string;
    versionId: string;
}

async function getProjectId(): Promise<string> {
    const serviceAccountPath = join(__dirname, '../../service-account-key.json');
    try {
        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
        return serviceAccount.project_id;
    } catch (error) {
        logger.error('❌ Failed to read service account key', {
            path: serviceAccountPath,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        process.exit(1);
    }
}

async function authenticateWithFirebase(): Promise<void> {
    const serviceAccountPath = join(__dirname, '../../service-account-key.json');
    try {
        logger.info('🔐 Setting Firebase service account...');
        process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;
        logger.info('✅ Authentication configured');
    } catch (error) {
        logger.error('❌ Failed to set Firebase authentication', {
            path: serviceAccountPath,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        process.exit(1);
    }
}

async function listDeployedFunctions(projectId: string): Promise<DeployedFunction[]> {
    try {
        logger.info('📋 Fetching deployed Cloud Functions...');

        // Use firebase functions:list which should work with service account
        const output = execSync(`firebase functions:list --project="${projectId}" --json`, { encoding: 'utf8', stdio: 'pipe' });

        const result = JSON.parse(output);

        // Handle different possible response formats
        let functionsList: any[] = [];
        if (Array.isArray(result)) {
            functionsList = result;
        } else if (result.status === 'success' && result.result) {
            if (Array.isArray(result.result)) {
                functionsList = result.result;
            } else if (result.result.result && Array.isArray(result.result.result)) {
                functionsList = result.result.result;
            }
        } else if (result.functions && Array.isArray(result.functions)) {
            functionsList = result.functions;
        } else if (result.data && Array.isArray(result.data)) {
            functionsList = result.data;
        } else if (result.result && Array.isArray(result.result)) {
            functionsList = result.result;
        } else {
            logger.error('❌ Unexpected response format from Firebase CLI', { result });
            return [];
        }

        // Firebase CLI uses different property names, map to our interface
        const functions: DeployedFunction[] = functionsList.map((func: any) => ({
            name: func.id || func.name || 'unnamed',
            sourceUploadUrl: func.source?.storageSource?.object || func.sourceUploadUrl || '',
            status: func.state || func.status || 'UNKNOWN',
            updateTime: func.updateTime || new Date().toISOString(),
            versionId: func.versionId || func.hash || '',
        }));

        return functions;
    } catch (error) {
        logger.error('❌ Failed to list deployed functions', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
    }
}

async function askForConfirmation(message: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(`${message} (y/N): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

async function deleteFunction(functionName: string, projectId: string): Promise<boolean> {
    try {
        logger.info(`🗑️  Deleting function: ${functionName}...`);

        // Use firebase functions:delete which should work with service account
        execSync(`firebase functions:delete "${functionName}" --project="${projectId}" --force`, { stdio: 'pipe' });

        logger.info(`✅ Successfully deleted: ${functionName}`);
        return true;
    } catch (error) {
        logger.error(`❌ Failed to delete function: ${functionName}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
    }
}

async function selectFunctionsForDeletion(functions: DeployedFunction[]): Promise<DeployedFunction[]> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    console.log('\n📋 Select functions to delete:');
    console.log('   Enter function numbers separated by commas (e.g., 1,3,5)');
    console.log('   Enter "all" to select all functions');
    console.log('   Press Enter to cancel\n');

    functions.forEach((func, index) => {
        console.log(`${index + 1}. ${func.name} (${func.status}, updated: ${new Date(func.updateTime).toLocaleString()})`);
    });

    return new Promise((resolve) => {
        rl.question('\nYour selection: ', (answer) => {
            rl.close();

            if (!answer.trim()) {
                resolve([]);
                return;
            }

            if (answer.toLowerCase() === 'all') {
                resolve(functions);
                return;
            }

            try {
                const indices = answer
                    .split(',')
                    .map((s) => parseInt(s.trim()) - 1)
                    .filter((i) => i >= 0 && i < functions.length);

                resolve(indices.map((i) => functions[i]));
            } catch {
                logger.error('❌ Invalid selection format');
                resolve([]);
            }
        });
    });
}

async function main(): Promise<void> {
    try {
        logger.info('🚀 Firebase Functions Management Tool');

        // Configure Firebase authentication
        await authenticateWithFirebase();

        // Get project ID
        const projectId = await getProjectId();
        logger.info(`📝 Project ID: ${projectId}`);

        // List deployed functions
        const functions = await listDeployedFunctions(projectId);

        if (functions.length === 0) {
            logger.info('✨ No deployed functions found');
            return;
        }

        logger.info(`📊 Found ${functions.length} deployed function(s):`);
        functions.forEach((func, index) => {
            console.log(`   ${index + 1}. ${func.name} (${func.status})`);
        });

        // Ask if user wants to delete any functions
        const wantsToDelete = await askForConfirmation('\n🗑️  Do you want to delete any functions?');

        if (!wantsToDelete) {
            logger.info('👋 No functions deleted. Goodbye!');
            return;
        }

        // Let user select functions to delete
        const toDelete = await selectFunctionsForDeletion(functions);

        if (toDelete.length === 0) {
            logger.info('👋 No functions selected. Goodbye!');
            return;
        }

        // Final confirmation
        console.log(`\n⚠️  You are about to delete ${toDelete.length} function(s):`);
        toDelete.forEach((func) => console.log(`   - ${func.name}`));

        const finalConfirm = await askForConfirmation('\n🚨 This action cannot be undone. Are you absolutely sure?');

        if (!finalConfirm) {
            logger.info('👋 Deletion cancelled. Functions are safe!');
            return;
        }

        // Delete selected functions
        let deletedCount = 0;
        for (const func of toDelete) {
            const success = await deleteFunction(func.name, projectId);
            if (success) deletedCount++;
        }

        logger.info(`🎉 Deletion complete: ${deletedCount}/${toDelete.length} functions deleted successfully`);
    } catch (error) {
        logger.error('💥 Script failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        process.exit(1);
    }
}

// Run the script
main().catch((error) => {
    logger.error('💥 Unhandled error', { error: error.message });
    process.exit(1);
});
