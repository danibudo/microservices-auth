export type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'invalid_scope';

const statusCodes: Record<OAuthErrorCode, number> = {
  invalid_request: 400,
  invalid_client: 401,
  invalid_grant: 401,
  unauthorized_client: 400,
  unsupported_grant_type: 400,
  invalid_scope: 400,
};

export class OAuthError extends Error {
  public readonly statusCode: number;

  constructor(
    public readonly error: OAuthErrorCode,
    public readonly error_description: string,
  ) {
    super(error_description);
    this.name = 'OAuthError';
    this.statusCode = statusCodes[error];
    Error.captureStackTrace(this, this.constructor);
  }
}