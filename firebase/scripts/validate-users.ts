#!/usr/bin/env npx tsx
/**
 * Validate user documents against the canonical Firestore schema.
 *
 * Usage:
 *   ./scripts/validate-users.ts <emulator|production> [pageSize] [maxPages]
 *
 * Defaults: pageSize = 25, maxPages = all
 */
import { SystemUserRoles } from '@billsplit-wl/shared';
import * as admin from 'firebase-admin';
import { DocumentSnapshot, FieldPath, FieldValue, Firestore, Query } from 'firebase-admin/firestore';
import { ZodError, type ZodIssue } from 'zod';
import { FirestoreCollections } from '../functions/src/constants';
import { getFirestore } from '../functions/src/firebase';
import { UserDocumentSchema } from '../functions/src/schemas';
import { loadRuntimeConfig } from './scripts-config';
import { initializeFirebase, parseEnvironment, type ScriptEnvironment } from './firebase-init';

// Load and validate runtime configuration
loadRuntimeConfig();

function parseNumberArg(value: string | undefined, fallback: number, allowInfinity = false): number {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return allowInfinity ? Infinity : fallback;
    }
    return parsed;
}

async function resolveFirestore(env: ScriptEnvironment): Promise<Firestore> {
    if (env.isEmulator) {
        return getFirestore();
    }
    return admin.firestore();
}

interface ValidationResult {
    valid: number;
    invalid: number;
    fixed: number;
    issues: Array<{
        id: string;
        reason: string;
        details?: unknown;
    }>;
}

interface PageValidationResult extends ValidationResult {
    lastDoc: DocumentSnapshot | null;
}

function summarizeDoc(doc: DocumentSnapshot): Record<string, unknown> {
    const data = doc.data() ?? {};
    const summary: Record<string, unknown> = {
        id: doc.id,
    };

    if ('email' in data) summary.email = data.email;
    if ('displayName' in data) summary.displayName = data.displayName;
    if ('role' in data) summary.role = data.role;
    if ('createdAt' in data) summary.createdAt = '[Timestamp]';
    if ('updatedAt' in data) summary.updatedAt = '[Timestamp]';

    return summary;
}

function formatZodIssues(error: ZodError): Array<{ path: string; message: string; code: string; }> {
    return error.issues.map((issue: ZodIssue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
    }));
}

function normalizeRole(role: unknown): string | null {
    if (typeof role !== 'string') {
        return SystemUserRoles.SYSTEM_USER;
    }

    const normalized = role.toLowerCase();
    switch (normalized) {
        case 'user':
        case 'system_user':
            return SystemUserRoles.SYSTEM_USER;
        case 'admin':
        case 'system_admin':
            return SystemUserRoles.SYSTEM_ADMIN;
        default:
            return SystemUserRoles.SYSTEM_USER;
    }
}

async function attemptFix(doc: DocumentSnapshot, rawData: Record<string, unknown>, error: ZodError): Promise<boolean> {
    const updates: Record<string, unknown> = {};
    let hasFixes = false;
    const issuePaths = new Set(error.issues.map((issue) => issue.path.join('.')));

    if (issuePaths.has('role')) {
        const normalizedRole = normalizeRole(rawData.role);
        if (normalizedRole) {
            updates.role = normalizedRole;
            hasFixes = true;
        }
    }

    if (issuePaths.has('themeColor')) {
        updates.themeColor = FieldValue.delete();
        hasFixes = true;
    }

    if (!hasFixes) {
        return false;
    }

    console.log(`   🔧 Applying fixes to user ${doc.id}:`, { fields: Object.keys(updates) });
    await doc.ref.update(updates);
    return true;
}

async function validatePage(query: Query, pageNumber: number, fixMode: boolean): Promise<PageValidationResult> {
    console.log(`\n🔍 Validating page ${pageNumber}...`);

    const snapshot = await query.get();
    if (snapshot.empty) {
        console.log('   ↳ Page empty.');
        return { valid: 0, invalid: 0, fixed: 0, issues: [], lastDoc: null };
    }

    let valid = 0;
    let invalid = 0;
    let fixed = 0;
    const issues: ValidationResult['issues'] = [];

    for (const doc of snapshot.docs) {
        const rawData = {
            id: doc.id,
            ...doc.data(),
        };

        try {
            UserDocumentSchema.parse(rawData);
            valid += 1;
            continue;
        } catch (error) {
            if (error instanceof ZodError && fixMode) {
                const fixApplied = await attemptFix(doc, rawData, error);
                if (fixApplied) {
                    const refreshed = await doc.ref.get();
                    const refreshedData = {
                        id: refreshed.id,
                        ...refreshed.data(),
                    };

                    try {
                        UserDocumentSchema.parse(refreshedData);
                        valid += 1;
                        fixed += 1;
                        console.log(`   ✅ User ${doc.id} fixed successfully.`);
                        continue;
                    } catch (postFixError) {
                        console.error(`   ❌ Fix for user ${doc.id} did not validate:`, postFixError);
                        error = postFixError;
                    }
                }
            }

            invalid += 1;

            if (error instanceof ZodError) {
                const formattedIssues = formatZodIssues(error);
                issues.push({
                    id: doc.id,
                    reason: 'Zod validation error',
                    details: formattedIssues,
                });
                console.error('❌ Invalid user document detected:', {
                    summary: summarizeDoc(doc),
                    issues: formattedIssues,
                });
            } else {
                issues.push({
                    id: doc.id,
                    reason: 'Unexpected error during validation',
                    details: error instanceof Error ? error.message : error,
                });
                console.error('❌ Invalid user document detected (unexpected error):', {
                    summary: summarizeDoc(doc),
                    error,
                });
            }
        }
    }

    console.log(`   ↳ Page summary: ${valid} valid (${fixed} fixed), ${invalid} invalid`);

    return {
        valid,
        invalid,
        fixed,
        issues,
        lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
    };
}

async function validateUsers(firestore: Firestore, pageSize: number, maxPages: number, fixMode: boolean): Promise<ValidationResult> {
    let query = firestore.collection(FirestoreCollections.USERS).orderBy(FieldPath.documentId()).limit(pageSize);

    let pageNumber = 1;
    let lastDoc: DocumentSnapshot | null = null;
    let totalValid = 0;
    let totalInvalid = 0;
    let totalFixed = 0;
    const allIssues: ValidationResult['issues'] = [];

    while (pageNumber <= maxPages) {
        if (lastDoc) {
            query = firestore.collection(FirestoreCollections.USERS).orderBy(FieldPath.documentId()).startAfter(lastDoc).limit(pageSize);
        }

        const pageResult = await validatePage(query, pageNumber, fixMode);
        totalValid += pageResult.valid;
        totalInvalid += pageResult.invalid;
        totalFixed += pageResult.fixed;
        allIssues.push(...pageResult.issues);

        if (!pageResult.lastDoc) {
            break;
        }

        lastDoc = pageResult.lastDoc;
        pageNumber += 1;
    }

    return {
        valid: totalValid,
        invalid: totalInvalid,
        fixed: totalFixed,
        issues: allIssues,
    };
}

async function main(): Promise<void> {
    const rawArgs = process.argv.slice(2);
    const fixMode = rawArgs.includes('--fix');
    const argsWithoutFlags = rawArgs.filter((arg) => !arg.startsWith('--'));
    const env = parseEnvironment(argsWithoutFlags);

    const pageSize = parseNumberArg(argsWithoutFlags[1], 25);
    const maxPages = parseNumberArg(argsWithoutFlags[2], Infinity, true);

    initializeFirebase(env);

    if (env.isEmulator) {
        console.log('✅ Connected to Firebase Emulator');
    } else {
        console.log('✅ Connected to Production Firebase');
    }

    const firestore = await resolveFirestore(env);
    const { valid, invalid, fixed, issues } = await validateUsers(firestore, pageSize, maxPages, fixMode);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 USER VALIDATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   • Valid documents:   ${valid}`);
    console.log(`   • Invalid documents: ${invalid}`);
    console.log(`   • Fixed documents:   ${fixed}`);
    console.log(`   • Issues recorded:   ${issues.length}`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (invalid > 0) {
        console.error('❌ Validation failed. See logs above for details.');
        process.exit(1);
    }

    console.log('✅ All processed user documents are valid.');
}

if (require.main === module) {
    main().catch((error) => {
        console.error('💥 User validation script failed:', error);
        process.exit(1);
    });
}

export { main as validateUsers };
