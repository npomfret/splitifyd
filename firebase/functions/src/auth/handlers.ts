import { Request, Response } from 'express';
import { getComponentBuilder } from '../ComponentBuilderSingleton';
import { HTTP_STATUS } from '../constants';

export const register = async (req: Request, res: Response): Promise<void> => {
    const userService = getComponentBuilder().buildUserService();
    const result = await userService.registerUser(req.body);
    res.status(HTTP_STATUS.CREATED).json(result);
};
