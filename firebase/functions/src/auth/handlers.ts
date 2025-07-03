import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}


export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password }: LoginRequest = req.body;

  if (!email || !password) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: {
        code: 'MISSING_FIELDS',
        message: 'Email and password are required'
      }
    });
    return;
  }

  // Note: This is a simplified approach for demonstration
  // In production, you'd verify the password properly
  const user = await admin.auth().getUserByEmail(email).catch(() => null);
  
  if (!user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      }
    });
    return;
  }

  res.json({
    success: true,
    message: 'Login successful',
    user: {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName
    }
  });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, displayName }: RegisterRequest = req.body;

  if (!email || !password || !displayName) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: {
        code: 'MISSING_FIELDS',
        message: 'Email, password, and display name are required'
      }
    });
    return;
  }

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