import { randomUUID } from "node:crypto";

import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/index.server";
import { customerProfiles } from "@/db/schema/customer-profiles";
import { users } from "@/db/schema/users";

import { getDummyPasswordHash, hashPassword, verifyPassword } from "./password.server";
import {
  clearSessionCookie,
  createSession,
  readSessionTokenFromRequest,
  revokeAllSessionsForUser,
  revokeSessionByToken,
  setSessionCookie,
} from "./session.server";
import type { CurrentUser } from "./types";
import { getCurrentUser } from "./user.server";

const emailSchema = z.string().trim().email().max(255);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(128);
const nameSchema = z.string().trim().min(1).max(255).optional();

const signupInput = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
});

const loginInput = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const fetchCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> => {
    return getCurrentUser();
  },
);

export const signupWithPassword = createServerFn({ method: "POST" })
  .validator(signupInput)
  .handler(async ({ data }) => {
    const db = getDb();
    const email = data.email.toLowerCase();

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      throw new Error("An account with this email already exists. Try logging in instead.");
    }

    const userId = randomUUID();
    const passwordHash = await hashPassword(data.password);

    await db.insert(users).values({
      id: userId,
      email,
      passwordHash,
      name: data.name ?? null,
      role: "customer",
    });

    await db.insert(customerProfiles).values({ userId });

    await revokeAllSessionsForUser(userId);
    const token = await createSession(userId);
    setSessionCookie(token);

    const user: CurrentUser = {
      id: userId,
      email,
      name: data.name ?? null,
      role: "customer",
      phone: null,
    };

    return { user };
  });

export const loginWithPassword = createServerFn({ method: "POST" })
  .validator(loginInput)
  .handler(async ({ data }) => {
    const db = getDb();
    const email = data.email.toLowerCase();

    const [userRow] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        phone: customerProfiles.phone,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .leftJoin(customerProfiles, eq(customerProfiles.userId, users.id))
      .where(eq(users.email, email))
      .limit(1);

    const hashToCheck = userRow?.passwordHash ?? (await getDummyPasswordHash());
    const passwordMatches = await verifyPassword(data.password, hashToCheck);
    const ok = userRow != null && userRow.passwordHash != null && passwordMatches;

    if (!ok) {
      throw new Error("Invalid email or password.");
    }

    await revokeAllSessionsForUser(userRow.id);
    const token = await createSession(userRow.id);
    setSessionCookie(token);

    const user: CurrentUser = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role,
      phone: userRow.phone,
    };

    return { user };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const token = readSessionTokenFromRequest();
  if (token) {
    await revokeSessionByToken(token);
  }
  clearSessionCookie();
  return { ok: true as const };
});
