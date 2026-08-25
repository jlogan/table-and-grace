import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import type { AdminCustomerDetail, AdminCustomerLikedMenuItem } from "@/orders/admin-types";
import {
  fetchAdminCustomerDetail,
  fetchCustomerLikedMenuItems,
} from "@/orders/admin.functions.server";

export function useMemberQuickViewData(userId: string | null) {
  const detailFn = useServerFn(fetchAdminCustomerDetail);
  const likedFn = useServerFn(fetchCustomerLikedMenuItems);
  const [customer, setCustomer] = useState<AdminCustomerDetail | null>(null);
  const [likedItems, setLikedItems] = useState<AdminCustomerLikedMenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setCustomer(null);
      setLikedItems([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([detailFn({ data: { userId } }), likedFn({ data: { userId } })])
      .then(([detail, liked]) => {
        if (cancelled) return;
        setCustomer(detail);
        setLikedItems(liked);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load member profile.");
        setCustomer(null);
        setLikedItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detailFn, likedFn, userId]);

  return { customer, likedItems, loading, error };
}
