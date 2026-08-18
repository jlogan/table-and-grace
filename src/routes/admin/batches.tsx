import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { format, parseISO } from "date-fns";
import { useEffect, useState } from "react";

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
import {
  createAdminWeeklyBatch,
  fetchAdminBatches,
  fetchAdminMemberships,
  fetchAdminPickupWindows,
  fetchBatchInventory,
  fetchBatchMealDemand,
  publishAdminWeeklyBatch,
  saveAdminBatchInventory,
} from "@/orders/admin.functions.server";
import {
  batchStatusBadgeVariant,
  formatBatchStatus,
  formatMembershipStatus,
  membershipStatusBadgeVariant,
  type AdminBatchInventoryRow,
  type AdminBatchSummary,
  type AdminMembershipRow,
  type BatchMealDemandRow,
} from "@/orders/admin-types";
import { formatPaymentSchedule } from "@/orders/review-types";

export const Route = createFileRoute("/admin/batches")({
  beforeLoad: async () => {
    const [batches, pickupWindows, memberships] = await Promise.all([
      fetchAdminBatches(),
      fetchAdminPickupWindows(),
      fetchAdminMemberships(),
    ]);
    return { batches, pickupWindows, memberships };
  },
  head: () => ({
    meta: [{ title: "Batches — GOFOFA Ops" }],
  }),
  component: AdminBatchesPage,
});

function AdminBatchesPage() {
  const {
    batches: initialBatches,
    pickupWindows,
    memberships: initialMemberships,
  } = Route.useRouteContext();
  const createFn = useServerFn(createAdminWeeklyBatch);
  const inventoryFn = useServerFn(fetchBatchInventory);
  const saveInventoryFn = useServerFn(saveAdminBatchInventory);
  const publishFn = useServerFn(publishAdminWeeklyBatch);
  const refreshBatchesFn = useServerFn(fetchAdminBatches);
  const mealDemandFn = useServerFn(fetchBatchMealDemand);

  const [batches, setBatches] = useState(initialBatches);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(
    initialBatches[0]?.id ?? null,
  );
  const [inventory, setInventory] = useState<AdminBatchInventoryRow[]>([]);
  const [mealDemand, setMealDemand] = useState<BatchMealDemandRow[]>([]);
  const [memberships] = useState<AdminMembershipRow[]>(initialMemberships);
  const [inventoryDraft, setInventoryDraft] = useState<Record<string, number>>({});
  const [pickupWindowId, setPickupWindowId] = useState(pickupWindows[0]?.id ?? "");
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedBatch = batches.find((b) => b.id === selectedBatchId) ?? null;
  const canEditInventory =
    selectedBatch?.status === "planning" || selectedBatch?.status === "draft";
  const canPublish = canEditInventory && selectedBatch && selectedBatch.itemCount > 0;

  useEffect(() => {
    if (selectedBatchId) {
      void loadInventory(selectedBatchId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when initial selection is set
  }, []);

  async function refreshBatches() {
    const next = await refreshBatchesFn();
    setBatches(next);
    return next;
  }

  async function loadInventory(batchId: string) {
    setLoadingInventory(true);
    setError(null);
    try {
      const [rows, demand] = await Promise.all([
        inventoryFn({ data: { batchId } }),
        mealDemandFn({ data: { batchId } }),
      ]);
      setInventory(rows);
      setInventoryDraft(Object.fromEntries(rows.map((r) => [r.menuItemId, r.qtyCooked])));
      setMealDemand(demand);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load inventory.");
    } finally {
      setLoadingInventory(false);
    }
  }

  async function handleSelectBatch(batch: AdminBatchSummary) {
    setSelectedBatchId(batch.id);
    setMessage(null);
    await loadInventory(batch.id);
  }

  async function handleCreateBatch() {
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const result = await createFn({
        data: {
          pickupWindowId: pickupWindowId || undefined,
        },
      });
      const next = await refreshBatches();
      const created = next.find((b) => b.id === result.batchId);
      if (created) {
        setSelectedBatchId(created.id);
        await loadInventory(created.id);
      }
      setMessage("Weekly batch created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create batch.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveInventory() {
    if (!selectedBatchId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const items = Object.entries(inventoryDraft).map(([menuItemId, qtyCooked]) => ({
        menuItemId,
        qtyCooked,
      }));
      const rows = await saveInventoryFn({ data: { batchId: selectedBatchId, items } });
      setInventory(rows);
      setInventoryDraft(Object.fromEntries(rows.map((r) => [r.menuItemId, r.qtyCooked])));
      await refreshBatches();
      setMessage("Inventory saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save inventory.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!selectedBatchId) return;
    setPublishing(true);
    setError(null);
    setMessage(null);
    try {
      const result = await publishFn({ data: { batchId: selectedBatchId } });
      await refreshBatches();
      await loadInventory(selectedBatchId);
      setMessage(`Published — ${result.ordersCreated} order(s) sent for customer review.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish batch.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Weekly batches</h2>
        <p className="text-sm text-muted-foreground">
          Create a batch, set menu inventory, then publish for customer review.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create batch</CardTitle>
          <CardDescription>Opens a planning batch for the current week.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          {pickupWindows.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="pickup-window">Default pickup window</Label>
              <Select value={pickupWindowId} onValueChange={setPickupWindowId}>
                <SelectTrigger id="pickup-window" className="w-[240px]">
                  <SelectValue placeholder="Select pickup window" />
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
          <Button onClick={handleCreateBatch} disabled={creating}>
            {creating ? "Creating…" : "Create this week's batch"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All batches</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week of</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead>Review deadline</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    No batches yet.
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((batch) => (
                  <TableRow
                    key={batch.id}
                    data-state={batch.id === selectedBatchId ? "selected" : undefined}
                    className="cursor-pointer"
                    onClick={() => handleSelectBatch(batch)}
                  >
                    <TableCell className="font-medium">
                      {format(parseISO(batch.weekStart), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={batchStatusBadgeVariant(batch.status)}>
                        {formatBatchStatus(batch.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{batch.pickupWindowLabel ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{batch.orderCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{batch.itemCount}</TableCell>
                    <TableCell>
                      {batch.reviewDeadline
                        ? format(parseISO(batch.reviewDeadline), "MMM d, h:mm a")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {batch.orderCount > 0 ? (
                        <Link
                          to="/admin/orders"
                          search={{ batchId: batch.id }}
                          className="text-sm text-primary underline-offset-4 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Orders
                        </Link>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedBatch ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upcoming members</CardTitle>
                <CardDescription>
                  Active memberships included when you publish this batch
                </CardDescription>
              </CardHeader>
              <CardContent>
                {memberships.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active members —{" "}
                    <Link
                      to="/admin/customers"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      add a pilot customer
                    </Link>
                    .
                  </p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {memberships.slice(0, 6).map((member) => {
                      const label = member.name?.trim() || member.email;
                      return (
                        <li
                          key={member.userId}
                          className="border-b border-border pb-2 last:border-0"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{label}</span>
                            <Badge variant={membershipStatusBadgeVariant(member.membershipStatus)}>
                              {formatMembershipStatus(member.membershipStatus)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-muted-foreground">
                            {member.planName ?? "Plan TBD"}
                            {member.mealsPerWeek ? ` · ${member.mealsPerWeek} meals/wk` : ""}
                            {" · "}
                            {formatPaymentSchedule(member.paymentSchedule)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Meals needed this batch</CardTitle>
                <CardDescription>Order demand vs cooked inventory</CardDescription>
              </CardHeader>
              <CardContent>
                {mealDemand.filter((r) => r.qtyNeeded > 0 || r.qtyCooked > 0).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Publish the batch or save inventory to see meal totals.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {mealDemand
                      .filter((r) => r.qtyNeeded > 0 || r.qtyCooked > 0)
                      .slice(0, 8)
                      .map((row) => (
                        <li key={row.menuItemId} className="flex justify-between gap-4">
                          <span className="truncate">{row.menuItemName}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            need {row.qtyNeeded} / cooked {row.qtyCooked}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    Batch inventory — week of{" "}
                    {format(parseISO(selectedBatch.weekStart), "MMM d, yyyy")}
                  </CardTitle>
                  <CardDescription>
                    Set cooked quantities from the active menu catalog.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSaveInventory}
                    disabled={!canEditInventory || saving || loadingInventory}
                  >
                    {saving ? "Saving…" : "Save inventory"}
                  </Button>
                  <Button onClick={handlePublish} disabled={!canPublish || publishing}>
                    {publishing ? "Publishing…" : "Publish for review"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingInventory ? (
                <p className="p-4 text-sm text-muted-foreground">Loading inventory…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Menu item</TableHead>
                      <TableHead className="w-[120px] text-right">Qty cooked</TableHead>
                      <TableHead className="w-[120px] text-right">Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.map((row) => (
                      <TableRow key={row.menuItemId}>
                        <TableCell>{row.menuItemName}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            max={999}
                            className="ml-auto w-20 text-right tabular-nums"
                            disabled={!canEditInventory}
                            value={inventoryDraft[row.menuItemId] ?? 0}
                            onChange={(e) =>
                              setInventoryDraft((prev) => ({
                                ...prev,
                                [row.menuItemId]: Number(e.target.value) || 0,
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.qtyRemaining}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </>
  );
}
