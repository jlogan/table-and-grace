import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { format, parseISO } from "date-fns";
import { Pencil, Printer } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FoodProfileEditFields,
  FoodProfileReadOnlyView,
  PreviousFoodInformation,
} from "@/components/admin/customer-food-profile";
import {
  foodProfileFormStateFromCustomer,
  hasPreviousFoodInformation,
  type FoodProfileFormState,
} from "@/lib/customer-food-profile-form";
import type { AdminCustomerDetail } from "@/orders/admin-types";
import { cn } from "@/lib/utils";
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

type ProfileFormState = {
  email: string;
  firstName: string;
  lastName: string;
  preferredName: string;
  phone: string;
  birthday: string;
  favoriteCake: string;
  foodProfile: FoodProfileFormState;
};

function formStateFromCustomer(customer: AdminCustomerDetail): ProfileFormState {
  return {
    email: customer.email,
    firstName: customer.firstName ?? "",
    lastName: customer.lastName ?? "",
    preferredName: customer.preferredName ?? "",
    phone: customer.phone ?? "",
    birthday: customer.birthday ?? "",
    favoriteCake: customer.favoriteCake ?? "",
    foodProfile: foodProfileFormStateFromCustomer(customer),
  };
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function foodProfileFormsEqual(a: FoodProfileFormState, b: FoodProfileFormState): boolean {
  return (
    a.portionDefault === b.portionDefault &&
    arraysEqual(a.dietaryPreferences, b.dietaryPreferences) &&
    a.dietaryPreferenceOther === b.dietaryPreferenceOther &&
    arraysEqual(a.foodAllergens, b.foodAllergens) &&
    a.foodAllergenOther === b.foodAllergenOther &&
    a.chefNotes === b.chefNotes
  );
}

function profileFormsEqual(a: ProfileFormState, b: ProfileFormState): boolean {
  return (
    a.email === b.email &&
    a.firstName === b.firstName &&
    a.lastName === b.lastName &&
    a.preferredName === b.preferredName &&
    a.phone === b.phone &&
    a.birthday === b.birthday &&
    a.favoriteCake === b.favoriteCake &&
    foodProfileFormsEqual(a.foodProfile, b.foodProfile)
  );
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

function ReadOnlyField({ label, value }: { label: string; value: string | null | undefined }) {
  const display = value?.trim() ? value : "—";
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{display}</dd>
    </div>
  );
}

function CustomerProfileAvatar({
  customer,
  className,
}: {
  customer: AdminCustomerDetail;
  className?: string;
}) {
  const initials = initialsFromCustomer(customer);
  return (
    <Avatar
      className={cn(
        "size-20 shrink-0 ring-2 ring-border ring-offset-2 ring-offset-background",
        className,
      )}
    >
      {customer.profilePhotoUrl ? (
        <AvatarImage src={customer.profilePhotoUrl} alt="" className="object-cover" />
      ) : null}
      <AvatarFallback className="bg-gradient-to-br from-muted to-muted/60 text-lg font-semibold text-muted-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

function AdminCustomerProfilePage() {
  const { customer: initialCustomer } = Route.useRouteContext();
  const updateFn = useServerFn(updateAdminCustomerProfile);
  const refreshFn = useServerFn(fetchAdminCustomerDetail);
  const { customerId } = Route.useParams();

  const [customer, setCustomer] = useState(initialCustomer);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<ProfileFormState>(() => formStateFromCustomer(initialCustomer));
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

  const savedForm = useMemo(() => formStateFromCustomer(customer), [customer]);

  const isDirty = useMemo(() => !profileFormsEqual(form, savedForm), [form, savedForm]);

  function startEditing() {
    setForm(formStateFromCustomer(customer));
    setError(null);
    setMessage(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setForm(formStateFromCustomer(customer));
    setError(null);
    setMessage(null);
    setIsEditing(false);
  }

  function preventEnterSubmitInProfileFields(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter") return;
    if (!(e.target instanceof HTMLInputElement)) return;
    const type = e.target.type.toLowerCase();
    if (type === "text" || type === "email" || type === "tel" || type === "date") {
      e.preventDefault();
    }
  }

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    if (!isEditing || !isDirty) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateFn({
        data: {
          userId: customerId,
          email: form.email.trim().toLowerCase(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          preferredName: form.preferredName.trim() || null,
          phone: form.phone.trim() || null,
          birthday: form.birthday || null,
          favoriteCake: form.favoriteCake.trim() || null,
          portionDefault: form.foodProfile.portionDefault,
          dietaryPreferences: form.foodProfile.dietaryPreferences,
          dietaryPreferenceOther: form.foodProfile.dietaryPreferences.includes("other")
            ? form.foodProfile.dietaryPreferenceOther.trim() || null
            : null,
          foodAllergens: form.foodProfile.foodAllergens,
          foodAllergenOther: form.foodProfile.foodAllergens.includes("other")
            ? form.foodProfile.foodAllergenOther.trim() || null
            : null,
          chefNotes: form.foodProfile.chefNotes.trim() || null,
        },
      });
      const next = await refreshFn({ data: { userId: customerId } });
      setCustomer(next);
      setForm(formStateFromCustomer(next));
      setIsEditing(false);
      setMessage("Customer updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save customer.");
    } finally {
      setSaving(false);
    }
  }

  const headerMeta = (
    <dl className="mt-2 space-y-1 text-sm text-muted-foreground">
      {displayPreferred ? (
        <div>
          <dt className="sr-only">Preferred name</dt>
          <dd>Preferred name: {displayPreferred}</dd>
        </div>
      ) : null}
      <div>
        <dt className="sr-only">Email</dt>
        <dd>{customer.email}</dd>
      </div>
      <div>
        <dt className="sr-only">Phone</dt>
        <dd>{customer.phone?.trim() || "—"}</dd>
      </div>
      <div>
        <dt className="sr-only">Birthday</dt>
        <dd>{customer.birthday ? formatDateString(customer.birthday, "MMM d, yyyy") : "—"}</dd>
      </div>
      <div>
        <dt className="sr-only">Joined</dt>
        <dd>Joined {format(parseISO(customer.createdAt), "MMM d, yyyy")}</dd>
      </div>
    </dl>
  );

  const headerActions = (
    <div className="flex flex-wrap gap-2 no-print">
      {isEditing ? (
        <>
          <Button type="button" disabled={saving || !isDirty} onClick={() => void handleSave()}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={cancelEditing} disabled={saving}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <Button type="button" onClick={startEditing}>
            <Pencil className="mr-2 size-4" />
            Edit Profile
          </Button>
          <Button asChild>
            <Link to="/admin/memberships" search={{ userId: customerId, add: "1" }}>
              Add Membership
            </Link>
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 size-4" />
            Print Profile
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/customers">Back to Customers</Link>
          </Button>
        </>
      )}
    </div>
  );

  const editForm = (
    <form
      id="customer-profile-form"
      onSubmit={(e) => {
        e.preventDefault();
      }}
      onKeyDown={preventEnterSubmitInProfileFields}
      className={cn("customer-profile-edit space-y-6", !isEditing && "hidden")}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Details</CardTitle>
          <CardDescription>Identity and contact information for this customer.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-first-name">First name</Label>
            <Input
              id="profile-first-name"
              value={form.firstName}
              onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-last-name">Last name</Label>
            <Input
              id="profile-last-name"
              value={form.lastName}
              onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-preferred-name">Preferred name</Label>
            <Input
              id="profile-preferred-name"
              value={form.preferredName}
              onChange={(e) => setForm((prev) => ({ ...prev, preferredName: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">Phone</Label>
            <Input
              id="profile-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-birthday">Birthday</Label>
            <Input
              id="profile-birthday"
              type="date"
              value={form.birthday}
              onChange={(e) => setForm((prev) => ({ ...prev, birthday: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-favorite-cake">Favorite cake</Label>
            <Input
              id="profile-favorite-cake"
              value={form.favoriteCake}
              onChange={(e) => setForm((prev) => ({ ...prev, favoriteCake: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Food Profile</CardTitle>
          <CardDescription>Kitchen preferences for this customer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {hasPreviousFoodInformation(customer) ? (
            <PreviousFoodInformation customer={customer} />
          ) : null}
          <FoodProfileEditFields
            form={form.foodProfile}
            onChange={(foodProfile) => setForm((prev) => ({ ...prev, foodProfile }))}
          />
        </CardContent>
      </Card>
    </form>
  );

  const readOnlySections = (
    <div className={cn("customer-profile-readonly space-y-6", isEditing && "hidden print:block")}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ReadOnlyField label="First name" value={customer.firstName} />
            <ReadOnlyField label="Last name" value={customer.lastName} />
            <ReadOnlyField label="Preferred name" value={customer.preferredName} />
            <ReadOnlyField label="Email" value={customer.email} />
            <ReadOnlyField label="Phone" value={customer.phone} />
            <ReadOnlyField
              label="Birthday"
              value={customer.birthday ? formatDateString(customer.birthday, "MMM d, yyyy") : null}
            />
            <ReadOnlyField label="Favorite cake" value={customer.favoriteCake} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Food Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <FoodProfileReadOnlyView customer={customer} />
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="customer-profile-print space-y-6">
      <div className="customer-profile-header flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <CustomerProfileAvatar customer={customer} />
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {displayFullName ?? customer.email}
            </h2>
            {headerMeta}
          </div>
        </div>
        {headerActions}
      </div>

      {error ? <p className="text-sm text-destructive no-print">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground no-print">{message}</p> : null}

      {editForm}
      {readOnlySections}

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
              <Link to="/admin/memberships" search={{ userId: customerId, add: "1" }}>
                Add Membership
              </Link>
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
                        <Link
                          to="/admin/memberships"
                          search={{ userId: undefined, add: undefined }}
                        >
                          View
                        </Link>
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
          <CardTitle className="text-base">Order History</CardTitle>
          <CardDescription>Weekly order history for this customer.</CardDescription>
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
