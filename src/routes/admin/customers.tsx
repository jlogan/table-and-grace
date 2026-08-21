import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { format, parseISO } from "date-fns";
import { useState } from "react";

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
import {
  formatMembershipStatus,
  membershipStatusBadgeVariant,
  type AdminCustomerRow,
} from "@/orders/admin-types";
import {
  createAdminCustomerAccount,
  fetchAdminCustomers,
  fetchAdminPickupWindows,
  updateAdminCustomerProfile,
} from "@/orders/admin.functions.server";
import { formatPaymentSchedule } from "@/orders/review-types";

export const Route = createFileRoute("/admin/customers")({
  beforeLoad: async () => {
    const [customers, pickupWindows] = await Promise.all([
      fetchAdminCustomers(),
      fetchAdminPickupWindows(),
    ]);
    return { customers, pickupWindows };
  },
  head: () => ({
    meta: [{ title: "Customers — GOFOFA Ops" }],
  }),
  component: AdminCustomersPage,
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

function AdminCustomersPage() {
  const { customers: initialCustomers, pickupWindows } = Route.useRouteContext();
  const createFn = useServerFn(createAdminCustomerAccount);
  const updateFn = useServerFn(updateAdminCustomerProfile);
  const refreshFn = useServerFn(fetchAdminCustomers);

  const [customers, setCustomers] = useState(initialCustomers);
  const [showAddForm, setShowAddForm] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [portionDefault, setPortionDefault] = useState<PortionDefault>("6oz");
  const [pickupWindowId, setPickupWindowId] = useState(pickupWindows[0]?.id ?? "");
  const [dietaryTagsInput, setDietaryTagsInput] = useState("");
  const [allergies, setAllergies] = useState("");
  const [chefNotes, setChefNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function refreshCustomers() {
    const next = await refreshFn();
    setCustomers(next);
  }

  function resetCreateForm() {
    setEmail("");
    setName("");
    setPhone("");
    setPortionDefault("6oz");
    setPickupWindowId(pickupWindows[0]?.id ?? "");
    setDietaryTagsInput("");
    setAllergies("");
    setChefNotes("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await createFn({
        data: {
          email: normalizedEmail,
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          allergies: allergies.trim() || undefined,
          dietaryTags: parseDietaryTagsInput(dietaryTagsInput),
          portionDefault,
          defaultPickupWindowId: pickupWindowId || undefined,
          chefNotes: chefNotes.trim() || undefined,
          activateMembership: false,
        },
      });
      resetCreateForm();
      setShowAddForm(false);
      setMessage(
        `Customer ${normalizedEmail} created — add a membership on the Memberships page when ready.`,
      );
      await refreshCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create customer.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Customers</h2>
          <p className="text-sm text-muted-foreground">
            Customer accounts and profile details. Memberships and plan preferences are managed
            separately on the Memberships page.
          </p>
        </div>
        {!showAddForm ? <Button onClick={() => setShowAddForm(true)}>Add customer</Button> : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {showAddForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add customer</CardTitle>
            <CardDescription>
              Creates the customer account and profile only — no membership yet. Email-only accounts
              are supported until they set a password or use a magic link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="customer-email">Email</Label>
                <Input
                  id="customer-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-name">Name</Label>
                <Input
                  id="customer-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jay Logan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-phone">Phone</Label>
                <Input
                  id="customer-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(770) 555-0142"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-portion">Default portion</Label>
                <Select
                  value={portionDefault}
                  onValueChange={(v) => setPortionDefault(v as PortionDefault)}
                >
                  <SelectTrigger id="customer-portion">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4oz">4 oz</SelectItem>
                    <SelectItem value="6oz">6 oz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {pickupWindows.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="customer-pickup">Default pickup</Label>
                  <Select value={pickupWindowId} onValueChange={setPickupWindowId}>
                    <SelectTrigger id="customer-pickup">
                      <SelectValue placeholder="Pickup window" />
                    </SelectTrigger>
                    <SelectContent>
                      {pickupWindows.map((pw) => (
                        <SelectItem key={pw.id} value={pw.id}>
                          {pw.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="customer-dietary-tags">Dietary tags</Label>
                <Input
                  id="customer-dietary-tags"
                  value={dietaryTagsInput}
                  onChange={(e) => setDietaryTagsInput(e.target.value)}
                  placeholder="gluten-free, low-sodium"
                />
              </div>
              <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="customer-allergies">Allergies</Label>
                <Textarea
                  id="customer-allergies"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  rows={2}
                  placeholder="Peanuts, shellfish…"
                />
              </div>
              <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="customer-chef-notes">Chef notes</Label>
                <Textarea
                  id="customer-chef-notes"
                  value={chefNotes}
                  onChange={(e) => setChefNotes(e.target.value)}
                  rows={2}
                  placeholder="Preferences, pilot notes…"
                />
              </div>
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating…" : "Create customer"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetCreateForm();
                    setShowAddForm(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All customers</CardTitle>
          <CardDescription>{customers.length} account(s)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Membership</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    No customers yet — add a customer to get started.
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <CustomerRow
                    key={customer.userId}
                    customer={customer}
                    pickupWindows={pickupWindows}
                    editing={editingId === customer.userId}
                    onEdit={() => setEditingId(customer.userId)}
                    onCancel={() => setEditingId(null)}
                    onSave={async (data) => {
                      await updateFn({ data: { userId: customer.userId, ...data } });
                      setEditingId(null);
                      setMessage("Customer updated.");
                      await refreshCustomers();
                    }}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function CustomerRow({
  customer,
  pickupWindows,
  editing,
  onEdit,
  onCancel,
  onSave,
}: {
  customer: AdminCustomerRow;
  pickupWindows: Array<{ id: string; label: string }>;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (data: {
    email?: string;
    name?: string;
    phone?: string | null;
    allergies?: string | null;
    dietaryTags?: string[];
    portionDefault?: PortionDefault;
    defaultPickupWindowId?: string | null;
    chefNotes?: string | null;
  }) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState(customer.email);
  const [name, setName] = useState(customer.name ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [portionDefault, setPortionDefault] = useState<PortionDefault>(customer.portionDefault);
  const [pickupWindowId, setPickupWindowId] = useState(customer.defaultPickupWindowId ?? "");
  const [dietaryTagsInput, setDietaryTagsInput] = useState(
    formatDietaryTagsInput(customer.dietaryTags),
  );
  const [allergies, setAllergies] = useState(customer.allergies ?? "");
  const [chefNotes, setChefNotes] = useState(customer.chefNotes ?? "");

  const label = customer.name?.trim() || customer.email;

  if (editing) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="bg-muted/30">
          <div className="grid gap-4 py-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(770) 555-0142"
              />
            </div>
            <div className="space-y-2">
              <Label>Default portion</Label>
              <Select
                value={portionDefault}
                onValueChange={(v) => setPortionDefault(v as PortionDefault)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4oz">4 oz</SelectItem>
                  <SelectItem value="6oz">6 oz</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {pickupWindows.length > 0 ? (
              <div className="space-y-2">
                <Label>Pickup</Label>
                <Select
                  value={pickupWindowId || "none"}
                  onValueChange={(v) => setPickupWindowId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {pickupWindows.map((pw) => (
                      <SelectItem key={pw.id} value={pw.id}>
                        {pw.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2 sm:col-span-2">
              <Label>Dietary tags</Label>
              <Input
                value={dietaryTagsInput}
                onChange={(e) => setDietaryTagsInput(e.target.value)}
                placeholder="gluten-free, low-sodium"
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label>Allergies</Label>
              <Textarea
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                rows={2}
                placeholder="Peanuts, shellfish…"
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label>Chef notes</Label>
              <Textarea
                value={chefNotes}
                onChange={(e) => setChefNotes(e.target.value)}
                rows={2}
                placeholder="Preferences, pilot notes…"
              />
            </div>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
              <Button
                size="sm"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onSave({
                      email: email.trim().toLowerCase(),
                      name,
                      phone: phone.trim() || null,
                      allergies: allergies.trim() || null,
                      dietaryTags: parseDietaryTagsInput(dietaryTagsInput),
                      portionDefault,
                      defaultPickupWindowId: pickupWindowId || null,
                      chefNotes: chefNotes.trim() || null,
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{label}</div>
        {customer.name ? (
          <div className="text-xs text-muted-foreground">{customer.email}</div>
        ) : null}
        {customer.phone ? (
          <div className="text-xs text-muted-foreground">{customer.phone}</div>
        ) : null}
        <div className="text-xs text-muted-foreground">
          Joined {format(parseISO(customer.createdAt), "MMM d, yyyy")}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={membershipStatusBadgeVariant(customer.membershipStatus)}>
          {formatMembershipStatus(customer.membershipStatus)}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">
        {customer.planName ?? "—"}
        {customer.mealsPerWeek ? (
          <div className="text-xs text-muted-foreground">{customer.mealsPerWeek} meals/wk</div>
        ) : null}
      </TableCell>
      <TableCell className="text-sm">{formatPaymentSchedule(customer.paymentSchedule)}</TableCell>
      <TableCell>
        <div className="text-sm">{customer.pickupLabel ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{customer.portionDefault}</div>
      </TableCell>
      <TableCell className="text-right tabular-nums">{customer.orderCount}</TableCell>
      <TableCell>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
      </TableCell>
    </TableRow>
  );
}
