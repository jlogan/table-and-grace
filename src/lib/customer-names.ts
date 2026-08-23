/** Structured + legacy name fields on a customer user row. */
export type CustomerNameFields = {
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  /** Legacy single-field name; preserved until Phase 2B backfill. */
  name?: string | null;
};

function trim(value: string | null | undefined): string | null {
  const next = value?.trim();
  return next ? next : null;
}

/** First + last when both present; otherwise legacy `name`. */
export function customerFullName(fields: CustomerNameFields): string | null {
  const first = trim(fields.firstName);
  const last = trim(fields.lastName);
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  return trim(fields.name);
}

/** Preferred name when set; omitted from display when absent. */
export function customerPreferredName(fields: CustomerNameFields): string | null {
  return trim(fields.preferredName);
}

/** Primary label for lists: full name, preferred name, or email fallback. */
export function customerDisplayLabel(fields: CustomerNameFields & { email: string }): string {
  return customerFullName(fields) ?? customerPreferredName(fields) ?? fields.email;
}

/** Lowercase search haystack for client-side customer filtering. */
export function customerSearchText(
  fields: CustomerNameFields & { email: string; phone?: string | null },
): string {
  return [
    fields.firstName,
    fields.lastName,
    fields.preferredName,
    fields.name,
    fields.email,
    fields.phone,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
