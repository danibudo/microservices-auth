import { PoolClient } from 'pg';
import { query } from '../pool';
import { Credential, Role } from '../../types/domain';

export async function findCredentialByEmail(
  email: string,
  client?: PoolClient,
): Promise<Credential | null> {
  const result = await query<Credential>(
    'SELECT * FROM credentials WHERE email = $1',
    [email],
    client,
  );
  return result.rows[0] ?? null;
}

export async function findCredentialByUserId(
  userId: string,
  client?: PoolClient,
): Promise<Credential | null> {
  const result = await query<Credential>(
    'SELECT * FROM credentials WHERE user_id = $1',
    [userId],
    client,
  );
  return result.rows[0] ?? null;
}

export async function insertCredential(
  userId: string,
  email: string,
  role: Role,
  client?: PoolClient,
): Promise<Credential> {
  const result = await query<Credential>(
    `INSERT INTO credentials (user_id, email, role)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, email, role],
    client,
  );
  // Safe: INSERT ... RETURNING always returns exactly one row
  return result.rows[0]!;
}

export async function updateCredentialRole(
  userId: string,
  role: Role,
  client?: PoolClient,
): Promise<void> {
  await query(
    'UPDATE credentials SET role = $1 WHERE user_id = $2',
    [role, userId],
    client,
  );
}

export async function setCredentialPasswordHash(
  userId: string,
  passwordHash: string,
  client?: PoolClient,
): Promise<void> {
  await query(
    'UPDATE credentials SET password_hash = $1 WHERE user_id = $2',
    [passwordHash, userId],
    client,
  );
}

export async function deleteCredential(
  userId: string,
  client?: PoolClient,
): Promise<void> {
  // Cascades to tokens via FK ON DELETE CASCADE
  await query(
    'DELETE FROM credentials WHERE user_id = $1',
    [userId],
    client,
  );
}
