import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { format, parseISO } from "date-fns";
import { Printer } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { PortionDefault } from "@/db/schema/customer-profiles";
import { formatDateString } from "@/lib/dates";
import { customerFullName, customerPreferredName } from "@/lib/customer-names";
import { formatMembershipStatus, membershipStatusBadgeVariant } from "@/orders/admin-types";
import {
  fetchAdminCustomerDetail,
  updateAdminCustomerProfile,
} from "@/orders/admin.functions.server";
import {
  centsToLabel,
  formatOrderStatus,
  formatPaymentSchedule,
  orderStatusBadgeVariant,
} from "@/orders/review-types";

export const Route = createFileRoute("/admin/customers/$customerId")({
  beforeLoad: async ({ params }) => {
    const customer = await fetchAdminCustomerDetail({ data: { userId: params.customerId } });
    if (!customer) {
      throw redirect({ to: "/admin/customers" });
    }
    return { customer };
  },
  head: () => ({
    meta: [{ title: "Customer Profile — GOFOFA Ops" }],
  }),
  component: AdminCustomerProfilePage,
});

function formatDietaryTagsInput(tags: string[]): string {
  return tags.join(", ");
}

function parseDietaryTagsInput(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of value.split(",")) {
    const tag = part.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result;
}

function initialsFromCustomer(customer: {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string;
}): string {
  const full = customerFullName(customer);
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
    }
    return (parts[0]?.slice(0, 2) ?? "??").toUpperCase();
  }
  return customer.email.slice(0, 2).toUpperCase();
}

function AdminCustomerProfilePage() {
  const { customer: initialCustomer } = Route.useRouteContext();
  const updateFn = useServerFn(updateAdminCustomerProfile);
  const refreshFn = useServerFn(fetchAdminCustomerDetail);
  const { customerId } = Route.useParams();

  const [customer, setCustomer] = useState(initialCustomer);
  const [email, setEmail] = useState(customer.email);
  const [firstName, setFirstName] = useState(customer.firstName ?? "");
  const [lastName, setLastName] = useState(customer.lastName ?? "");
  const [preferredName, setPreferredName] = useState(customer.preferredName ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [birthday, setBirthday] = useState(customer.birthday ?? "");
  const [favoriteCake, setFavoriteCake] = useState(customer.favoriteCake ?? "");
  const [portionDefault, setPortionDefault] = useState<PortionDefault>(customer.portionDefault);
  const [dietaryTagsInput, setDietaryTagsInput] = useState(
    formatDietaryTagsInput(customer.dietaryTags),
  );
  const [allergies, setAllergies] = useState(customer.allergies ?? "");
  const [chefNotes, setChefNotes] = useState(customer.chefNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const displayFullName = useMemo(
    () =>
      customerFullName({
        firstName: customer.firstName,
        lastName: customer.lastName,
        name: customer.name,
      }),
    [customer],
  );
  const displayPreferred = useMemo(
    () => customerPreferredName({ preferredName: customer.preferredName }),
    [customer.preferredName],
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateFn({
        data: {
          userId: customerId,
          email: email.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          preferredName: preferredName.trim() || null,
          phone: phone.trim() || null,
          birthday: birthday || null,
          favoriteCake: favoriteCake.trim() || null,
          portionDefault,
          dietaryTags: parseDietaryTagsInput(dietaryTagsInput),
          allergies: allergies.trim() || null,
          chefNotes: chefNotes.trim() || null,
        },
      });
      const next = await refreshFn({ data: { userId: customerId } });
      setCustomer(next);
      setMessage("Customer updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="customer-profile-print space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="text-base">{initialsFromCustomer(customer)}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {displayFullName ?? customer.email}
            </h2>
            {displayPreferred ? (
              <p className="text-sm text-muted-foreground">Preferred name: {displayPreferred}</p>
            ) : null}
            {!displayFullName && customer.name ? (
              <p className="text-sm text-muted-foreground">Legacy name: {customer.name}</p>
            ) : null}
            <p className="text-sm text-muted-foreground">{customer.email}</p>
            {customer.hasProfilePhoto ? (
              <p className="text-xs text-muted-foreground">Profile photo on file</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Joined {format(parseISO(customer.createdAt), "MMM d, yyyy")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <Button asChild>
            <Link to="/admin/memberships">Add Membership / View Memberships</Link>
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 size-4" />
            Print
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/customers">Back to customers</Link>
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Identity and kitchen preferences for this customer.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-first-name">First name</Label>
              <Input
                id="profile-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-last-name">Last name</Label>
              <Input
                id="profile-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-preferred-name">Preferred name</Label>
              <Input
                id="profile-preferred-name"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">Phone</Label>
              <Input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-birthday">Birthday</Label>
              <Input
                id="profile-birthday"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-favorite-cake">Favorite cake</Label>
              <Input
                id="profile-favorite-cake"
                value={favoriteCake}
                onChange={(e) => setFavoriteCake(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-portion">Default portion</Label>
              <Select
                value={portionDefault}
                onValueChange={(v) => setPortionDefault(v as PortionDefault)}
              >
                <SelectTrigger id="profile-portion">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4oz">4 oz</SelectItem>
                  <SelectItem value="6oz">6 oz</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="profile-chef-notes">Chef notes</Label>
              <Textarea
                id="profile-chef-notes"
                value={chefNotes}
                onChange={(e) => setChefNotes(e.target.value)}
                rows={8}
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="profile-dietary-tags">Dietary tags</Label>
                <Badge variant="outline">Legacy — Phase 2B</Badge>
              </div>
              <Input
                id="profile-dietary-tags"
                value={dietaryTagsInput}
                onChange={(e) => setDietaryTagsInput(e.target.value)}
                placeholder="gluten-free, low-sodium"
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="profile-allergies">Allergies</Label>
                <Badge variant="outline">Legacy — Phase 2B</Badge>
              </div>
              <Textarea
                id="profile-allergies"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                rows={3}
              />
            </div>
            <div className="no-print sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Memberships</CardTitle>
              <CardDescription>
                All memberships for this customer. Manage plans and billing on the Memberships page.
              </CardDescription>
            </div>
            <Button variant="outline" asChild className="no-print">
              <Link to="/admin/memberships">Add Membership / View Memberships</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Meals / week</TableHead>
                <TableHead>Portion</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead className="no-print w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {customer.memberships.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No memberships yet.
                  </TableCell>
                </TableRow>
              ) : (
                customer.memberships.map((membership) => (
                  <TableRow key={membership.membershipId}>
                    <TableCell>
                      <Badge variant={membershipStatusBadgeVariant(membership.membershipStatus)}>
                        {formatMembershipStatus(
                          membership.membershipStatus,
                          membership.pausedUntil,
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>{membership.planName ?? "—"}</TableCell>
                    <TableCell>{membership.mealsPerWeek ?? "—"}</TableCell>
                    <TableCell>{membership.portionDefault}</TableCell>
                    <TableCell>{formatPaymentSchedule(membership.paymentSchedule)}</TableCell>
                    <TableCell className="no-print">
                      <Button size="sm" variant="ghost" asChild>
                        <Link to="/admin/memberships">View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order history</CardTitle>
          <CardDescription>
            Weekly orders for this customer, including legacy orders without a membership.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customer.orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No orders yet.
                  </TableCell>
                </TableRow>
              ) : (
                customer.orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{formatDateString(order.batchWeekStart, "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant={orderStatusBadgeVariant(order.status)}>
                        {formatOrderStatus(order.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{order.planName ?? (order.membershipId ? "—" : "Legacy")}</TableCell>
                    <TableCell>{formatPaymentSchedule(order.paymentSchedule)}</TableCell>
                    <TableCell className="text-right tabular-nums">{order.itemCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {centsToLabel(order.totalCents)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
