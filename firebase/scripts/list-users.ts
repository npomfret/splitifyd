#!/usr/bin/env npx tsx
import * as admin from 'firebase-admin';
import type { UserRecord } from 'firebase-admin/auth';
import { DocumentSnapshot, FieldPath, Firestore } from 'firebase-admin/firestore';
import { FirestoreCollections } from '../functions/src/constants';
import { initializeFirebase, parseEnvironment } from './firebase-init';

/**
 * Script to paginate through user documents in Firestore
 * Usage:
 *   tsx paginate-users.ts emulator [pageSize] [maxPages]
 *   tsx paginate-users.ts production [pageSize] [maxPages]
 */

// Parse command line arguments
const args = process.argv.slice(2);
const pageSize = parseInt(args[1]) || 10;
const maxPages = parseInt(args[2]) || 5;

// Parse command line arguments and initialize Firebase
const env = parseEnvironment(process.argv.slice(2));
initializeFirebase(env);

const { isEmulator, environment } = env;
console.log(`🎯 Paginating through users in ${environment}`);
console.log(`📄 Page size: ${pageSize}, Max pages: ${maxPages}`);

// We'll get these instances dynamically
let firestoreDb: Firestore;
let authService: admin.auth.Auth;

/**
 * Initialize Firebase and import handlers
 */
async function initializeAppServices() {
    console.log('🔧 Initializing Firebase database connection...');

    if (!isEmulator && require.main === module) {
        // Production mode - use the admin instance we already initialized
        console.log('🔗 Getting Firestore instance for production...');
        try {
            firestoreDb = admin.firestore();
            console.log('✅ Firestore instance obtained successfully');
            authService = admin.auth();
        } catch (error) {
            console.error('❌ Failed to get Firestore instance:', error);
            throw error;
        }
    } else {
        // Emulator mode - import everything normally
        console.log('🔗 Importing Firebase module for emulator...');
        const firebaseModule = await import('../functions/src/firebase');
        firestoreDb = firebaseModule.getFirestore();
        console.log('✅ Emulator Firestore instance obtained');
        authService = admin.auth();
    }
}

/**
 * Summary of Firebase Auth data for quick display.
 */
interface AuthUserSummary {
    exists: boolean;
    email?: string;
    displayName?: string;
    disabled: boolean;
    emailVerified: boolean;
    providerIds: string[];
    raw?: UserRecord;
}

const createEmptyAuthSummary = (): AuthUserSummary => ({
    exists: false,
    disabled: false,
    emailVerified: false,
    providerIds: [],
});

/**
 * Fetch Firebase Auth user summaries for the provided UIDs.
 */
async function fetchAuthSummaries(uids: string[]): Promise<Map<string, AuthUserSummary>> {
    const summaries = new Map<string, AuthUserSummary>();

    if (uids.length === 0) {
        return summaries;
    }

    uids.forEach((uid) => {
        summaries.set(uid, createEmptyAuthSummary());
    });

    const identifiers = uids.map((uid) => ({ uid }));
    const result = await authService.getUsers(identifiers);

    result.users.forEach((user) => {
        summaries.set(user.uid, {
            exists: true,
            email: user.email ?? undefined,
            displayName: user.displayName ?? undefined,
            disabled: user.disabled,
            emailVerified: user.emailVerified,
            providerIds: user.providerData.map((provider) => provider.providerId).filter(Boolean),
            raw: user,
        });
    });

    result.notFound.forEach((identifier) => {
        if ('uid' in identifier && identifier.uid) {
            summaries.set(identifier.uid, createEmptyAuthSummary());
        }
    });

    return summaries;
}

/**
 * Convert known timestamp-like values into ISO strings for display.
 */
function toIsoString(value: unknown, field: string, docId: string): string | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value === 'string') {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            console.warn(`⚠️ Invalid date string for ${field} on user ${docId}: ${value}`);
            return undefined;
        }
        return date.toISOString();
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (value instanceof admin.firestore.Timestamp) {
        return value.toDate().toISOString();
    }

    if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
        const date = (value as { toDate: () => Date }).toDate();
        return date.toISOString();
    }

    return undefined;
}

function normalizeFirestoreObject(value: unknown, docId: string, fieldPath: string): unknown {
    if (!value || typeof value !== 'object') {
        return value;
    }

    if (value instanceof admin.firestore.Timestamp) {
        return value.toDate().toISOString();
    }

    if (Array.isArray(value)) {
        return value.map((item, index) => normalizeFirestoreObject(item, docId, `${fieldPath}[${index}]`));
    }

    const record = value as Record<string, unknown>;
    return Object.fromEntries(
        Object.entries(record).map(([key, entryValue]) => {
            const nextPath = fieldPath ? `${fieldPath}.${key}` : key;
            const normalized =
                entryValue instanceof admin.firestore.Timestamp
                    ? entryValue.toDate().toISOString()
                    : normalizeFirestoreObject(entryValue, docId, nextPath);
            return [key, normalized];
        })
    );
}

interface FirestoreUserSummary {
    email?: string;
    displayName?: string;
    role?: string;
    themeColor?: unknown;
    preferredLanguage?: string;
    acceptedPolicies?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
    termsAcceptedAt?: string;
    cookiePolicyAcceptedAt?: string;
    passwordChangedAt?: string;
}

function summarizeFirestoreUser(doc: DocumentSnapshot): FirestoreUserSummary {
    const data = doc.data() ?? {};
    const summary: FirestoreUserSummary = {};

    if (typeof data.email === 'string') {
        summary.email = data.email;
    }

    if (typeof data.displayName === 'string') {
        summary.displayName = data.displayName;
    }

    if (typeof data.role === 'string') {
        summary.role = data.role;
    }

    if ('themeColor' in data) {
        summary.themeColor = normalizeFirestoreObject((data as Record<string, unknown>).themeColor, doc.id, 'themeColor');
    }

    if (data.acceptedPolicies && typeof data.acceptedPolicies === 'object' && !Array.isArray(data.acceptedPolicies)) {
        summary.acceptedPolicies = normalizeFirestoreObject(data.acceptedPolicies, doc.id, 'acceptedPolicies') as Record<string, unknown>;
    }

    summary.createdAt = toIsoString((data as Record<string, unknown>).createdAt, 'createdAt', doc.id);
    summary.updatedAt = toIsoString((data as Record<string, unknown>).updatedAt, 'updatedAt', doc.id);
    summary.termsAcceptedAt = toIsoString((data as Record<string, unknown>).termsAcceptedAt, 'termsAcceptedAt', doc.id);
    summary.cookiePolicyAcceptedAt = toIsoString((data as Record<string, unknown>).cookiePolicyAcceptedAt, 'cookiePolicyAcceptedAt', doc.id);
    summary.passwordChangedAt = toIsoString((data as Record<string, unknown>).passwordChangedAt, 'passwordChangedAt', doc.id);

    return summary;
}

interface UserTableRow {
    emailFb: string;
    displayNameFb: string;
    disabledFb: string;
    emailVerifiedFb: string;
    providerIdsFb: string;
    idFs: string;
    emailFs: string;
    displayNameFs: string;
    roleFs: string;
    themeColorFs: string;
    updatedAtFs: string;
    acceptedPoliciesFs: string;
}

const USER_TABLE_COLUMNS: Array<{ key: keyof UserTableRow; header: string }> = [
    { key: 'emailFb', header: 'email (FB)' },
    { key: 'displayNameFb', header: 'displayName (FB)' },
    { key: 'disabledFb', header: 'disabled (FB)' },
    { key: 'emailVerifiedFb', header: 'emailVerified (FB)' },
    { key: 'providerIdsFb', header: 'providerIds (FB)' },
    { key: 'idFs', header: 'id (FS)' },
    { key: 'emailFs', header: 'email (FS)' },
    { key: 'displayNameFs', header: 'displayName (FS)' },
    { key: 'roleFs', header: 'role (FS)' },
    { key: 'themeColorFs', header: 'themeColor (FS)' },
    { key: 'updatedAtFs', header: 'updatedAt (FS)' },
    { key: 'acceptedPoliciesFs', header: 'acceptedPolicies (FS)' },
];

function renderTable(rows: UserTableRow[]): string {
    if (rows.length === 0) {
        return '   (no users)';
    }

    const columnWidths = USER_TABLE_COLUMNS.map((column) => {
        const headerWidth = column.header.length;
        const rowWidth = rows.reduce((max, row) => {
            const cell = row[column.key] ?? '';
            return Math.max(max, cell.length);
        }, 0);
        return Math.max(headerWidth, rowWidth);
    });

    const padCell = (value: string, width: number) => value.padEnd(width, ' ');

    const headerRow = USER_TABLE_COLUMNS.map((column, index) => padCell(column.header, columnWidths[index])).join('  ');
    const separatorRow = columnWidths.map((width) => '-'.repeat(width)).join('  ');
    const valueRows = rows.map((row) =>
        USER_TABLE_COLUMNS.map((column, index) => padCell(row[column.key] ?? '', columnWidths[index])).join('  ')
    );

    return [headerRow, separatorRow, ...valueRows].join('\n');
}

const asDisplayValue = (value?: string): string => (value && value.trim().length > 0 ? value : '--');
const formatBoolean = (value: boolean | undefined): string => (typeof value === 'boolean' ? String(value) : '--');
const formatProviderIds = (ids: string[]): string => (ids.length > 0 ? ids.join(',') : '--');
const stringifyUnknown = (value: unknown): string => {
    if (value === undefined || value === null) {
        return '--';
    }

    if (typeof value === 'string') {
        return value.trim().length > 0 ? value : '--';
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    try {
        return JSON.stringify(value);
    } catch (error) {
        return String(value);
    }
};

interface UserRowAnalysis {
    row: UserTableRow;
    authExists: boolean;
    emailMismatch: boolean;
    displayNameMismatch: boolean;
    firestoreEmailMissing: boolean;
    authEmailMissing: boolean;
}

function buildUserRow(uid: string, authSummary: AuthUserSummary, firestoreSummary: FirestoreUserSummary): UserRowAnalysis {
    const authEmail = authSummary.email ?? '';
    const firestoreEmail = firestoreSummary.email ?? '';
    const emailMismatch =
        authSummary.exists &&
        Boolean(authEmail) &&
        Boolean(firestoreEmail) &&
        authEmail.trim().toLowerCase() !== firestoreEmail.trim().toLowerCase();

    const authName = authSummary.displayName ?? '';
    const firestoreName = firestoreSummary.displayName ?? '';
    const displayNameMismatch =
        authSummary.exists &&
        Boolean(authName) &&
        Boolean(firestoreName) &&
        authName.trim() !== firestoreName.trim();

    const mismatchMarker = (flag: boolean) => (flag ? ' *' : '');

    const row: UserTableRow = {
        emailFb: asDisplayValue(authEmail) + mismatchMarker(emailMismatch),
        displayNameFb: asDisplayValue(authName) + mismatchMarker(displayNameMismatch),
        disabledFb: authSummary.exists ? formatBoolean(authSummary.disabled) : '--',
        emailVerifiedFb: authSummary.exists ? formatBoolean(authSummary.emailVerified) : '--',
        providerIdsFb: authSummary.exists ? formatProviderIds(authSummary.providerIds) : '--',
        idFs: asDisplayValue(uid),
        emailFs: asDisplayValue(firestoreEmail) + mismatchMarker(emailMismatch),
        displayNameFs: asDisplayValue(firestoreName) + mismatchMarker(displayNameMismatch),
        roleFs: asDisplayValue(firestoreSummary.role),
        themeColorFs: stringifyUnknown(firestoreSummary.themeColor),
        updatedAtFs: asDisplayValue(firestoreSummary.updatedAt),
        acceptedPoliciesFs: stringifyUnknown(firestoreSummary.acceptedPolicies),
    };

    return {
        row,
        authExists: authSummary.exists,
        emailMismatch,
        displayNameMismatch,
        firestoreEmailMissing: !firestoreEmail,
        authEmailMissing: !authEmail,
    };
}

/**
 * Get total user count
 */
async function getTotalUserCount(): Promise<number> {
    const snapshot = await firestoreDb.collection(FirestoreCollections.USERS).get();
    return snapshot.size;
}

/**
 * Paginate through users
 */
async function listUsers(): Promise<void> {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📄 PAGINATING THROUGH USER DOCUMENTS...');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    try {
        // Get total count first
        console.log('📊 Getting total user count...');
        const totalUsers = await getTotalUserCount();
        const totalPages = Math.ceil(totalUsers / pageSize);

        console.log(`Found ${totalUsers} total users across ${totalPages} pages`);
        if (totalUsers === 0) {
            console.log('No user documents found.');
            return;
        }

        const pagesToShow = Math.min(maxPages, totalPages);
        console.log(`Will display up to ${pagesToShow} pages\n`);

        const baseQuery = firestoreDb.collection(FirestoreCollections.USERS).orderBy(FieldPath.documentId());

        let pageNumber = 1;
        let pagesDisplayed = 0;
        let lastDoc: DocumentSnapshot | null = null;
        let usersShown = 0;
        let missingAuthCount = 0;
        let emailMismatchCount = 0;
        let nameMismatchCount = 0;
        let firestoreEmailMissingCount = 0;
        let authEmailMissingCount = 0;
        let legendPrinted = false;

        while (pageNumber <= pagesToShow) {
            console.log(`📄 PAGE ${pageNumber}/${pagesToShow}:`);
            console.log('─'.repeat(80));

            // Apply pagination cursor if we have one
            const query = lastDoc ? baseQuery.startAfter(lastDoc).limit(pageSize) : baseQuery.limit(pageSize);
            const snapshot = await query.get();

            if (snapshot.empty) {
                console.log('📭 No more users found');
                break;
            }

            const docs = snapshot.docs;
            const authSummaries = await fetchAuthSummaries(docs.map((doc) => doc.id));
            const analyses = docs.map((doc) => {
                const firestoreSummary = summarizeFirestoreUser(doc);
                const authSummary = authSummaries.get(doc.id) ?? createEmptyAuthSummary();
                return buildUserRow(doc.id, authSummary, firestoreSummary);
            });

            const rows = analyses.map((analysis) => analysis.row);
            console.log(renderTable(rows));

            const hasMismatch = analyses.some((analysis) => analysis.emailMismatch || analysis.displayNameMismatch);
            if (!legendPrinted && hasMismatch) {
                console.log('\n   * indicates difference between Firebase Auth and Firestore values');
                legendPrinted = true;
            }

            console.log('');

            analyses.forEach((analysis) => {
                usersShown += 1;
                if (!analysis.authExists) {
                    missingAuthCount += 1;
                }
                if (analysis.emailMismatch) {
                    emailMismatchCount += 1;
                }
                if (analysis.displayNameMismatch) {
                    nameMismatchCount += 1;
                }
                if (analysis.firestoreEmailMissing) {
                    firestoreEmailMissingCount += 1;
                }
                if (analysis.authEmailMissing) {
                    authEmailMissingCount += 1;
                }
            });

            // Store the last document for pagination
            lastDoc = docs[docs.length - 1];
            pagesDisplayed += 1;

            if (!lastDoc || docs.length < pageSize) {
                break;
            }

            pageNumber += 1;

            if (pageNumber > pagesToShow) {
                break;
            }

            // Add a small delay for readability
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Show summary
        console.log('═══════════════════════════════════════════════════════');
        console.log('📊 PAGINATION SUMMARY:');
        console.log(`  - Total users in database: ${totalUsers}`);
        console.log(`  - Pages displayed: ${pagesDisplayed}`);
        console.log(`  - Users shown: ${usersShown}`);
        console.log(`  - Firebase Auth missing: ${missingAuthCount}`);
        console.log(`  - Auth email missing: ${authEmailMissingCount}`);
        console.log(`  - Firestore email missing: ${firestoreEmailMissingCount}`);
        console.log(`  - Email mismatches (* marker): ${emailMismatchCount}`);
        console.log(`  - Display name mismatches (* marker): ${nameMismatchCount}`);

        if (totalPages > pagesToShow) {
            console.log(`  - Remaining pages: ${totalPages - pagesToShow}`);
            console.log('  - To see more pages, increase maxPages parameter');
        }
        console.log('═══════════════════════════════════════════════════════');
    } catch (error) {
        console.error('❌ Error during pagination:', error);
        throw error;
    }
}

/**
 * Main function
 */
async function main(): Promise<void> {
    try {
        // Initialize Firebase
        await initializeAppServices();

        // Start pagination
        await listUsers();

        console.log('✅ User pagination completed successfully!');
    } catch (error) {
        console.error('❌ User pagination failed:', error);
        throw error;
    }
}

// Run if executed directly
if (require.main === module) {
    main()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Script failed:', error);
            process.exit(1);
        });
}

export { main as paginateUsers };
