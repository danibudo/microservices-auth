import { PoolClient } from 'pg';
import { query } from '../pool';
import { Token, TokenType } from '../../types/domain';

export async function insertToken(
  userId: string,
  type: TokenType,
  tokenHash: string,
  expiresAt: Date,
  client?: PoolClient,
): Promise<Token> {
  const result = await query<Token>(
    `INSERT INTO tokens (user_id, type, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, type, tokenHash, expiresAt],
    client,
  );
  // Safe: INSERT ... RETURNING always returns exactly one row
  return result.rows[0]!;
}

async function findActiveTokenByHashInternal(
  tokenHash: string,
  type: TokenType,
  client: PoolClient | undefined,
  forUpdate: boolean,
): Promise<Token | null> {
  const sql = `SELECT * FROM tokens
     WHERE token_hash = $1
       AND type = $2
       AND revoked_at IS NULL
       AND expires_at > NOW()${forUpdate ? '\n     FOR UPDATE' : ''}`;
  const result = await query<Token>(sql, [tokenHash, type], client);
  return result.rows[0] ?? null;
}

export async function findActiveTokenByHash(
  tokenHash: string,
  type: TokenType,
  client?: PoolClient,
): Promise<Token | null> {
  return findActiveTokenByHashInternal(tokenHash, type, client, false);
}

export async function findActiveTokenByHashForUpdate(
  tokenHash: string,
  type: TokenType,
  client: PoolClient,
): Promise<Token | null> {
  return findActiveTokenByHashInternal(tokenHash, type, client, true);
}

export async function revokeTokenById(
  id: string,
  client?: PoolClient,
): Promise<void> {
  await query(
    'UPDATE tokens SET revoked_at = NOW() WHERE id = $1',
    [id],
    client,
  );
}

export async function revokeAllUserTokens(
  userId: string,
  type: TokenType,
  client?: PoolClient,
): Promise<void> {
  await query(
    `UPDATE tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND type = $2 AND revoked_at IS NULL`,
    [userId, type],
    client,
  );
}

export async function revokeTokenByHash(
  tokenHash: string,
  client?: PoolClient,
): Promise<void> {
  await query(
    `UPDATE tokens SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash],
    client,
  );
}
