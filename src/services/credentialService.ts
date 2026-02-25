import { config } from '../config/env';
import {
  deleteCredential,
  findCredentialByEmail,
  findCredentialByUserId,
  insertCredential,
  setCredentialPasswordHash,
  updateCredentialRole,
} from '../db/queries/credentials';
import {
  findActiveTokenByHash,
  findActiveTokenByHashForUpdate,
  insertToken,
  revokeAllUserTokens,
  revokeTokenById,
  revokeTokenByHash,
} from '../db/queries/tokens';
import { withTransaction } from '../db/pool';
import { OAuthError } from '../errors/OAuthError';
import { AppError } from '../errors/AppError';
import { Role } from '../types/domain';
import { comparePassword, hashPassword } from './passwordService';
import { generateSecureToken, hashToken, signAccessToken } from './tokenService';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string,
): Promise<TokenPair> {
  const credential = await findCredentialByEmail(email);

  // Deliberately identical error for missing account vs wrong password
  // to avoid leaking which emails are registered
  if (!credential || !credential.password_hash) {
    throw new OAuthError('invalid_grant', 'Invalid email or password.');
  }

  const valid = await comparePassword(password, credential.password_hash);
  if (!valid) {
    throw new OAuthError('invalid_grant', 'Invalid email or password.');
  }

  const { raw, hash } = generateSecureToken();
  const expiresAt = secondsFromNow(config.JWT_REFRESH_EXPIRES_IN);
  await insertToken(credential.user_id, 'refresh', hash, expiresAt);

  const accessToken = signAccessToken({
    sub: credential.user_id,
    email: credential.email,
    role: credential.role,
  });

  return { accessToken, refreshToken: raw, expiresIn: config.JWT_ACCESS_EXPIRES_IN };
}

// ─── Refresh ──────────────────────────────────────────────────────────────────

export async function refresh(rawRefreshToken: string): Promise<TokenPair> {
  const tokenHash = hashToken(rawRefreshToken);

  return withTransaction(async (client) => {
    const existingToken = await findActiveTokenByHashForUpdate(tokenHash, 'refresh', client);

    if (!existingToken) {
      throw new OAuthError(
        'invalid_grant',
        'Refresh token is invalid, expired, or revoked.',
      );
    }

    const credential = await findCredentialByUserId(existingToken.user_id, client);
    if (!credential) {
      throw new OAuthError(
        'invalid_grant',
        'Refresh token is invalid, expired, or revoked.',
      );
    }

    await revokeTokenById(existingToken.id, client);

    const { raw, hash } = generateSecureToken();
    const expiresAt = secondsFromNow(config.JWT_REFRESH_EXPIRES_IN);
    await insertToken(credential.user_id, 'refresh', hash, expiresAt, client);

    const accessToken = signAccessToken({
      sub: credential.user_id,
      email: credential.email,
      role: credential.role,
    });

    return { accessToken, refreshToken: raw, expiresIn: config.JWT_ACCESS_EXPIRES_IN };
  });
}

// ─── Revoke ───────────────────────────────────────────────────────────────────

export async function revoke(rawToken: string): Promise<void> {
  // RFC 7009: always succeeds, even if the token is unknown or already revoked
  const tokenHash = hashToken(rawToken);
  await revokeTokenByHash(tokenHash);
}

// ─── Set password (invite / onboarding flow) ──────────────────────────────────

export async function setPassword(
  rawInviteToken: string,
  newPassword: string,
): Promise<void> {
  const tokenHash = hashToken(rawInviteToken);

  await withTransaction(async (client) => {
    const inviteToken = await findActiveTokenByHash(tokenHash, 'invite', client);

    if (!inviteToken) {
      throw new AppError(400, 'Invite token is invalid or has expired.');
    }

    const credential = await findCredentialByUserId(inviteToken.user_id, client);

    if (!credential) {
      throw new AppError(400, 'Invite token is invalid or has expired.');
    }

    if (credential.password_hash !== null) {
      throw new AppError(400, 'This invite has already been used.');
    }

    const passwordHash = await hashPassword(newPassword);
    await setCredentialPasswordHash(credential.user_id, passwordHash, client);
    await revokeTokenById(inviteToken.id, client);
  });
}

// ─── Event handlers (called by RabbitMQ consumers) ────────────────────────────

export async function createFromEvent(data: {
  userId: string;
  email: string;
  role: Role;
}): Promise<{ inviteToken: string; expiresAt: Date }> {
  const { raw, hash } = generateSecureToken();
  const expiresAt = secondsFromNow(config.INVITE_TOKEN_EXPIRES_IN);

  await withTransaction(async (client) => {
    await insertCredential(data.userId, data.email, data.role, client);
    await insertToken(data.userId, 'invite', hash, expiresAt, client);
  });

  return { inviteToken: raw, expiresAt };
}

export async function resendInviteFromEvent(
  userId: string,
): Promise<{ inviteToken: string; expiresAt: Date }> {
  const { raw, hash } = generateSecureToken();
  const expiresAt = secondsFromNow(config.INVITE_TOKEN_EXPIRES_IN);

  await withTransaction(async (client) => {
    const credential = await findCredentialByUserId(userId, client);

    if (!credential) {
      throw new AppError(404, `No credential found for user ${userId}.`);
    }

    // Revoke any outstanding invite tokens before issuing a new one
    await revokeAllUserTokens(userId, 'invite', client);
    await insertToken(userId, 'invite', hash, expiresAt, client);
  });

  return { inviteToken: raw, expiresAt };
}

export async function updateRoleFromEvent(
  userId: string,
  role: Role,
): Promise<void> {
  await updateCredentialRole(userId, role);
}

export async function deleteFromEvent(userId: string): Promise<void> {
  // ON DELETE CASCADE handles token cleanup automatically
  await deleteCredential(userId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function secondsFromNow(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}