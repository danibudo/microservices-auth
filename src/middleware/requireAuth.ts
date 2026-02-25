import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/tokenService';
import { AppError } from '../errors/AppError';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Missing or invalid Authorization header.'));
  }

  try {
    req.user = verifyAccessToken(authHeader.slice(7));
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired access token.'));
  }
}