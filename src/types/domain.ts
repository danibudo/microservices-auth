export type Role = 'member' | 'librarian' | 'access-admin' | 'super-admin';

export type TokenType = 'refresh' | 'invite';

export interface Credential {
  user_id: string;
  email: string;
  role: Role;
  password_hash: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Token {
  id: string;
  user_id: string;
  type: TokenType;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  iat: number;
  exp: number;
}