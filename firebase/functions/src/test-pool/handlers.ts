import type {Request, Response} from 'express';
import {TestUserPoolService} from './TestUserPoolService';
import {getAuth, getFirestore, isEmulator} from '../firebase';
import {logger} from '../logger';
import {ApplicationBuilder} from '../services/ApplicationBuilder';
import {ReturnTestUserResponse} from '@splitifyd/shared';

const firestore = getFirestore();
const applicationBuilder = ApplicationBuilder.createApplicationBuilder(firestore, getAuth());
const firestoreWriter = applicationBuilder.buildFirestoreWriter();
const userService = applicationBuilder.buildUserService();
const authService = applicationBuilder.buildAuthService();

const pool = TestUserPoolService.getInstance(firestoreWriter, userService, authService);

export async function borrowTestUser(req: Request, res: Response): Promise<void> {
    // Only allow in test environment
    if (!isEmulator()) {
        res.status(403).json({error: 'Test pool only available in emulator'});
        return;
    }

    try {
        const poolUser = await pool.borrowUser();

        res.json(poolUser);
    } catch (error: any) {
        logger.error('Failed to borrow test user', error);
        res.status(500).json({
            error: 'Failed to borrow test user',
            details: error.message,
        });
    }
}

export async function returnTestUser(req: Request, res: Response): Promise<void> {
    if (!isEmulator()) {
        res.status(403).json({error: 'Test pool only available in emulator'});
        return;
    }

    const {email} = req.body;

    if (!email) {
        res.status(400).json({error: 'Email required'});
        return;
    }

    try {
        await pool.returnUser(email);

        const response: ReturnTestUserResponse = {
            message: 'User returned to pool',
            email,
        };
        res.json(response);
    } catch (error: any) {
        logger.error('Failed to return test user', error);
        res.status(500).json({
            error: 'Failed to return test user',
            details: error.message,
        });
    }
}
