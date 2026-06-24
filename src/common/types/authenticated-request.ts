import { Request } from 'express';
import { JwtPayload } from 'src/auth/jwt.strategy';

/**
 * Express request enriched with the JWT payload by {@link JwtAuthGuard}.
 * `user.sub` is the authenticated user id.
 */
export type AuthenticatedRequest = Request & { user: JwtPayload };
