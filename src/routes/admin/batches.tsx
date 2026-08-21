import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { requireRoleMiddleware } from "@/auth/middleware.server";
import { listPublishEligibleMembers, type PublishEligibility } from "@/db/batches.server";
import { getBatchProjectedMealDemand } from "@/db/customers.server";

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
import { formatDateString } from "@/lib/dates";
import {
  createAdminWeeklyBatch,
  fetchAdminBatches,
  fetchAdminPickupWindows,
  fetchBatchInventory,
  fetchBatchMealDemand,
  publishAdminWeeklyBatch,
  saveAdminBatchInventory,
} from "@/orders/admin.functions.server";
import {
  batchStatusBadgeVariant,
  formatBatchStatus,
  type AdminBatchInventoryRow,
  type AdminBatchSummary,
  type BatchMealDemandRow,
} from "@/orders/admin-types";

const batchIdSchema = z.object({
  batchId: z.string().uuid(),
});

const fetchBatchProjectedMealDemand = createServerFn({ method: "GET" })
  .middleware([requireRoleMiddleware("admin")])
  .validator(batchIdSchema)
  .handler(async ({ data }) => getBatchProjectedMealDemand(data.batchId));

const fetchBatchPublishEligibility = createServerFn({ method: "GET" })
  .middleware([requireRoleMiddleware("admin")])
  .handler(async () => listPublishEligibleMembers());

type PageMode = "list" | "create" | "detail";

export const Route = createFileRoute("/admin/batches")({
  beforeLoad: async () => {
    const [batches, pickupWindows] = await Promise.all([
      fetchAdminBatches(),
      fetchAdminPickupWindows(),
    ]);
    return { batches, pickupWindows };
  },
  head: () => ({
    meta: [{ title: "Batches — GOFOFA Ops" }],
  }),
  component: AdminBatchesPage,
});

function AdminBatchesPage() {
  const { batches: initialBatches, pickupWindows } = Route.useRouteContext();
  const createFn = useServerFn(createAdminWeeklyBatch);
  const inventoryFn = useServerFn(fetchBatchInventory);
  const saveInventoryFn = useServerFn(saveAdminBatchInventory);
  const publishFn = useServerFn(publishAdminWeeklyBatch);
  const refreshBatchesFn = useServerFn(fetchAdminBatches);
  const mealDemandFn = useServerFn(fetchBatchMealDemand);
  const projectedMealDemandFn = useServerFn(fetchBatchProjectedMealDemand);
  const publishEligibilityFn = useServerFn(fetchBatchPublishEligibility);

  const [batches, setBatches] = useState(initialBatches);
  const [mode, setMode] = useState<PageMode>("list");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<AdminBatchInventoryRow[]>([]);
  const [mealDemand, setMealDemand] = useState<BatchMealDemandRow[]>([]);
  const [publishEligibility, setPublishEligibility] = useState<PublishEligibility | null>(null);
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
  const showProjectedDemand = canEditInventory;
  const savedInventoryCount =
    inventory.filter((row) => row.qtyCooked > 0).length || selectedBatch?.itemCount || 0;
  const eligibleMembers = publishEligibility?.eligible ?? [];
  const eligibleCount = eligibleMembers.length;
  const excludedInactiveCount = publishEligibility?.excludedInactiveCount ?? 0;
  const unresolvedMembers = publishEligibility?.unresolved ?? [];
  const projectedTotalMeals = eligibleMembers.reduce((sum, member) => sum + member.mealsPerWeek, 0);
  const publishBlockReasons: string[] = [];
  if (!canEditInventory) {
    publishBlockReasons.push("Batch is not in planning or draft.");
  }
  if (savedInventoryCount === 0) {
    publishBlockReasons.push("Save batch inventory with at least one item before publishing.");
  }
  if (eligibleCount === 0) {
    publishBlockReasons.push("No active memberships are eligible for this batch.");
  }
  if (unresolvedMembers.length > 0) {
    publishBlockReasons.push(
      `${unresolvedMembers.length} active member(s) need meals per week set before publishing.`,
    );
  }
  const canPublish = publishBlockReasons.length === 0;

  async function refreshBatches() {
    const next = await refreshBatchesFn();
    setBatches(next);
    return next;
  }

  async function loadInventory(batchId: string, batchStatus?: AdminBatchSummary["status"]) {
    setLoadingInventory(true);
    setError(null);
    try {
      const isPrePublish = batchStatus === "planning" || batchStatus === "draft";
      const [rows, demand, eligibility] = await Promise.all([
        inventoryFn({ data: { batchId } }),
        isPrePublish
          ? projectedMealDemandFn({ data: { batchId } })
          : mealDemandFn({ data: { batchId } }),
        isPrePublish ? publishEligibilityFn() : Promise.resolve(null),
      ]);
      setInventory(rows);
      setInventoryDraft(Object.fromEntries(rows.map((r) => [r.menuItemId, r.qtyCooked])));
      setMealDemand(demand);
      setPublishEligibility(eligibility);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load inventory.");
    } finally {
      setLoadingInventory(false);
    }
  }

  async function openBatchDetail(batch: AdminBatchSummary) {
    setSelectedBatchId(batch.id);
    setMode("detail");
    setMessage(null);
    await loadInventory(batch.id, batch.status);
  }

  function backToList() {
    setMode("list");
    setSelectedBatchId(null);
    setInventory([]);
    setMealDemand([]);
    setPublishEligibility(null);
    setInventoryDraft({});
    setError(null);
    setMessage(null);
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
        await openBatchDetail(created);
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
      if (selectedBatch) {
        await loadInventory(selectedBatchId, selectedBatch.status);
      }
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
      const next = await refreshBatches();
      const published = next.find((b) => b.id === selectedBatchId);
      await loadInventory(selectedBatchId, published?.status);
      setMessage(`Published — ${result.ordersCreated} order(s) sent for customer review.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish batch.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Weekly batches</h2>
          <p className="text-sm text-muted-foreground">
            {mode === "list"
              ? "Select a batch to manage inventory and publish, or create a new batch date."
              : mode === "create"
                ? "Opens a planning batch for today's batch date."
                : "Set menu inventory, review member demand, then publish for customer review."}
          </p>
        </div>
        {mode === "list" ? (
          <Button onClick={() => setMode("create")}>Create new batch</Button>
        ) : (
          <Button variant="outline" onClick={backToList}>
            <ArrowLeft className="size-4" />
            All batches
          </Button>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {mode === "create" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create batch</CardTitle>
            <CardDescription>
              Opens a planning batch for today's batch date. Pickup/delivery date controls are
              coming in the next batch-planning pass.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            {pickupWindows.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="pickup-window">Pickup / delivery window</Label>
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
              {creating ? "Creating…" : "Create batch"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {mode === "list" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All batches</CardTitle>
            <CardDescription>{batches.length} batch(es)</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pickup / delivery</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead>Review deadline</TableHead>
                  <TableHead className="w-[140px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      No batches yet — create your first batch date to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">
                        {formatDateString(batch.weekStart, "MMM d, yyyy")}
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
                          ? formatDateString(batch.reviewDeadline, "MMM d, h:mm a")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openBatchDetail(batch)}
                          >
                            View
                          </Button>
                          {batch.orderCount > 0 ? (
                            <Link
                              to="/admin/orders"
                              search={{ batchId: batch.id }}
                              className="text-sm text-primary underline-offset-4 hover:underline"
                            >
                              Orders
                            </Link>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {mode === "detail" && selectedBatch ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    Batch date {formatDateString(selectedBatch.weekStart, "MMM d, yyyy")}
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant={batchStatusBadgeVariant(selectedBatch.status)}>
                      {formatBatchStatus(selectedBatch.status)}
                    </Badge>
                    <span>{selectedBatch.pickupWindowLabel ?? "No pickup window"}</span>
                    {selectedBatch.reviewDeadline ? (
                      <span>
                        · Review by{" "}
                        {formatDateString(selectedBatch.reviewDeadline, "MMM d, h:mm a")}
                      </span>
                    ) : null}
                  </CardDescription>
                </div>
                {selectedBatch.orderCount > 0 ? (
                  <Link
                    to="/admin/orders"
                    search={{ batchId: selectedBatch.id }}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    View {selectedBatch.orderCount} order(s)
                  </Link>
                ) : null}
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Eligible members</CardTitle>
                <CardDescription>
                  {eligibleCount} active membership{eligibleCount === 1 ? "" : "s"} will receive
                  orders when you publish
                  {excludedInactiveCount > 0
                    ? ` · ${excludedInactiveCount} paused or cancelled excluded`
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {eligibleCount === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No eligible active members —{" "}
                    <Link
                      to="/admin/memberships"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      activate a membership
                    </Link>
                    .
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Projected total meal demand:{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {projectedTotalMeals}
                      </span>
                    </p>
                    <ul className="space-y-3 text-sm">
                      {eligibleMembers.slice(0, 6).map((member) => {
                        const label = member.name?.trim() || member.email;
                        return (
                          <li
                            key={member.membershipId}
                            className="border-b border-border pb-2 last:border-0"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium">{label}</span>
                              <Badge variant="default">Active</Badge>
                            </div>
                            <p className="mt-1 text-muted-foreground">
                              {member.mealsPerWeek} meal{member.mealsPerWeek === 1 ? "" : "s"}/wk
                              {" · "}
                              {member.portionDefault} portion
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                    {eligibleCount > 6 ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        + {eligibleCount - 6} more eligible member
                        {eligibleCount - 6 === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </>
                )}
                {unresolvedMembers.length > 0 ? (
                  <p className="mt-3 text-sm text-destructive">
                    {unresolvedMembers.length} active member
                    {unresolvedMembers.length === 1 ? "" : "s"} missing meals per week:{" "}
                    {unresolvedMembers
                      .slice(0, 3)
                      .map((member) => member.name?.trim() || member.email)
                      .join(", ")}
                    {unresolvedMembers.length > 3 ? "…" : ""}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Meals needed this batch</CardTitle>
                <CardDescription>
                  {showProjectedDemand
                    ? "Projected demand vs cooked inventory (before publish)"
                    : "Actual order-line demand vs cooked inventory (after publish)"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mealDemand.filter((r) => r.qtyNeeded > 0 || r.qtyCooked > 0).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {showProjectedDemand
                      ? "Save inventory and add eligible active members to see projected meal totals."
                      : "No meal demand recorded for this batch yet."}
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {mealDemand
                      .filter((r) => r.qtyNeeded > 0 || r.qtyCooked > 0)
                      .slice(0, 8)
                      .map((row) => {
                        const shortage = Math.max(0, row.qtyNeeded - row.qtyCooked);
                        return (
                          <li key={row.menuItemId} className="flex justify-between gap-4">
                            <span className="truncate">{row.menuItemName}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {showProjectedDemand ? "projected" : "need"} {row.qtyNeeded} / cooked{" "}
                              {row.qtyCooked}
                              {shortage > 0 ? ` · short ${shortage}` : ""}
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Batch inventory</CardTitle>
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
              {!canPublish && canEditInventory && publishBlockReasons.length > 0 ? (
                <p className="text-sm text-muted-foreground">{publishBlockReasons.join(" ")}</p>
              ) : null}
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
