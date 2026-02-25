import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { JwtPayload } from '../types/domain';

export function signAccessToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN,
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
  } catch {
    throw new Error('Invalid or expired access token');
  }
}

/**
 * Generates a cryptographically random token and its SHA-256 hash.
 * Used for both refresh tokens and invite tokens.
 * The raw value is sent to the client/notification service; only the hash is stored in the DB.
 */
export function generateSecureToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}