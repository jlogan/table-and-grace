/** Client-safe auth types (no server imports). */
export type UserRole = "customer" | "admin";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  phone: string | null;
};
