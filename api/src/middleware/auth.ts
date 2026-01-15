import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user?: JWTPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

/**
 * Verify JWT token and attach user to request
 */
export async function authenticateToken(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    reply.code(401).send({
      ok: false,
      error: 'No authorization header provided'
    });
    return;
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    request.user = decoded;
  } catch (error) {
    reply.code(401).send({
      ok: false,
      error: 'Invalid or expired token'
    });
    return;
  }
}

/**
 * Generate JWT token for user
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d'
  });
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuth(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return;
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    request.user = decoded;
  } catch (error) {
    // Silently fail for optional auth
    return;
  }
}
