import { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { getAppBuilder } from "../ApplicationBuilderSingleton";

export const register = async (req: Request, res: Response): Promise<void> => {
    const userService = getAppBuilder().buildUserService();
    const result = await userService.registerUser(req.body);
    res.status(HTTP_STATUS.CREATED).json(result);
};
