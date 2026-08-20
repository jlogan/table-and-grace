import { createFileRoute } from "@tanstack/react-router";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createAdminMenuItemRecord,
  fetchAdminMenuItems,
  fetchAdminPlanCategoriesWithId,
  updateAdminMenuItemRecord,
} from "@/orders/admin.functions.server";
import { type AdminMenuItemRow } from "@/orders/admin-types";
import { centsToLabel } from "@/orders/review-types";

export const Route = createFileRoute("/admin/items")({
  beforeLoad: async () => {
    const [items, planCategories] = await Promise.all([
      fetchAdminMenuItems(),
      fetchAdminPlanCategoriesWithId(),
    ]);
    return { items, planCategories };
  },
  head: () => ({
    meta: [{ title: "Items — GOFOFA Ops" }],
  }),
  component: AdminItemsPage,
});

function formatPrice(cents: number | null): string {
  if (cents == null) return "Inherit";
  return centsToLabel(cents);
}

function AdminItemsPage() {
  const { items: initialItems, planCategories } = Route.useRouteContext();
  const createFn = useServerFn(createAdminMenuItemRecord);
  const updateFn = useServerFn(updateAdminMenuItemRecord);
  const refreshFn = useServerFn(fetchAdminMenuItems);

  const [items, setItems] = useState(initialItems);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshItems() {
    setItems(await refreshFn());
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Items</h2>
          <p className="text-sm text-muted-foreground">
            Active menu catalog — meals and products you sell. Pricing can inherit from plan
            category or override per portion size.
          </p>
        </div>
        {!showAddForm ? <Button onClick={() => setShowAddForm(true)}>Add item</Button> : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {showAddForm ? (
        <AddItemForm
          planCategories={planCategories}
          onCancel={() => setShowAddForm(false)}
          onCreate={async (data) => {
            setError(null);
            setMessage(null);
            try {
              await createFn({ data });
              setShowAddForm(false);
              setMessage("Item added to catalog.");
              await refreshItems();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not create item.");
            }
          }}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active catalog</CardTitle>
          <CardDescription>{items.length} item(s)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">4 oz</TableHead>
                <TableHead className="text-right">6 oz</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No active items — add your first menu item to populate batch inventory.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    planCategories={planCategories}
                    editing={editingId === item.id}
                    onEdit={() => setEditingId(item.id)}
                    onCancel={() => setEditingId(null)}
                    onSave={async (data) => {
                      setError(null);
                      setMessage(null);
                      try {
                        await updateFn({ data: { id: item.id, ...data } });
                        setEditingId(null);
                        setMessage("Item updated.");
                        await refreshItems();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Could not update item.");
                      }
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

function AddItemForm({
  planCategories,
  onCancel,
  onCreate,
}: {
  planCategories: Array<{ id: string; slug: string; name: string }>;
  onCancel: () => void;
  onCreate: (data: {
    name: string;
    note?: string;
    categoryId?: string;
    price4ozCents?: number;
    price6ozCents?: number;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price4oz, setPrice4oz] = useState("");
  const [price6oz, setPrice6oz] = useState("");
  const [saving, setSaving] = useState(false);

  function dollarsToCents(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed) || parsed < 0) return undefined;
    return Math.round(parsed * 100);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add item</CardTitle>
        <CardDescription>
          New items appear in batch inventory and customer order lines.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              await onCreate({
                name,
                note: note.trim() || undefined,
                categoryId: categoryId || undefined,
                price4ozCents: dollarsToCents(price4oz),
                price6ozCents: dollarsToCents(price6oz),
              });
              setName("");
              setNote("");
              setCategoryId("");
              setPrice4oz("");
              setPrice6oz("");
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Grilled salmon"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-category">Category</Label>
            <Select
              value={categoryId || "none"}
              onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}
            >
              <SelectTrigger id="item-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {planCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="item-note">Note</Label>
            <Textarea
              id="item-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional description or prep note"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-price-4oz">4 oz price ($)</Label>
            <Input
              id="item-price-4oz"
              type="number"
              min={0}
              step={0.01}
              value={price4oz}
              onChange={(e) => setPrice4oz(e.target.value)}
              placeholder="Inherit from category"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-price-6oz">6 oz price ($)</Label>
            <Input
              id="item-price-6oz"
              type="number"
              min={0}
              step={0.01}
              value={price6oz}
              onChange={(e) => setPrice6oz(e.target.value)}
              placeholder="Inherit from category"
            />
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Adding…" : "Add item"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ItemRow({
  item,
  planCategories,
  editing,
  onEdit,
  onCancel,
  onSave,
}: {
  item: AdminMenuItemRow;
  planCategories: Array<{ id: string; slug: string; name: string }>;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (data: {
    name?: string;
    note?: string | null;
    categoryId?: string | null;
    price4ozCents?: number | null;
    price6ozCents?: number | null;
  }) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note ?? "");
  const [categoryId, setCategoryId] = useState(item.categoryId ?? "");
  const [price4oz, setPrice4oz] = useState(
    item.price4ozCents != null ? (item.price4ozCents / 100).toFixed(2) : "",
  );
  const [price6oz, setPrice6oz] = useState(
    item.price6ozCents != null ? (item.price6ozCents / 100).toFixed(2) : "",
  );

  function dollarsToCents(value: string): number | null {
    if (!value.trim()) return null;
    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed) || parsed < 0) return null;
    return Math.round(parsed * 100);
  }

  if (editing) {
    return (
      <TableRow>
        <TableCell colSpan={6} className="bg-muted/30">
          <div className="grid gap-4 py-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={categoryId || "none"}
                onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {planCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label>Note</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>4 oz price ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={price4oz}
                onChange={(e) => setPrice4oz(e.target.value)}
                placeholder="Inherit"
              />
            </div>
            <div className="space-y-2">
              <Label>6 oz price ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={price6oz}
                onChange={(e) => setPrice6oz(e.target.value)}
                placeholder="Inherit"
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
                      name,
                      note: note.trim() || null,
                      categoryId: categoryId || null,
                      price4ozCents: dollarsToCents(price4oz),
                      price6ozCents: dollarsToCents(price6oz),
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
      <TableCell className="font-medium">{item.name}</TableCell>
      <TableCell className="text-sm">{item.categoryName ?? "—"}</TableCell>
      <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
        {item.note ?? "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">
        {formatPrice(item.price4ozCents)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">
        {formatPrice(item.price6ozCents)}
      </TableCell>
      <TableCell>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
      </TableCell>
    </TableRow>
  );
}
