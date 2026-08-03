import { createMiddleware } from "@tanstack/react-start";

import type { UserRole } from "@/db/schema/users";

import { AuthError, getCurrentUser, requireRole } from "./user.server";

/** Attach the current user to server-function context (null when logged out). */
export const sessionMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const user = await getCurrentUser();
  return next({ context: { user } });
});

/** Require authentication on a server function. */
export const requireAuthMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const user = await getCurrentUser();
    if (!user) {
      throw new AuthError("Authentication required");
    }
    return next({ context: { user } });
  },
);

/** Require one of the given roles on a server function. */
export function requireRoleMiddleware(...roles: UserRole[]) {
  return createMiddleware({ type: "function" }).server(async ({ next }) => {
    const user = await requireRole(...roles);
    return next({ context: { user } });
  });
}
