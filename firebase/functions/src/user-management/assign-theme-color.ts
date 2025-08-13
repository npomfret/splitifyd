import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { USER_COLORS, COLOR_PATTERNS } from '../constants/user-colors';
import type { UserThemeColor } from '../shared/shared-types';

const db = getFirestore();

export async function assignThemeColor(userId: string): Promise<UserThemeColor> {
  const systemDoc = db.collection('system').doc('colorAssignment');
  
  // Atomic counter increment with transaction
  const result = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(systemDoc);
    const currentIndex = doc.exists ? (doc.data()?.lastColorIndex || 0) : 0;
    const nextIndex = (currentIndex + 1) % USER_COLORS.length;
    
    transaction.set(systemDoc, { 
      lastColorIndex: nextIndex, 
      totalAssigned: FieldValue.increment(1),
      lastAssignedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    
    return nextIndex;
  });
  
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
    colorIndex
  };
}