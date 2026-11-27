import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { hasDatabaseConfig } from '../db/index.ts';
import { getOrCreateUser } from '../db/users.ts';
import { getOrCreateMemoryUser } from '../server/memoryStore.ts';

export interface DbUser {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
  role: string;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: DbUser;
}

async function resolveDbUser(
  uid: string,
  email: string,
  displayName?: string
): Promise<DbUser> {
  if (!hasDatabaseConfig) {
    return getOrCreateMemoryUser(uid, email, displayName);
  }
  return getOrCreateUser(uid, email, displayName);
}

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    req.dbUser = await resolveDbUser(
      decoded.uid,
      decoded.email || `${decoded.uid}@user.local`,
      decoded.name
    );
  } catch (error) {
    console.warn('Optional auth token invalid or expired:', error);
  }
  next();
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    req.dbUser = await resolveDbUser(
      decoded.uid,
      decoded.email || `${decoded.uid}@user.local`,
      decoded.name
    );
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  await requireAuth(req, res, () => {
    if (!req.dbUser || req.dbUser.role !== 'admin') {
      return res
        .status(403)
        .json({ error: 'Acesso restrito a administradores.' });
    }
    next();
  });
};
