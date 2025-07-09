import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { validateRegisterRequest } from './validation';

export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, displayName } = validateRegisterRequest(req.body);

  try {
    // Create the user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
    });

    // Create user document in Firestore
    const firestore = admin.firestore();
    await firestore.collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logger.info('User registration completed', { 
      email,
      userId: userRecord.uid 
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Account created successfully',
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName
      }
    });
  } catch (error: any) {
    if (error.code === 'auth/email-already-exists') {
      res.status(HTTP_STATUS.CONFLICT).json({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists'
        }
      });
      return;
    }
    
    // Let other errors bubble up to global error handler
    throw error;
  }
};