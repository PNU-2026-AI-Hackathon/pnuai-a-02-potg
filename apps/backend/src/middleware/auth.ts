import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AccountType } from '@prisma/client';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Environment variable JWT_SECRET is required and must not be empty.');
}
const REQUIRED_JWT_SECRET: string = JWT_SECRET;

export const USER_ROLES = {
  RESIDENT: AccountType.RESIDENT,
  LIBRARIAN: AccountType.LIBRARIAN,
  ADMIN: AccountType.ADMIN,
} as const;

export type UserRole = AccountType;

export type AuthenticatedUser = {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  accountType: UserRole;
};

type AuthTokenPayload = jwt.JwtPayload & {
  sub?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function getBearerToken(req: Request) {
  const authorization = req.header('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim() || null;
}

export function sendAuthenticationError(res: Response, error = 'Authentication required.') {
  return res.status(401).json({
    code: 'AUTHENTICATION_REQUIRED',
    error,
  });
}

export function sendAuthorizationError(res: Response, error = 'You do not have permission to access this resource.') {
  return res.status(403).json({
    code: 'FORBIDDEN',
    error,
  });
}

export async function authenticateJwt(req: Request, res: Response, next: NextFunction) {
  const token = getBearerToken(req);

  if (!token) {
    return sendAuthenticationError(res);
  }

  try {
    const payload = jwt.verify(token, REQUIRED_JWT_SECRET) as AuthTokenPayload;

    if (typeof payload.sub !== 'string') {
      return sendAuthenticationError(res, 'Invalid token.');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        userId: true,
        name: true,
        email: true,
        accountType: true,
      },
    });

    if (!user) {
      return sendAuthenticationError(res, 'User not found.');
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return sendAuthenticationError(res, 'Invalid or expired token.');
    }

    console.error('JWT authentication failed:', error);
    return res.status(500).json({
      code: 'AUTHENTICATION_FAILED',
      error: 'Unable to authenticate request.',
    });
  }
}

export async function authenticateOptionalJwt(req: Request, res: Response, next: NextFunction) {
  if (!getBearerToken(req)) {
    return next();
  }

  return authenticateJwt(req, res, next);
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendAuthenticationError(res);
    }

    if (!allowedRoles.includes(req.user.accountType)) {
      return sendAuthorizationError(res);
    }

    return next();
  };
}

export const requireStaffRole = requireRoles(USER_ROLES.LIBRARIAN, USER_ROLES.ADMIN);
