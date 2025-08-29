import { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { getUserService } from '../services/serviceRegistration';
import { ApiError } from '../utils/errors';

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const userService = getUserService();
        const result = await userService.registerUser(req.body);
        res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error: unknown) {
        // Handle specific ApiError instances for proper error response formatting
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({
                error: {
                    code: error.code,
                    message: error.message,
                },
            });
            return;
        }

        // Let all other errors bubble up to global error handler
        throw error;
    }
};
