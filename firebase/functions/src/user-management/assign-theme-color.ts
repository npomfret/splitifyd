import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { COLOR_PATTERNS, USER_COLORS, UserThemeColor } from '@splitifyd/shared';
import { runTransactionWithRetry } from '../utils/firestore-helpers';
import { getFirestoreReader } from '../services/serviceRegistration';

export async function assignThemeColor(userId: string): Promise<UserThemeColor> {
    const db = getFirestore();
    const systemDoc = db.collection('system').doc('colorAssignment');
    const firestoreReader = getFirestoreReader();

    // Atomic counter increment with transaction
    const result = await runTransactionWithRetry(
        async (transaction) => {
            const doc = await firestoreReader.getSystemDocumentInTransaction(transaction, 'colorAssignment');
            const currentIndex = doc?.data()?.lastColorIndex || 0;
            const nextIndex = (currentIndex + 1) % USER_COLORS.length;

            transaction.set(
                systemDoc,
                {
                    lastColorIndex: nextIndex,
                    totalAssigned: FieldValue.increment(1),
                    lastAssignedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );

            return nextIndex;
        },
        {
            maxAttempts: 3,
            context: {
                operation: 'assignThemeColor',
                userId
            }
        }
    );

    const colorIndex = result;
    const systemData = (await systemDoc.get()).data();
    const totalAssigned = systemData?.totalAssigned || 0;
    const patternIndex = Math.floor(totalAssigned / USER_COLORS.length) % COLOR_PATTERNS.length;

    const color = USER_COLORS[colorIndex];
    const pattern = COLOR_PATTERNS[patternIndex];

    return {
        light: color.light,
        dark: color.dark,
        name: color.name,
        pattern,
        assignedAt: new Date().toISOString(),
        colorIndex,
    };
}
