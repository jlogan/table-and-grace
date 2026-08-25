import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  FoodProfileReadOnlyView,
  PreviousFoodInformation,
} from "@/components/admin/customer-food-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateString } from "@/lib/dates";
import { customerFullName } from "@/lib/customer-names";
import type { AdminCustomerDetail, AdminCustomerLikedMenuItem } from "@/orders/admin-types";
import {
  fetchAdminCustomerDetail,
  fetchCustomerLikedMenuItems,
} from "@/orders/admin.functions.server";
import { centsToLabel, formatOrderStatus, orderStatusBadgeVariant } from "@/orders/review-types";

type MemberQuickViewSheetProps = {
  userId: string | null;
  memberLabel: string | null;
  onOpenChange: (open: boolean) => void;
};

export function MemberQuickViewSheet({
  userId,
  memberLabel,
  onOpenChange,
}: MemberQuickViewSheetProps) {
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

  const open = Boolean(userId);
  const displayName = customer ? customerFullName(customer) || customer.email : memberLabel;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{displayName ?? "Member profile"}</SheetTitle>
          <SheetDescription>
            Quick view for batch planning — preferences, orders, and liked items.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading profile…
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {customer && !loading ? (
          <div className="mt-4 space-y-6 pb-6">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </p>
                <p>{customer.email}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Birthday
                </p>
                <p>
                  {customer.birthday ? formatDateString(customer.birthday, "MMM d, yyyy") : "—"}
                </p>
              </div>
              {customer.phone ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Phone
                  </p>
                  <p>{customer.phone}</p>
                </div>
              ) : null}
              {customer.favoriteCake ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Favorite cake
                  </p>
                  <p>{customer.favoriteCake}</p>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Food preferences</p>
              <FoodProfileReadOnlyView customer={customer} />
              <PreviousFoodInformation customer={customer} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Liked items</p>
              {likedItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No order history yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {likedItems.map((item) => (
                    <li key={item.menuItemId} className="flex justify-between gap-4">
                      <span className="truncate">{item.menuItemName}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        ×{item.totalQty}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Previous orders</p>
              {customer.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customer.orders.slice(0, 8).map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          {order.batchWeekStart
                            ? formatDateString(order.batchWeekStart, "MMM d, yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={orderStatusBadgeVariant(order.status)}>
                            {formatOrderStatus(order.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {centsToLabel(order.totalCents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <Button variant="outline" asChild className="w-full">
              <Link to="/admin/customers/$customerId" params={{ customerId: customer.userId }}>
                Open full profile
              </Link>
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
