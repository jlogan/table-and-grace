/**
 * Stripe Customer.metadata keys mirrored between the app and Stripe.
 * Do not add environment routing keys (e.g. STRIPE_MODE, site=staging).
 */
export const STRIPE_CUSTOMER_METADATA_KEYS = {
  userId: "gofofa_user_id",
  preferredName: "preferred_name",
  phone: "phone",
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
}): StripeCustomerMetadata {
  return sanitizeStripeCustomerMetadata({
    [STRIPE_CUSTOMER_METADATA_KEYS.userId]: input.userId,
    [STRIPE_CUSTOMER_METADATA_KEYS.preferredName]: input.preferredName ?? undefined,
    [STRIPE_CUSTOMER_METADATA_KEYS.phone]: input.phone ?? undefined,
  });
}
