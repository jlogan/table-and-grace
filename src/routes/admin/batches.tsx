import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, X } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import { requireRoleMiddleware } from "@/auth/middleware.server";
import { listPublishEligibleMembers, type PublishEligibility } from "@/db/batches.server";
import { getBatchProjectedMealDemand } from "@/db/customers.server";

import { WeeklyMenuPicker } from "@/components/admin/weekly-menu-picker";
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
import { formatDateString, getUpcomingWeekStarts, weekStartMonday } from "@/lib/dates";
import {
  createAdminWeeklyBatch,
  fetchActiveMenuItemsForAdmin,
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

function formatPortionLabel(portion: "4oz" | "6oz"): string {
  return portion === "4oz" ? "4 oz" : "6 oz";
}

function formatWeekOfLabel(weekStart: string): string {
  return `Week of ${formatDateString(weekStart, "MMM d, yyyy")}`;
}

export const Route = createFileRoute("/admin/batches")({
  beforeLoad: async () => {
    const [batches, pickupWindows, menuItems] = await Promise.all([
      fetchAdminBatches(),
      fetchAdminPickupWindows(),
      fetchActiveMenuItemsForAdmin(),
    ]);
    return { batches, pickupWindows, menuItems };
  },
  head: () => ({
    meta: [{ title: "Batches — GOFOFA Ops" }],
  }),
  component: AdminBatchesPage,
});

function AdminBatchesPage() {
  const { batches: initialBatches, pickupWindows, menuItems } = Route.useRouteContext();
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
  const [weekStart, setWeekStart] = useState(
    () => getUpcomingWeekStarts(12)[0] ?? weekStartMonday().toISOString().slice(0, 10),
  );
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
  const projected4ozMeals = eligibleMembers
    .filter((member) => member.portionDefault === "4oz")
    .reduce((sum, member) => sum + member.mealsPerWeek, 0);
  const projected6ozMeals = eligibleMembers
    .filter((member) => member.portionDefault === "6oz")
    .reduce((sum, member) => sum + member.mealsPerWeek, 0);
  const existingWeekStarts = useMemo(
    () => new Set(batches.map((batch) => batch.weekStart)),
    [batches],
  );
  const weekStartOptions = useMemo(() => getUpcomingWeekStarts(12), []);
  const menuItemNameById = useMemo(
    () => new Map(menuItems.map((item) => [item.id, item.name])),
    [menuItems],
  );
  const plannedTotalMeals = useMemo(
    () => Object.values(inventoryDraft).reduce((sum, qty) => sum + qty, 0),
    [inventoryDraft],
  );
  const planningMealsDelta = plannedTotalMeals - projectedTotalMeals;
  const planningStatusText =
    planningMealsDelta < 0
      ? `${Math.abs(planningMealsDelta)} still to plan`
      : planningMealsDelta === 0
        ? "Fully planned"
        : `${planningMealsDelta} over plan`;
  const hideRemainingColumn = selectedBatch?.status === "planning";
  const selectedWeeklyMenuRows = useMemo(() => {
    return Object.entries(inventoryDraft)
      .filter(([, qty]) => qty > 0)
      .map(([menuItemId, qty]) => {
        const inventoryRow = inventory.find((row) => row.menuItemId === menuItemId);
        return {
          menuItemId,
          menuItemName:
            inventoryRow?.menuItemName ?? menuItemNameById.get(menuItemId) ?? "Unknown item",
          qtyPlanned: qty,
          qtyRemaining: inventoryRow?.qtyRemaining ?? qty,
        };
      })
      .sort((a, b) => a.menuItemName.localeCompare(b.menuItemName));
  }, [inventory, inventoryDraft, menuItemNameById]);
  const selectedMenuItemIds = useMemo(
    () => new Set(selectedWeeklyMenuRows.map((row) => row.menuItemId)),
    [selectedWeeklyMenuRows],
  );
  const publishBlockReasons: string[] = [];
  if (!canEditInventory) {
    publishBlockReasons.push("Batch is not in planning or draft.");
  }
  if (savedInventoryCount === 0) {
    publishBlockReasons.push("Save planned quantities for at least one meal before publishing.");
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
      setInventoryDraft(
        Object.fromEntries(
          rows.filter((row) => row.qtyCooked > 0).map((row) => [row.menuItemId, row.qtyCooked]),
        ),
      );
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
          weekStart,
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
      const removedItems = inventory
        .filter(
          (row) =>
            row.batchItemId && row.qtyCooked > 0 && (inventoryDraft[row.menuItemId] ?? 0) === 0,
        )
        .map((row) => ({ menuItemId: row.menuItemId, qtyCooked: 0 }));
      const plannedItems = Object.entries(inventoryDraft)
        .filter(([, qtyCooked]) => qtyCooked > 0)
        .map(([menuItemId, qtyCooked]) => ({ menuItemId, qtyCooked }));
      const items = [...plannedItems, ...removedItems];
      const rows = await saveInventoryFn({ data: { batchId: selectedBatchId, items } });
      setInventory(rows);
      setInventoryDraft(
        Object.fromEntries(
          rows.filter((row) => row.qtyCooked > 0).map((row) => [row.menuItemId, row.qtyCooked]),
        ),
      );
      await refreshBatches();
      if (selectedBatch) {
        await loadInventory(selectedBatchId, selectedBatch.status);
      }
      setMessage("Planned quantities saved.");
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
                ? "Choose the batch week, pickup window, and open a planning batch."
                : "Choose weekly menu meals, set planned quantities, review member demand, then publish for customer review."}
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
              Opens a planning batch for the selected week. Each week can have only one batch.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="week-start">Week of</Label>
              <Select value={weekStart} onValueChange={setWeekStart}>
                <SelectTrigger id="week-start" className="w-[260px]">
                  <SelectValue placeholder="Select week" />
                </SelectTrigger>
                <SelectContent>
                  {weekStartOptions.map((option) => {
                    const taken = existingWeekStarts.has(option);
                    return (
                      <SelectItem key={option} value={option} disabled={taken}>
                        {formatWeekOfLabel(option)}
                        {taken ? " (batch exists)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
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
            <Button
              onClick={handleCreateBatch}
              disabled={creating || existingWeekStarts.has(weekStart)}
            >
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
                    {formatWeekOfLabel(selectedBatch.weekStart)}
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
                <CardTitle className="text-base">Eligible memberships</CardTitle>
                <CardDescription>
                  Active memberships that will receive orders when you publish
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
                      search={{ userId: undefined, add: undefined }}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      activate a membership
                    </Link>
                    .
                  </p>
                ) : (
                  <>
                    <div className="mb-4 grid gap-2 text-sm sm:grid-cols-3">
                      <div className="rounded-md border border-border px-3 py-2">
                        <p className="text-muted-foreground">Total meals</p>
                        <p className="font-medium tabular-nums">{projectedTotalMeals}</p>
                      </div>
                      <div className="rounded-md border border-border px-3 py-2">
                        <p className="text-muted-foreground">4 oz portions</p>
                        <p className="font-medium tabular-nums">{projected4ozMeals}</p>
                      </div>
                      <div className="rounded-md border border-border px-3 py-2">
                        <p className="text-muted-foreground">6 oz portions</p>
                        <p className="font-medium tabular-nums">{projected6ozMeals}</p>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead className="text-right">Meals/wk</TableHead>
                          <TableHead>Portion</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {eligibleMembers.map((member) => {
                          const label = member.name?.trim() || member.email;
                          return (
                            <TableRow key={member.membershipId}>
                              <TableCell>
                                <div className="font-medium">{label}</div>
                                {member.name?.trim() ? (
                                  <div className="text-xs text-muted-foreground">
                                    {member.email}
                                  </div>
                                ) : null}
                              </TableCell>
                              <TableCell>{member.planName ?? "—"}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {member.mealsPerWeek}
                              </TableCell>
                              <TableCell>{formatPortionLabel(member.portionDefault)}</TableCell>
                              <TableCell>
                                <Badge variant="default">Eligible</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </>
                )}
                {unresolvedMembers.length > 0 ? (
                  <p className="mt-3 text-sm text-destructive">
                    {unresolvedMembers.length} active membership
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
                    ? "Planning indicator — compares total eligible membership meals to your planned quantities. Per-meal counts are not confirmed customer demand."
                    : "Actual order-line demand vs planned quantity (after publish)"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {showProjectedDemand ? (
                  <>
                    <div className="grid gap-2 text-sm sm:grid-cols-3">
                      <div className="rounded-md border border-border px-3 py-2">
                        <p className="text-muted-foreground">Projected demand</p>
                        <p className="font-medium tabular-nums">{projectedTotalMeals}</p>
                      </div>
                      <div className="rounded-md border border-border px-3 py-2">
                        <p className="text-muted-foreground">Planned</p>
                        <p className="font-medium tabular-nums">{plannedTotalMeals}</p>
                      </div>
                      <div className="rounded-md border border-border px-3 py-2">
                        <p className="text-muted-foreground">Status</p>
                        <p className="font-medium">{planningStatusText}</p>
                      </div>
                    </div>
                    {eligibleCount === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No eligible active members — projected demand is 0 until memberships are
                        active.
                      </p>
                    ) : null}
                  </>
                ) : mealDemand.filter((r) => r.qtyNeeded > 0 || r.qtyCooked > 0).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No meal demand recorded for this batch yet.
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
                              need {row.qtyNeeded} / planned {row.qtyCooked}
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
                  <CardTitle className="text-base">Weekly menu</CardTitle>
                  <CardDescription>
                    Search the active catalog to choose meals for this batch, then set planned
                    quantities.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSaveInventory}
                    disabled={!canEditInventory || saving || loadingInventory}
                  >
                    {saving ? "Saving…" : "Save planned quantities"}
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
            <CardContent className="space-y-4">
              {canEditInventory ? (
                <WeeklyMenuPicker
                  menuItems={menuItems}
                  selectedMenuItemIds={selectedMenuItemIds}
                  disabled={loadingInventory}
                  onSelect={(menuItemId) =>
                    setInventoryDraft((prev) => ({
                      ...prev,
                      [menuItemId]: (prev[menuItemId] ?? 0) > 0 ? prev[menuItemId]! : 1,
                    }))
                  }
                />
              ) : null}
              {loadingInventory ? (
                <p className="text-sm text-muted-foreground">Loading weekly menu…</p>
              ) : selectedWeeklyMenuRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {canEditInventory
                    ? "No meals selected yet — search the active menu to build this week's offering."
                    : "No planned meals saved for this batch."}
                </p>
              ) : (
                <div>
                  <p className="mb-3 text-sm font-medium">
                    Selected weekly meals ({selectedWeeklyMenuRows.length})
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Menu item</TableHead>
                        <TableHead className="w-[140px] text-right">Planned quantity</TableHead>
                        {!hideRemainingColumn ? (
                          <TableHead className="w-[120px] text-right">Remaining</TableHead>
                        ) : null}
                        {canEditInventory ? <TableHead className="w-[56px]" /> : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedWeeklyMenuRows.map((row) => (
                        <TableRow key={row.menuItemId}>
                          <TableCell>{row.menuItemName}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              max={999}
                              className="ml-auto w-24 text-right tabular-nums"
                              disabled={!canEditInventory}
                              value={inventoryDraft[row.menuItemId] ?? 0}
                              onChange={(e) => {
                                const qty = Number(e.target.value) || 0;
                                setInventoryDraft((prev) => ({
                                  ...prev,
                                  [row.menuItemId]: qty,
                                }));
                              }}
                            />
                          </TableCell>
                          {!hideRemainingColumn ? (
                            <TableCell className="text-right tabular-nums">
                              {row.qtyRemaining}
                            </TableCell>
                          ) : null}
                          {canEditInventory ? (
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Remove ${row.menuItemName}`}
                                onClick={() =>
                                  setInventoryDraft((prev) => ({
                                    ...prev,
                                    [row.menuItemId]: 0,
                                  }))
                                }
                              >
                                <X className="size-4" />
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </>
  );
}
