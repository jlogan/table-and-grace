/**
 * Stripe Customer.metadata keys mirrored between the app and Stripe.
 * Do not add environment routing keys (e.g. STRIPE_MODE, site=staging).
 */
export const STRIPE_CUSTOMER_METADATA_KEYS = {
  userId: "gofofa_user_id",
  preferredName: "preferred_name",
  phone: "phone",
  birthday: "birthday",
  favoriteCake: "favorite_cake",
} as const;

export type StripeCustomerMetadataKey =
  (typeof STRIPE_CUSTOMER_METADATA_KEYS)[keyof typeof STRIPE_CUSTOMER_METADATA_KEYS];

export type StripeCustomerMetadata = Partial<Record<StripeCustomerMetadataKey, string>>;

const FORBIDDEN_METADATA_KEYS = new Set(["STRIPE_MODE", "site"]);

export function sanitizeStripeCustomerMetadata(
  metadata: Record<string, string | undefined | null>,
): StripeCustomerMetadata {
  const sanitized: StripeCustomerMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (value == null || value === "") {
      continue;
    }
    if (FORBIDDEN_METADATA_KEYS.has(key)) {
      continue;
    }
    sanitized[key as StripeCustomerMetadataKey] = value;
  }

  return sanitized;
}

export function buildStripeCustomerMetadata(input: {
  userId: string;
  preferredName?: string | null;
  phone?: string | null;
  birthday?: string | null;
  favoriteCake?: string | null;
}): StripeCustomerMetadata {
  return sanitizeStripeCustomerMetadata({
    [STRIPE_CUSTOMER_METADATA_KEYS.userId]: input.userId,
    [STRIPE_CUSTOMER_METADATA_KEYS.preferredName]: input.preferredName ?? undefined,
    [STRIPE_CUSTOMER_METADATA_KEYS.phone]: input.phone ?? undefined,
    [STRIPE_CUSTOMER_METADATA_KEYS.birthday]: input.birthday ?? undefined,
    [STRIPE_CUSTOMER_METADATA_KEYS.favoriteCake]: input.favoriteCake ?? undefined,
  });
}

/** Full metadata payload for Stripe API calls (empty string clears a key). */
export function buildStripeCustomerMetadataPayload(input: {
  userId: string;
  preferredName?: string | null;
  phone?: string | null;
  birthday?: string | null;
  favoriteCake?: string | null;
}): Record<string, string> {
  const payload: Record<string, string> = {
    [STRIPE_CUSTOMER_METADATA_KEYS.userId]: input.userId,
    [STRIPE_CUSTOMER_METADATA_KEYS.preferredName]: input.preferredName?.trim() || "",
    [STRIPE_CUSTOMER_METADATA_KEYS.phone]: input.phone?.trim() || "",
    [STRIPE_CUSTOMER_METADATA_KEYS.birthday]: input.birthday?.trim() || "",
    [STRIPE_CUSTOMER_METADATA_KEYS.favoriteCake]: input.favoriteCake?.trim() || "",
  };

  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !FORBIDDEN_METADATA_KEYS.has(key)),
  );
}

/** Non-empty metadata for local profile storage after a successful push. */
export function storedStripeCustomerMetadata(
  metadata: Record<string, string>,
): Record<string, string> | null {
  const stored = sanitizeStripeCustomerMetadata(metadata);
  return Object.keys(stored).length > 0 ? stored : null;
}
