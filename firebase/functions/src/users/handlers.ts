import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

export const createUserDocument = async (req: Request, res: Response) => {
  const { displayName } = req.body;
  const userId = (req as any).user.uid;
  
  if (!displayName) {
    res.status(400).json({
      error: {
        code: 'MISSING_DISPLAY_NAME',
        message: 'Display name is required'
      }
    });
    return;
  }
  
  const firestore = admin.firestore();
  await firestore.collection('users').doc(userId).set({
    email: (req as any).user.email,
    displayName,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  res.json({ success: true, message: 'User document created' });
};