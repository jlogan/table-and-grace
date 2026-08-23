import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import type { PortionDefault } from "@/db/schema/customer-profiles";
import { createAdminCustomerAccount } from "@/orders/admin.functions.server";

export const Route = createFileRoute("/admin/customers/new")({
  head: () => ({
    meta: [{ title: "Add Customer — GOFOFA Ops" }],
  }),
  component: AdminNewCustomerPage,
});

function AdminNewCustomerPage() {
  const router = useRouter();
  const createFn = useServerFn(createAdminCustomerAccount);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [favoriteCake, setFavoriteCake] = useState("");
  const [portionDefault, setPortionDefault] = useState<PortionDefault>("6oz");
  const [chefNotes, setChefNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const result = await createFn({
        data: {
          email: email.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          preferredName: preferredName.trim() || undefined,
          phone: phone.trim() || undefined,
          birthday: birthday || undefined,
          favoriteCake: favoriteCake.trim() || undefined,
          portionDefault,
          chefNotes: chefNotes.trim() || undefined,
          activateMembership: false,
        },
      });
      await router.navigate({
        to: "/admin/customers/$customerId",
        params: { customerId: result.userId },
      });
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
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Add customer</h2>
          <p className="text-sm text-muted-foreground">
            Creates the customer account and profile only — add memberships separately when ready.
          </p>
        </div>
        <Button variant="outline" asChild className="no-print">
          <Link to="/admin/customers">Back to customers</Link>
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer details</CardTitle>
          <CardDescription>
            Email-only accounts are supported until they set a password or use a magic link.
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
              <Label htmlFor="customer-first-name">First name</Label>
              <Input
                id="customer-first-name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jay"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-last-name">Last name</Label>
              <Input
                id="customer-last-name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Logan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-preferred-name">Preferred name</Label>
              <Input
                id="customer-preferred-name"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="Optional"
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
              <Label htmlFor="customer-birthday">Birthday</Label>
              <Input
                id="customer-birthday"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-favorite-cake">Favorite cake</Label>
              <Input
                id="customer-favorite-cake"
                value={favoriteCake}
                onChange={(e) => setFavoriteCake(e.target.value)}
                placeholder="Optional"
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
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="customer-chef-notes">Chef notes</Label>
              <Textarea
                id="customer-chef-notes"
                value={chefNotes}
                onChange={(e) => setChefNotes(e.target.value)}
                rows={6}
                placeholder="Preferences, pilot notes…"
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create customer"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/admin/customers">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
