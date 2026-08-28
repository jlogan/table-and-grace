import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  customerDisplayLabel,
  customerPreferredName,
  customerSearchText,
} from "@/lib/customer-names";
import {
  formatMembershipStatus,
  membershipStatusBadgeVariant,
  type AdminCustomerRow,
} from "@/orders/admin-types";
import { fetchAdminCustomers } from "@/orders/admin.functions.server";

export const Route = createFileRoute("/admin/customers/")({
  beforeLoad: async () => {
    const customers = await fetchAdminCustomers();
    return { customers };
  },
  head: () => ({
    meta: [{ title: "Customers — GOFOFA Ops" }],
  }),
  component: AdminCustomersPage,
});

type NameSort = "asc" | "desc";

function membershipSummary(customer: AdminCustomerRow): string {
  if (customer.membershipCount === 0) return "No memberships";
  const countLabel = `${customer.membershipCount} membership${customer.membershipCount === 1 ? "" : "s"}`;
  if (customer.activeMembershipCount > 0) {
    return `${countLabel} · ${customer.activeMembershipCount} active`;
  }
  return countLabel;
}

function SortableNameHeader({ sort, onToggle }: { sort: NameSort; onToggle: () => void }) {
  const Icon = sort === "asc" ? ArrowUp : sort === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      onClick={onToggle}
    >
      Customer
      <Icon className="size-3.5 text-muted-foreground" />
    </button>
  );
}

function AdminCustomersPage() {
  const { customers } = Route.useRouteContext();
  const [search, setSearch] = useState("");
  const [nameSort, setNameSort] = useState<NameSort>("asc");

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    let rows = customers;

    if (query) {
      rows = rows.filter((customer) => customerSearchText(customer).includes(query));
    }

    return [...rows].sort((a, b) => {
      const labelA = customerDisplayLabel(a).toLowerCase();
      const labelB = customerDisplayLabel(b).toLowerCase();
      const cmp = labelA.localeCompare(labelB);
      return nameSort === "asc" ? cmp : -cmp;
    });
  }, [customers, nameSort, search]);

  function toggleNameSort() {
    setNameSort((current) => (current === "asc" ? "desc" : "asc"));
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Customers</h2>
          <p className="text-sm text-muted-foreground">
            Customer accounts and profiles. Memberships are managed separately on the Memberships
            page.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/customers/new">Add customer</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <CardTitle className="text-base">All customers</CardTitle>
              <CardDescription>
                {filteredCustomers.length} of {customers.length} account(s)
              </CardDescription>
            </div>
            <div className="w-full max-w-sm">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, or phone…"
                aria-label="Search customers"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableNameHeader sort={nameSort} onToggle={toggleNameSort} />
                </TableHead>
                <TableHead>Memberships</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Orders</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    {customers.length === 0
                      ? "No customers yet — add a customer to get started."
                      : "No customers match your search."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <CustomerIndexRow key={customer.userId} customer={customer} />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function CustomerIndexRow({ customer }: { customer: AdminCustomerRow }) {
  const navigate = Route.useNavigate();
  const label = customerDisplayLabel(customer);
  const preferred = customerPreferredName(customer);

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() =>
        navigate({
          to: "/admin/customers/$customerId",
          params: { customerId: customer.userId },
        })
      }
    >
      <TableCell>
        <Link
          to="/admin/customers/$customerId"
          params={{ customerId: customer.userId }}
          className="font-medium text-primary underline-offset-4 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {label}
        </Link>
        {preferred && preferred !== label ? (
          <div className="text-xs text-muted-foreground">Preferred: {preferred}</div>
        ) : null}
        {!customer.firstName && !customer.lastName && customer.name ? (
          <div className="text-xs text-muted-foreground">Legacy name on file</div>
        ) : null}
        <div className="text-xs text-muted-foreground">
          Joined {format(parseISO(customer.createdAt), "MMM d, yyyy")}
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm">{membershipSummary(customer)}</div>
        {customer.primaryMembershipStatus ? (
          <Badge
            variant={membershipStatusBadgeVariant(customer.primaryMembershipStatus)}
            className="mt-1"
          >
            {formatMembershipStatus(customer.primaryMembershipStatus)}
          </Badge>
        ) : null}
      </TableCell>
      <TableCell>
        <div className="text-sm">{customer.email}</div>
        {customer.phone ? (
          <div className="text-xs text-muted-foreground">{customer.phone}</div>
        ) : null}
      </TableCell>
      <TableCell className="text-right tabular-nums">{customer.orderCount}</TableCell>
    </TableRow>
  );
}
