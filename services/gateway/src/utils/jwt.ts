import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;       // userId
  jti?: string;      // JWT ID (token id for revocation)
  iat?: number;
  exp?: number;
  type?: 'access' | 'refresh';
}

export class JwtVerificationError extends Error {
  constructor(
    message: string,
    public readonly code: 'EXPIRED' | 'INVALID' | 'MALFORMED',
  ) {
    super(message);
    this.name = 'JwtVerificationError';
  }
}

/**
 * Verifies a JWT string and returns its decoded payload.
 * Throws JwtVerificationError with a typed code on failure.
 */
export function verifyToken(token: string, secret: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof decoded === 'string') {
      throw new JwtVerificationError('Unexpected string payload', 'MALFORMED');
    }
    const payload = decoded as JwtPayload;
    if (!payload.sub) {
      throw new JwtVerificationError('Token missing sub claim', 'MALFORMED');
    }
    return payload;
  } catch (err) {
    if (err instanceof JwtVerificationError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw new JwtVerificationError('Token has expired', 'EXPIRED');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new JwtVerificationError(`Invalid token: ${err.message}`, 'INVALID');
    }
    throw new JwtVerificationError('Token verification failed', 'INVALID');
  }
}

/**
 * Decodes a JWT without verifying its signature.
 * Used only for extracting metadata before verification (e.g., selecting the correct secret).
 */
export function decodeTokenUnsafe(token: string): JwtPayload | null {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === 'string') return null;
  return decoded as JwtPayload;
}
