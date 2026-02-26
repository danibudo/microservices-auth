import { Request, Response, NextFunction } from 'express';
import { changePassword, setPassword } from '../services/credentialService';

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

export async function changePasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // req.user is guaranteed by requireAuth middleware
    await changePassword(
      req.user!.sub,
      req.body.current_password as string,
      req.body.new_password as string,
    );
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
}