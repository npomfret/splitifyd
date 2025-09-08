import type { Request, Response } from 'express';
import { TestUserPoolService } from './TestUserPoolService';
import {getFirestore, isEmulator} from '../firebase';
import { logger } from '../logger';
import { FirestoreReader } from '../services/firestore/FirestoreReader';
import {IFirestoreReader} from "../services/firestore";

const firestoreReader: IFirestoreReader = new FirestoreReader(getFirestore());
const pool = TestUserPoolService.getInstance(firestoreReader);

export async function borrowTestUser(req: Request, res: Response): Promise<void> {
    // Only allow in test environment
    if (!isEmulator()) {
        res.status(403).json({ error: 'Test pool only available in emulator' });
        return;
    }

    try {
        const poolUser = await pool.borrowUser();

        res.json(poolUser);
    } catch (error: any) {
        logger.error('Failed to borrow test user', error);
        res.status(500).json({ 
            error: 'Failed to borrow test user',
            details: error.message
        });
    }
}

export async function returnTestUser(req: Request, res: Response): Promise<void> {
    if (!isEmulator()) {
        res.status(403).json({ error: 'Test pool only available in emulator' });
        return;
    }

    const { email } = req.body;

    if (!email) {
        res.status(400).json({ error: 'Email required' });
        return;
    }

    try {
        await pool.returnUser(email);
        
        res.json({
            message: 'User returned to pool',
            email
        });
    } catch (error: any) {
        logger.error('Failed to return test user', error);
        res.status(500).json({ 
            error: 'Failed to return test user',
            details: error.message
        });
    }
}

export async function getPoolStatus(_req: Request, res: Response): Promise<void> {
    if (!isEmulator()) {
        res.status(403).json({ error: 'Test pool only available in emulator' });
        return;
    }

    try {
        const status = await pool.getPoolStatus();
        res.json(status);
    } catch (error: any) {
        logger.error('Failed to get pool status', error);
        res.status(500).json({ 
            error: 'Failed to get pool status',
            details: error.message
        });
    }
}

export async function resetPool(_req: Request, res: Response): Promise<void> {
    if (!isEmulator()) {
        logger.info('not running in emulator!');
        res.status(403).json({ error: 'Test pool only available in emulator' });
        return;
    }

    logger.info('Test pool resetting');

    try {
        await pool.resetPool();
        
        logger.info('Test pool reset');
        
        const status = await pool.getPoolStatus();
        res.json({
            success: true,
            message: 'Pool reset successfully',
            status
        });
    } catch (error: any) {
        logger.error('Failed to reset pool', error);
        res.status(500).json({ 
            error: 'Failed to reset pool',
            details: error.message
        });
    }
}