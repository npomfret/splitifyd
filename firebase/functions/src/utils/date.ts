import { Timestamp } from 'firebase-admin/firestore';

/**
 * @deprecated Use assertTimestampAndConvert or assertDateAndConvert for clear data contracts
 */
export const toISOString = (value: Timestamp | Date): string => {
    if (value instanceof Timestamp) {
        return value.toDate().toISOString();
    }
    return value.toISOString();
};
