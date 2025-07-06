import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { validateCreateUserRequest } from './validation';

export const createUserDocument = async (req: Request, res: Response) => {
  const { displayName } = validateCreateUserRequest(req.body);
  const userId = (req as any).user.uid;
  
  const firestore = admin.firestore();
  await firestore.collection('users').doc(userId).set({
    email: (req as any).user.email,
    displayName,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  res.json({ success: true, message: 'User document created' });
};