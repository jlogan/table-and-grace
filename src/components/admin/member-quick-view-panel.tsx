import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import {
  FoodProfileReadOnlyView,
  PreviousFoodInformation,
} from "@/components/admin/customer-food-profile";
import { useMemberQuickViewData } from "@/components/admin/use-member-quick-view-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { centsToLabel, formatOrderStatus, orderStatusBadgeVariant } from "@/orders/review-types";

type MemberQuickViewPanelProps = {
  userId: string | null;
  memberLabel: string | null;
  compact?: boolean;
};

export function MemberQuickViewPanel({
  userId,
  memberLabel,
  compact = false,
}: MemberQuickViewPanelProps) {
  const { customer, likedItems, loading, error } = useMemberQuickViewData(userId);

  if (!userId) {
    return (
      <div className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
        Select a member to view profile, preferences, and order history.
      </div>
    );
  }

  const displayName = customer ? customerFullName(customer) || customer.email : memberLabel;

  return (
    <div className="rounded-md border border-border bg-muted/20">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{displayName ?? "Member profile"}</p>
        <p className="text-xs text-muted-foreground">
          Preferences, past orders, and liked items for order-building.
        </p>
      </div>

      <div className={compact ? "max-h-[420px] space-y-4 overflow-y-auto p-4" : "space-y-4 p-4"}>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading profile…
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {customer && !loading ? (
          <>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </p>
                <p className="truncate">{customer.email}</p>
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
                  {likedItems.slice(0, compact ? 5 : 8).map((item) => (
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
                    {customer.orders.slice(0, compact ? 4 : 8).map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="text-xs">
                          {order.batchWeekStart
                            ? formatDateString(order.batchWeekStart, "MMM d, yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={orderStatusBadgeVariant(order.status)}>
                            {formatOrderStatus(order.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {centsToLabel(order.totalCents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <Button variant="outline" size="sm" asChild className="w-full">
              <Link to="/admin/customers/$customerId" params={{ customerId: customer.userId }}>
                Open full profile
              </Link>
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
