import { createHash } from "node:crypto";

export type CatalogEntity = "plan_category" | "menu_item" | "pickup_window";

const CATALOG_NAMESPACE = "table-and-grace-gofofa-catalog-v1";

/** Deterministic UUID (v4-shaped) for catalog entities — stable across seed runs. */
export function catalogUuid(entity: CatalogEntity, slug: string): string {
  const hash = createHash("sha256").update(`${CATALOG_NAMESPACE}:${entity}:${slug}`).digest("hex");
  const variant = ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `${variant}${hash.slice(18, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

export function planCategoryId(slug: string): string {
  return catalogUuid("plan_category", slug);
}

export function menuItemId(slug: string): string {
  return catalogUuid("menu_item", slug);
}

export function pickupWindowId(slug: string): string {
  return catalogUuid("pickup_window", slug);
}
