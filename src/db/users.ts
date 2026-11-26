import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';

const OWNER_ADMIN_EMAILS = new Set(
  [
    'thixdigosemgamer@gmail.com',
    ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : []),
  ]
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string
) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);

    if (existing.length > 0) {
      const user = existing[0];
      const shouldPromoteOwner =
        OWNER_ADMIN_EMAILS.has(normalizedEmail) && user.role !== 'admin';
      if (shouldPromoteOwner || (displayName && displayName !== user.displayName)) {
        const updated = await db
          .update(users)
          .set({
            email: normalizedEmail,
            displayName: displayName ?? user.displayName,
            role: shouldPromoteOwner ? 'admin' : user.role,
          })
          .where(eq(users.uid, uid))
          .returning();
        return updated[0];
      }
      return user;
    }

    const adminCountRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, 'admin'));
    const hasAdmin = (adminCountRes[0]?.count ?? 0) > 0;
    const isAdmin = OWNER_ADMIN_EMAILS.has(normalizedEmail) || !hasAdmin;

    const result = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        displayName: displayName || normalizedEmail.split('@')[0],
        role: isAdmin ? 'admin' : 'user',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
          displayName: displayName || normalizedEmail.split('@')[0],
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Failed to get or create user:', error);
    throw new Error('Falha ao sincronizar usuário no banco de dados.', {
      cause: error,
    });
  }
}
