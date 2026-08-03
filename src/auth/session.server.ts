import { randomUUID } from "node:crypto";

import { and, eq, gt } from "drizzle-orm";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";

import { getDb } from "@/db/index.server";
import { sessions } from "@/db/schema/sessions";
import { getServerEnv } from "@/env.server";

import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "./constants.server";
import { generateSecureToken, hashToken } from "./token.server";

function parseCookieHeader(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    if (part.slice(0, eqIndex) === name) {
      return decodeURIComponent(part.slice(eqIndex + 1));
    }
  }
  return null;
}

function sessionCookieFlags(maxAgeSeconds: number, value: string): string {
  const env = getServerEnv();
  const isSecure = env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isSecure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function readSessionTokenFromRequest(): string | null {
  return parseCookieHeader(getRequestHeader("cookie"), SESSION_COOKIE_NAME);
}

export function setSessionCookie(token: string): void {
  const maxAgeSeconds = Math.floor(SESSION_DURATION_MS / 1000);
  setResponseHeader("Set-Cookie", sessionCookieFlags(maxAgeSeconds, token));
}

export function clearSessionCookie(): void {
  setResponseHeader("Set-Cookie", sessionCookieFlags(0, ""));
}

export async function createSession(userId: string): Promise<string> {
  const db = getDb();
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({
    id: randomUUID(),
    userId,
    tokenHash,
    expiresAt,
  });

  return token;
}

export async function revokeSessionByToken(token: string): Promise<void> {
  const db = getDb();
  const tokenHash = hashToken(token);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function findSessionUserId(token: string): Promise<string | null> {
  const db = getDb();
  const tokenHash = hashToken(token);
  const now = new Date();

  const [row] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  return row?.userId ?? null;
}
