import { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { getUserService } from '../services/serviceRegistration';

export const register = async (req: Request, res: Response): Promise<void> => {
    const userService = getUserService();
    const result = await userService.registerUser(req.body);
    res.status(HTTP_STATUS.CREATED).json(result);
};
