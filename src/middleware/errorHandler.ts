import { Request, Response, NextFunction } from 'express';
import { OAuthError } from '../errors/OAuthError';
import { AppError } from '../errors/AppError';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof OAuthError) {
    res
      .status(err.statusCode)
      .set('Cache-Control', 'no-store')
      .set('Pragma', 'no-cache')
      .json({ error: err.error, error_description: err.error_description });
    return;
  }

  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
}