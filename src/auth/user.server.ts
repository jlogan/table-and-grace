import { eq } from "drizzle-orm";

import { getDb } from "@/db/index.server";
import { customerProfiles } from "@/db/schema/customer-profiles";
import type { UserRole as DbUserRole } from "@/db/schema/users";
import { users } from "@/db/schema/users";

import { readSessionTokenFromRequest, findSessionUserId } from "./session.server";
import type { CurrentUser } from "./types";

export type { CurrentUser } from "./types";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: "UNAUTHORIZED" | "FORBIDDEN" = "UNAUTHORIZED",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

async function loadUserById(userId: string): Promise<CurrentUser | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      phone: customerProfiles.phone,
    })
    .from(users)
    .leftJoin(customerProfiles, eq(customerProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) return null;
  return row;
}

/** Resolve the logged-in user from the session cookie, or null if anonymous. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = readSessionTokenFromRequest();
  if (!token) return null;

  const userId = await findSessionUserId(token);
  if (!userId) return null;

  return loadUserById(userId);
}

/** Require a logged-in user; throws AuthError when absent. */
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("Authentication required");
  }
  return user;
}

/** Require a logged-in user with one of the given roles. */
export async function requireRole(...roles: DbUserRole[]): Promise<CurrentUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new AuthError("Insufficient permissions", "FORBIDDEN");
  }
  return user;
}
