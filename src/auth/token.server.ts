import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Generate a URL-safe opaque token (sessions, magic links, action tokens). */
export function generateSecureToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

/** SHA-256 hash for storing tokens — never persist raw tokens. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison of a raw token against a stored hash. */
export function verifyTokenHash(token: string, tokenHash: string): boolean {
  const candidate = hashToken(token);
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(tokenHash, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
