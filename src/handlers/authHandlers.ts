import { Request, Response, NextFunction } from 'express';
import { setPassword } from '../services/credentialService';

export async function setPasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await setPassword(req.body.invite_token as string, req.body.new_password as string);
    res.json({ message: 'Password set successfully. You may now log in.' });
  } catch (err) {
    next(err);
  }
}