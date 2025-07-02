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
  try {
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

    // For demo purposes, we'll create a custom token
    // In production, you'd verify credentials against your auth system
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

    const token = await admin.auth().createCustomToken(user.uid);

    res.json({
      token,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      }
    });

  } catch (error) {
    logger.errorWithContext('Login error', error as Error, { email: req.body.email });
    
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: {
        code: 'LOGIN_FAILED',
        message: 'Login failed'
      }
    });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
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

    // Create the user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
    });

    // Create custom token for immediate login
    const token = await admin.auth().createCustomToken(userRecord.uid);

    // Create user document in Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(HTTP_STATUS.CREATED).json({
      token,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName
      }
    });

  } catch (error: any) {
    logger.errorWithContext('Registration error', error as Error, { email: req.body.email });
    
    if (error.code === 'auth/email-already-exists') {
      res.status(HTTP_STATUS.CONFLICT).json({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists'
        }
      });
      return;
    }

    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: {
        code: 'REGISTRATION_FAILED',
        message: 'Registration failed'
      }
    });
  }
};