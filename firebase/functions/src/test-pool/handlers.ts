import type { Request, Response } from 'express';
import { TestUserPoolService } from './TestUserPoolService';
import { isEmulator } from '../firebase';
import { logger } from '../logger';

const pool = TestUserPoolService.getInstance();

export async function borrowTestUser(req: Request, res: Response): Promise<void> {
    // Only allow in test environment
    if (!isEmulator()) {
        res.status(403).json({ error: 'Test pool only available in emulator' });
        return;
    }

    try {
        const poolUser = await pool.borrowUser();

        logger.info('pool user borrowed', {
            email: poolUser.user.email,
            poolStatus: pool.getPoolStatus(),
        });

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

    pool.returnUser(email);

    logger.info('Test user return attempt', {
        email,
        poolStatus: pool.getPoolStatus()
    });

    res.json({
        message: 'User returned to pool',
        email
    });
}

export async function getPoolStatus(_req: Request, res: Response): Promise<void> {
    if (!isEmulator()) {
        res.status(403).json({ error: 'Test pool only available in emulator' });
        return;
    }

    const status = pool.getPoolStatus();
    res.json(status);
}

export async function resetPool(_req: Request, res: Response): Promise<void> {
    if (!isEmulator()) {
        res.status(403).json({ error: 'Test pool only available in emulator' });
        return;
    }

    pool.resetPool();

    logger.info('Test pool reset');

    res.json({
        success: true,
        message: 'Pool reset successfully',
        status: pool.getPoolStatus()
    });
}