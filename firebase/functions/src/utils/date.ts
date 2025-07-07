import { Timestamp } from 'firebase-admin/firestore';

export const toISOString = (value: Timestamp | Date): string => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  return value.toISOString();
};