import { ReturnTestUserResponse } from '@splitifyd/shared';
import type { Request, Response } from 'express';
import { getIdentityToolkitConfig } from '../client-config';
import { getAuth, getFirestore, isEmulator } from '../firebase';
import { logger } from '../logger';
import { ComponentBuilder } from '../services/ComponentBuilder';
import { requireInstanceMode } from '../shared/instance-mode';
import { TestUserPoolService } from './TestUserPoolService';

// todo: use the singleton
const firestore = getFirestore();
const applicationBuilder = ComponentBuilder.createComponentBuilder(firestore, getAuth(), getIdentityToolkitConfig());
const firestoreWriter = applicationBuilder.buildFirestoreWriter();
const userService = applicationBuilder.buildUserService();
const authService = applicationBuilder.buildAuthService();

const pool = TestUserPoolService.getInstance(firestoreWriter, userService, authService);

const isTestEnvironment = (): boolean => {
    try {
        return requireInstanceMode() === 'test';
    } catch {
        return false;
    }
};

const isPoolEnabled = (): boolean => isEmulator() || isTestEnvironment();

export async function borrowTestUser(req: Request, res: Response): Promise<void> {
    if (!isPoolEnabled()) {
        res.status(403).json({ error: 'Test pool only available in emulator or test environments' });
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
    if (!isPoolEnabled()) {
        res.status(403).json({ error: 'Test pool only available in emulator or test environments' });
        return;
    }

    const { email } = req.body;

    if (!email) {
        res.status(400).json({ error: 'Email required' });
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
