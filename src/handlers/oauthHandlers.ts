import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { login, refresh, revoke, TokenPair } from '../services/credentialService';
import { OAuthError } from '../errors/OAuthError';
import { formatZodError } from '../middleware/validate';

const passwordGrantSchema = z.object({
  grant_type: z.literal('password'),
  username: z.string().email({ message: 'must be a valid email' }),
  password: z.string().min(1, { message: 'is required' }),
});

const refreshGrantSchema = z.object({
  grant_type: z.literal('refresh_token'),
  refresh_token: z.string().min(1, { message: 'is required' }),
});

const revokeSchema = z.object({
  token: z.string().min(1, { message: 'is required' }),
  token_type_hint: z.enum(['refresh_token', 'access_token']).optional(),
});

export async function tokenHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const grantType = (req.body as Record<string, unknown>)['grant_type'];

    if (grantType === 'password') {
      const parsed = passwordGrantSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new OAuthError('invalid_request', formatZodError(parsed.error));
      }
      const result = await login(parsed.data.username, parsed.data.password);
      sendTokenResponse(res, result);
    } else if (grantType === 'refresh_token') {
      const parsed = refreshGrantSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new OAuthError('invalid_request', formatZodError(parsed.error));
      }
      const result = await refresh(parsed.data.refresh_token);
      sendTokenResponse(res, result);
    } else if (grantType === undefined || grantType === null) {
      throw new OAuthError('invalid_request', 'grant_type is required.');
    } else {
      throw new OAuthError(
        'unsupported_grant_type',
        "Supported grant types: 'password', 'refresh_token'.",
      );
    }
  } catch (err) {
    next(err);
  }
}

export async function revokeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = revokeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new OAuthError('invalid_request', formatZodError(parsed.error));
    }
    await revoke(parsed.data.token);
    // RFC 7009: always respond 200, even if token was unknown
    res.json({});
  } catch (err) {
    next(err);
  }
}

function sendTokenResponse(res: Response, result: TokenPair): void {
  res
    .set('Cache-Control', 'no-store')
    .set('Pragma', 'no-cache')
    .json({
      access_token: result.accessToken,
      token_type: 'Bearer',
      expires_in: result.expiresIn,
      refresh_token: result.refreshToken,
    });
}