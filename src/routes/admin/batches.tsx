import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { requireRoleMiddleware } from "@/auth/middleware.server";
import { listPublishEligibleMembers, type PublishEligibility } from "@/db/batches.server";
import { getBatchProjectedMealDemand } from "@/db/customers.server";

import { MemberOrderItemPicker } from "@/components/admin/member-order-item-picker";
import { MemberQuickViewPanel } from "@/components/admin/member-quick-view-panel";
import { MemberQuickViewSheet } from "@/components/admin/member-quick-view-sheet";
import {
  MenuItemCreateDialog,
  type MenuItemCreateInput,
} from "@/components/admin/menu-item-create-dialog";
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
import { formatDateString } from "@/lib/dates";
import { formatLastBatchAdded } from "@/lib/batch-date-labels";
import { centsToLabel } from "@/orders/review-types";
import {
  createAdminWeeklyBatch,
  createAdminMenuItemRecord,
  fetchActiveMenuItemsForAdmin,
  fetchAdminBatches,
  fetchAdminPlanCategoriesWithId,
  fetchBatchDraftOrderSummaries,
  fetchBatchInventory,
  fetchBatchMealDemand,
  fetchBatchMemberDraftOrder,
  fetchBatchPlanningMembers,
  fetchMenuItemsLastBatchAdded,
  generateAdminBatchOrders,
  openAdminMenuForSelection,
  saveAdminBatchCatalog,
  saveAdminBatchMemberDraftOrder,
} from "@/orders/admin.functions.server";
import {
  batchStatusBadgeVariant,
  formatBatchStatus,
  type AdminBatchInventoryRow,
  type AdminBatchSummary,
  type AdminMenuItemOption,
  type BatchDraftOrderSummaryRow,
  type BatchMealDemandRow,
  type BatchMemberDraftOrderRow,
  type BatchPlanningMemberRow,
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

function defaultSelectionDeadlineLocal(): string {
  const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function todayIsoDate(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function localDatetimeToIso(value: string): string {
  return new Date(value).toISOString();
}

function memberDraftProgressLabel(
  member: BatchPlanningMemberRow,
  summary: BatchDraftOrderSummaryRow | undefined,
): { label: string; complete: boolean } {
  if (!summary || summary.mealCount <= 0) {
    return { label: "Not started", complete: false };
  }
  const meetsAllowance = member.mealsPerWeek <= 0 || summary.mealCount >= member.mealsPerWeek;
  return {
    label: `${summary.mealCount} meal(s)${member.mealsPerWeek > 0 ? ` / ${member.mealsPerWeek}` : ""}`,
    complete: meetsAllowance,
  };
}

function memberLabel(member: BatchPlanningMemberRow): string {
  return member.name?.trim() || member.email;
}

export const Route = createFileRoute("/admin/batches")({
  beforeLoad: async () => {
    const [batches, menuItems, planCategories] = await Promise.all([
      fetchAdminBatches(),
      fetchActiveMenuItemsForAdmin(),
      fetchAdminPlanCategoriesWithId(),
    ]);
    return { batches, menuItems, planCategories };
  },
  head: () => ({
    meta: [{ title: "Batches — GOFOFA Ops" }],
  }),
  component: AdminBatchesPage,
});

function AdminBatchesPage() {
  const {
    batches: initialBatches,
    menuItems: initialMenuItems,
    planCategories,
  } = Route.useRouteContext();
  const createFn = useServerFn(createAdminWeeklyBatch);
  const createMenuItemFn = useServerFn(createAdminMenuItemRecord);
  const inventoryFn = useServerFn(fetchBatchInventory);
  const saveCatalogFn = useServerFn(saveAdminBatchCatalog);
  const draftSummariesFn = useServerFn(fetchBatchDraftOrderSummaries);
  const memberDraftFn = useServerFn(fetchBatchMemberDraftOrder);
  const saveMemberDraftFn = useServerFn(saveAdminBatchMemberDraftOrder);
  const generateOrdersFn = useServerFn(generateAdminBatchOrders);
  const openMenuFn = useServerFn(openAdminMenuForSelection);
  const refreshBatchesFn = useServerFn(fetchAdminBatches);
  const mealDemandFn = useServerFn(fetchBatchMealDemand);
  const projectedMealDemandFn = useServerFn(fetchBatchProjectedMealDemand);
  const publishEligibilityFn = useServerFn(fetchBatchPublishEligibility);
  const planningMembersFn = useServerFn(fetchBatchPlanningMembers);
  const lastBatchAddedFn = useServerFn(fetchMenuItemsLastBatchAdded);

  const [batches, setBatches] = useState(initialBatches);
  const [menuItems, setMenuItems] = useState<AdminMenuItemOption[]>(initialMenuItems);
  const [mode, setMode] = useState<PageMode>("list");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<AdminBatchInventoryRow[]>([]);
  const [mealDemand, setMealDemand] = useState<BatchMealDemandRow[]>([]);
  const [publishEligibility, setPublishEligibility] = useState<PublishEligibility | null>(null);
  const [planningMembers, setPlanningMembers] = useState<BatchPlanningMemberRow[]>([]);
  const [draftSummaries, setDraftSummaries] = useState<BatchDraftOrderSummaryRow[]>([]);
  const [lastBatchAddedByMenuItemId, setLastBatchAddedByMenuItemId] = useState<
    Map<string, string | null>
  >(new Map());
  const [quickViewUserId, setQuickViewUserId] = useState<string | null>(null);
  const [quickViewLabel, setQuickViewLabel] = useState<string | null>(null);
  const [creatingMenuItem, setCreatingMenuItem] = useState(false);
  const [menuItemDialogOpen, setMenuItemDialogOpen] = useState(false);
  const [menuItemDialogInitialName, setMenuItemDialogInitialName] = useState("");
  const [menuItemDialogTarget, setMenuItemDialogTarget] = useState<
    "catalog" | "member-order" | null
  >(null);
  const [catalogMenuItemIds, setCatalogMenuItemIds] = useState<Set<string>>(new Set());
  const [createSelectedMenuItemIds, setCreateSelectedMenuItemIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(null);
  const [memberDraft, setMemberDraft] = useState<BatchMemberDraftOrderRow | null>(null);
  const [orderLineDraft, setOrderLineDraft] = useState<Record<string, number>>({});
  const [createBatchDate, setCreateBatchDate] = useState(todayIsoDate);
  const [createPickupDate, setCreatePickupDate] = useState(() =>
    addDaysToIsoDate(todayIsoDate(), 6),
  );
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [loadingMemberDraft, setLoadingMemberDraft] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [savingMemberDraft, setSavingMemberDraft] = useState(false);
  const [generatingOrders, setGeneratingOrders] = useState(false);
  const [openingMenu, setOpeningMenu] = useState(false);
  const [selectionDeadlineLocal, setSelectionDeadlineLocal] = useState(
    defaultSelectionDeadlineLocal,
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedBatch = batches.find((b) => b.id === selectedBatchId) ?? null;
  const canEditBatch = selectedBatch?.status === "planning" || selectedBatch?.status === "draft";
  const catalogItemCount =
    catalogMenuItemIds.size || inventory.filter((row) => row.batchItemId).length;
  const eligibleMembers = publishEligibility?.eligible ?? [];
  const eligibleCount = eligibleMembers.length;
  const excludedInactiveCount = publishEligibility?.excludedInactiveCount ?? 0;
  const unresolvedMembers = publishEligibility?.unresolved ?? [];
  const existingBatchDates = useMemo(
    () => new Set(batches.map((batch) => batch.weekStart)),
    [batches],
  );
  const menuItemNameById = useMemo(
    () => new Map(menuItems.map((item) => [item.id, item.name])),
    [menuItems],
  );
  const createSelectedRows = useMemo(() => {
    return [...createSelectedMenuItemIds]
      .map((menuItemId) => ({
        menuItemId,
        menuItemName: menuItemNameById.get(menuItemId) ?? "Unknown item",
      }))
      .sort((a, b) => a.menuItemName.localeCompare(b.menuItemName));
  }, [createSelectedMenuItemIds, menuItemNameById]);
  const canCreateBatch =
    Boolean(createBatchDate && createPickupDate) &&
    createSelectedRows.length > 0 &&
    !existingBatchDates.has(createBatchDate);
  const catalogRows = useMemo(() => {
    return [...catalogMenuItemIds]
      .map((menuItemId) => {
        const inventoryRow = inventory.find((row) => row.menuItemId === menuItemId);
        return {
          menuItemId,
          menuItemName:
            inventoryRow?.menuItemName ?? menuItemNameById.get(menuItemId) ?? "Unknown item",
        };
      })
      .sort((a, b) => a.menuItemName.localeCompare(b.menuItemName));
  }, [catalogMenuItemIds, inventory, menuItemNameById]);
  const selectedMember =
    planningMembers.find((m) => m.membershipId === selectedMembershipId) ?? null;
  const draftMealTotal = useMemo(
    () => Object.values(orderLineDraft).reduce((sum, qty) => sum + qty, 0),
    [orderLineDraft],
  );
  const draftMemberIds = useMemo(
    () => new Set(draftSummaries.map((summary) => summary.membershipId)),
    [draftSummaries],
  );
  const draftSummaryByMembershipId = useMemo(
    () => new Map(draftSummaries.map((summary) => [summary.membershipId, summary])),
    [draftSummaries],
  );
  const memberDraftLineByMenuItemId = useMemo(
    () => new Map((memberDraft?.lines ?? []).map((line) => [line.menuItemId, line])),
    [memberDraft],
  );
  const savedCatalogMenuItemIds = useMemo(
    () => new Set(inventory.filter((row) => row.batchItemId).map((row) => row.menuItemId)),
    [inventory],
  );
  const activeOrderLines = useMemo(() => {
    return Object.entries(orderLineDraft)
      .filter(([, qty]) => qty > 0)
      .map(([menuItemId, qty]) => {
        const draftLine = memberDraftLineByMenuItemId.get(menuItemId);
        return {
          menuItemId,
          menuItemName:
            draftLine?.menuItemName ?? menuItemNameById.get(menuItemId) ?? "Unknown item",
          unitPriceCents: draftLine?.unitPriceCents ?? 0,
          qty,
        };
      })
      .sort((a, b) => a.menuItemName.localeCompare(b.menuItemName));
  }, [memberDraftLineByMenuItemId, menuItemNameById, orderLineDraft]);
  const openMenuBlockReasons: string[] = [];
  if (!canEditBatch) {
    openMenuBlockReasons.push("Batch is not in planning or draft.");
  }
  if (catalogItemCount === 0) {
    openMenuBlockReasons.push("Save at least one batch menu item before opening selection.");
  }
  if (eligibleCount === 0) {
    openMenuBlockReasons.push(
      "No active memberships with resolved meal allowances are eligible for this batch.",
    );
  }
  const canOpenMenu = openMenuBlockReasons.length === 0;
  const showPlanningMembers = mode === "create" || (mode === "detail" && canEditBatch);
  const canGenerateOrders = canEditBatch && draftSummaries.length > 0;

  const loadPlanningContext = useCallback(async () => {
    const [membersResult, lastAddedResult] = await Promise.allSettled([
      planningMembersFn(),
      lastBatchAddedFn(),
    ]);

    if (membersResult.status === "fulfilled") {
      setPlanningMembers(membersResult.value);
    } else {
      setError(
        membersResult.reason instanceof Error
          ? membersResult.reason.message
          : "Could not load members due for items.",
      );
    }

    if (lastAddedResult.status === "fulfilled") {
      setLastBatchAddedByMenuItemId(
        new Map(lastAddedResult.value.map((row) => [row.menuItemId, row.lastAddedAt])),
      );
    } else if (membersResult.status === "fulfilled") {
      setError(
        lastAddedResult.reason instanceof Error
          ? lastAddedResult.reason.message
          : "Could not load last batch dates.",
      );
    }
  }, [lastBatchAddedFn, planningMembersFn]);

  useEffect(() => {
    if (showPlanningMembers) {
      void loadPlanningContext();
    }
  }, [loadPlanningContext, showPlanningMembers]);

  async function persistCatalogIfNeeded(menuItemIds: string[]): Promise<boolean> {
    if (!selectedBatchId) return false;
    const needsSave = menuItemIds.some((id) => !savedCatalogMenuItemIds.has(id));
    if (!needsSave) return false;

    const nextCatalogIds = new Set(catalogMenuItemIds);
    for (const id of menuItemIds) {
      nextCatalogIds.add(id);
    }

    const rows = await saveCatalogFn({
      data: {
        batchId: selectedBatchId,
        menuItemIds: [...nextCatalogIds],
      },
    });
    setInventory(rows);
    setCatalogMenuItemIds(
      new Set(rows.filter((row) => row.batchItemId).map((row) => row.menuItemId)),
    );
    return true;
  }

  function openMenuItemCreateDialog(name: string, target: "catalog" | "member-order") {
    setMenuItemDialogInitialName(name);
    setMenuItemDialogTarget(target);
    setMenuItemDialogOpen(true);
  }

  async function handleCreateMenuItemFromDialog(data: MenuItemCreateInput) {
    setCreatingMenuItem(true);
    setError(null);
    try {
      const result = await createMenuItemFn({ data });
      const newItem: AdminMenuItemOption = {
        id: result.id,
        name: data.name.trim(),
        note: data.note?.trim() ?? null,
      };
      setMenuItems((prev) => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));

      if (menuItemDialogTarget === "catalog" || mode === "create") {
        if (mode === "create") {
          setCreateSelectedMenuItemIds((prev) => new Set(prev).add(result.id));
        } else {
          setCatalogMenuItemIds((prev) => new Set(prev).add(result.id));
        }
      }

      if (menuItemDialogTarget === "member-order" && selectedBatchId && selectedMembershipId) {
        setCatalogMenuItemIds((prev) => new Set(prev).add(result.id));
        await persistCatalogIfNeeded([result.id]);
        await loadMemberDraft(selectedBatchId, selectedMembershipId);
        setOrderLineDraft((prev) => ({
          ...prev,
          [result.id]: Math.max(1, prev[result.id] ?? 0),
        }));
      }

      setMenuItemDialogOpen(false);
      setMenuItemDialogTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create menu item.");
    } finally {
      setCreatingMenuItem(false);
    }
  }

  async function handleCreateNewMenuItem(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;

    const existing = menuItems.find(
      (item) => item.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      if (mode === "create") {
        setCreateSelectedMenuItemIds((prev) => new Set(prev).add(existing.id));
      } else {
        setCatalogMenuItemIds((prev) => new Set(prev).add(existing.id));
      }
      return;
    }

    if (mode === "detail" && canEditBatch) {
      openMenuItemCreateDialog(trimmed, "catalog");
      return;
    }

    setCreatingMenuItem(true);
    setError(null);
    try {
      const result = await createMenuItemFn({ data: { name: trimmed } });
      const newItem: AdminMenuItemOption = { id: result.id, name: trimmed, note: null };
      setMenuItems((prev) => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
      if (mode === "create") {
        setCreateSelectedMenuItemIds((prev) => new Set(prev).add(result.id));
      } else {
        setCatalogMenuItemIds((prev) => new Set(prev).add(result.id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create menu item.");
    } finally {
      setCreatingMenuItem(false);
    }
  }

  async function handleAddItemToMemberOrder(menuItemId: string) {
    if (!selectedBatchId || !selectedMembershipId) return;
    setError(null);

    try {
      setCatalogMenuItemIds((prev) => new Set(prev).add(menuItemId));
      const catalogSaved = await persistCatalogIfNeeded([menuItemId]);
      if (catalogSaved) {
        await loadMemberDraft(selectedBatchId, selectedMembershipId);
      }
      setOrderLineDraft((prev) => ({
        ...prev,
        [menuItemId]: (prev[menuItemId] ?? 0) + 1,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add item to order.");
    }
  }

  function handleRemoveItemFromMemberOrder(menuItemId: string) {
    setOrderLineDraft((prev) => {
      const next = { ...prev };
      delete next[menuItemId];
      return next;
    });
  }

  function openMemberQuickView(member: BatchPlanningMemberRow) {
    setQuickViewUserId(member.userId);
    setQuickViewLabel(memberLabel(member));
  }

  async function refreshBatches() {
    const next = await refreshBatchesFn();
    setBatches(next);
    return next;
  }

  async function loadDraftSummaries(batchId: string) {
    const summaries = await draftSummariesFn({ data: { batchId } });
    setDraftSummaries(summaries);
    return summaries;
  }

  async function loadMemberDraft(batchId: string, membershipId: string) {
    setLoadingMemberDraft(true);
    setError(null);
    try {
      const draft = await memberDraftFn({ data: { batchId, membershipId } });
      setMemberDraft(draft);
      setOrderLineDraft(
        Object.fromEntries(
          draft.lines.filter((line) => line.qty > 0).map((line) => [line.menuItemId, line.qty]),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load member order draft.");
      setMemberDraft(null);
      setOrderLineDraft({});
    } finally {
      setLoadingMemberDraft(false);
    }
  }

  async function loadInventory(batchId: string, batchStatus?: AdminBatchSummary["status"]) {
    setLoadingInventory(true);
    setError(null);
    try {
      const isPrePublish = batchStatus === "planning" || batchStatus === "draft";
      const [rows, demand, eligibility, summaries] = await Promise.all([
        inventoryFn({ data: { batchId } }),
        isPrePublish
          ? projectedMealDemandFn({ data: { batchId } })
          : mealDemandFn({ data: { batchId } }),
        isPrePublish ? publishEligibilityFn() : Promise.resolve(null),
        isPrePublish ? draftSummariesFn({ data: { batchId } }) : Promise.resolve([]),
      ]);
      setInventory(rows);
      setCatalogMenuItemIds(
        new Set(rows.filter((row) => row.batchItemId).map((row) => row.menuItemId)),
      );
      setMealDemand(demand);
      setPublishEligibility(eligibility);
      setDraftSummaries(summaries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load batch.");
    } finally {
      setLoadingInventory(false);
    }
  }

  async function openBatchDetail(batch: AdminBatchSummary) {
    setSelectedBatchId(batch.id);
    setMode("detail");
    setSelectedMembershipId(null);
    setMemberDraft(null);
    setOrderLineDraft({});
    setMessage(null);
    await loadInventory(batch.id, batch.status);
  }

  function backToList() {
    setMode("list");
    setSelectedBatchId(null);
    setInventory([]);
    setMealDemand([]);
    setPublishEligibility(null);
    setCatalogMenuItemIds(new Set());
    setSelectedMembershipId(null);
    setMemberDraft(null);
    setOrderLineDraft({});
    setDraftSummaries([]);
    setError(null);
    setMessage(null);
  }

  function startCreateMode() {
    setMode("create");
    setCreateBatchDate(todayIsoDate());
    setCreatePickupDate(addDaysToIsoDate(todayIsoDate(), 6));
    setCreateSelectedMenuItemIds(new Set());
    setError(null);
    setMessage(null);
  }

  async function handleCreateBatch() {
    if (!canCreateBatch) return;
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const result = await createFn({
        data: {
          batchDate: createBatchDate,
          pickupDate: createPickupDate,
          menuItemIds: createSelectedRows.map((row) => row.menuItemId),
        },
      });
      const next = await refreshBatches();
      const created = next.find((b) => b.id === result.batchId);
      if (created) {
        await openBatchDetail(created);
      }
      setMessage("Batch created.");
      void loadPlanningContext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create batch.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveCatalog() {
    if (!selectedBatchId || catalogMenuItemIds.size === 0) return;
    setSavingCatalog(true);
    setError(null);
    setMessage(null);
    try {
      const rows = await saveCatalogFn({
        data: {
          batchId: selectedBatchId,
          menuItemIds: [...catalogMenuItemIds],
        },
      });
      setInventory(rows);
      setCatalogMenuItemIds(
        new Set(rows.filter((row) => row.batchItemId).map((row) => row.menuItemId)),
      );
      await refreshBatches();
      if (selectedMembershipId) {
        await loadMemberDraft(selectedBatchId, selectedMembershipId);
      }
      setMessage("Batch menu items saved.");
      void loadPlanningContext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save batch menu items.");
    } finally {
      setSavingCatalog(false);
    }
  }

  async function handleSaveMemberDraft() {
    if (!selectedBatchId || !selectedMembershipId) return;
    setSavingMemberDraft(true);
    setError(null);
    setMessage(null);
    try {
      const lineMenuItemIds = Object.entries(orderLineDraft)
        .filter(([, qty]) => qty > 0)
        .map(([menuItemId]) => menuItemId);
      if (lineMenuItemIds.length > 0) {
        setCatalogMenuItemIds((prev) => {
          const next = new Set(prev);
          for (const id of lineMenuItemIds) next.add(id);
          return next;
        });
        await persistCatalogIfNeeded(lineMenuItemIds);
      }

      const lines = Object.entries(orderLineDraft)
        .filter(([, qty]) => qty > 0)
        .map(([menuItemId, qty]) => ({ menuItemId, qty }));
      const draft = await saveMemberDraftFn({
        data: {
          batchId: selectedBatchId,
          membershipId: selectedMembershipId,
          lines,
        },
      });
      setMemberDraft(draft);
      setOrderLineDraft(
        Object.fromEntries(
          draft.lines.filter((line) => line.qty > 0).map((line) => [line.menuItemId, line.qty]),
        ),
      );
      await loadDraftSummaries(selectedBatchId);
      await refreshBatches();
      setMessage(`Saved draft order for ${memberLabel(selectedMember!)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save member order draft.");
    } finally {
      setSavingMemberDraft(false);
    }
  }

  async function handleGenerateOrders() {
    if (!selectedBatchId) return;
    setGeneratingOrders(true);
    setError(null);
    setMessage(null);
    try {
      const result = await generateOrdersFn({ data: { batchId: selectedBatchId } });
      const next = await refreshBatches();
      const updated = next.find((b) => b.id === selectedBatchId);
      await loadInventory(selectedBatchId, updated?.status);
      if (selectedMembershipId) {
        await loadMemberDraft(selectedBatchId, selectedMembershipId);
      }
      setMessage(`Generated ${result.ordersGenerated} order(s) for customer review.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate orders.");
    } finally {
      setGeneratingOrders(false);
    }
  }

  async function handleOpenMenuForSelection() {
    if (!selectedBatchId) return;
    setOpeningMenu(true);
    setError(null);
    setMessage(null);
    try {
      const result = await openMenuFn({
        data: {
          batchId: selectedBatchId,
          selectionDeadline: localDatetimeToIso(selectionDeadlineLocal),
        },
      });
      const next = await refreshBatches();
      const updated = next.find((b) => b.id === selectedBatchId);
      await loadInventory(selectedBatchId, updated?.status);
      setMessage(`Send to members for selection — ${result.ordersCreated} empty order(s) created.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send batch to members for selection.");
    } finally {
      setOpeningMenu(false);
    }
  }

  async function handleSelectMember(membershipId: string) {
    if (!selectedBatchId) return;
    setSelectedMembershipId(membershipId);
    await loadMemberDraft(selectedBatchId, membershipId);
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Weekly batches</h2>
          <p className="text-sm text-muted-foreground">
            {mode === "list"
              ? "Select a batch to build member orders, send to selection, or create a new batch."
              : mode === "create"
                ? "Set batch and pickup dates, choose catalog items, then create the batch."
                : "Build member orders incrementally, generate orders when ready, or open selection for self-serve picking."}
          </p>
        </div>
        {mode === "list" ? (
          <Button onClick={startCreateMode}>Create new batch</Button>
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
              Set the batch date and pickup date, then choose catalog items for this batch.
              Quantities are assigned per member after the batch is created.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="batch-date">Batch date</Label>
                <Input
                  id="batch-date"
                  type="date"
                  className="w-[200px]"
                  value={createBatchDate}
                  onChange={(e) => {
                    const nextBatchDate = e.target.value;
                    setCreateBatchDate(nextBatchDate);
                    if (nextBatchDate && createPickupDate && createPickupDate < nextBatchDate) {
                      setCreatePickupDate(nextBatchDate);
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickup-date">Pickup date</Label>
                <Input
                  id="pickup-date"
                  type="date"
                  className="w-[200px]"
                  min={createBatchDate || undefined}
                  value={createPickupDate}
                  onChange={(e) => setCreatePickupDate(e.target.value)}
                />
              </div>
            </div>

            {showPlanningMembers ? (
              <BatchPlanningMembersSection
                members={planningMembers}
                onMemberClick={openMemberQuickView}
              />
            ) : null}

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Items in this batch</p>
                <p className="text-sm text-muted-foreground">
                  Search the catalog (type at least 3 characters) or add a new item if it does not
                  exist yet.
                </p>
              </div>
              <WeeklyMenuPicker
                menuItems={menuItems}
                selectedMenuItemIds={createSelectedMenuItemIds}
                creatingItem={creatingMenuItem}
                lastBatchAddedByMenuItemId={lastBatchAddedByMenuItemId}
                onSelect={(menuItemId) =>
                  setCreateSelectedMenuItemIds((prev) => new Set(prev).add(menuItemId))
                }
                onCreateNewItem={handleCreateNewMenuItem}
              />
              {createSelectedRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No items selected yet — search the active menu to build this batch.
                </p>
              ) : (
                <div>
                  <p className="mb-3 text-sm font-medium">
                    Selected items ({createSelectedRows.length})
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Menu item</TableHead>
                        <TableHead>Last in batch</TableHead>
                        <TableHead className="w-[56px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {createSelectedRows.map((row) => (
                        <TableRow key={row.menuItemId}>
                          <TableCell>{row.menuItemName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatLastBatchAdded(lastBatchAddedByMenuItemId.get(row.menuItemId)) ??
                              "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove ${row.menuItemName}`}
                              onClick={() =>
                                setCreateSelectedMenuItemIds((prev) => {
                                  const next = new Set(prev);
                                  next.delete(row.menuItemId);
                                  return next;
                                })
                              }
                            >
                              <X className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button onClick={handleCreateBatch} disabled={creating || !canCreateBatch}>
                {creating ? "Creating…" : "Create batch"}
              </Button>
              {existingBatchDates.has(createBatchDate) ? (
                <p className="text-sm text-muted-foreground">
                  A batch already exists for this batch date.
                </p>
              ) : null}
              {!createBatchDate || !createPickupDate ? (
                <p className="text-sm text-muted-foreground">
                  Batch date and pickup date are required.
                </p>
              ) : createSelectedRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add at least one menu item.</p>
              ) : null}
            </div>
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
                  <TableHead>Pickup date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pickup / delivery</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead>Review deadline</TableHead>
                  <TableHead>Selection deadline</TableHead>
                  <TableHead className="w-[140px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground">
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
                        {batch.pickupDate ? formatDateString(batch.pickupDate, "MMM d, yyyy") : "—"}
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
                        {batch.selectionDeadline
                          ? formatDateString(batch.selectionDeadline, "MMM d, h:mm a")
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
                    {selectedBatch.pickupDate ? (
                      <span>
                        Pickup {formatDateString(selectedBatch.pickupDate, "MMM d, yyyy")}
                      </span>
                    ) : null}
                    <span>{selectedBatch.pickupWindowLabel ?? "No pickup window"}</span>
                    {selectedBatch.reviewDeadline ? (
                      <span>
                        · Review by{" "}
                        {formatDateString(selectedBatch.reviewDeadline, "MMM d, h:mm a")}
                      </span>
                    ) : null}
                    {selectedBatch.selectionDeadline ? (
                      <span>
                        · Selection deadline{" "}
                        {formatDateString(selectedBatch.selectionDeadline, "MMM d, h:mm a")}
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

          {!canEditBatch ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Batch meal demand</CardTitle>
                <CardDescription>Generated and finalized orders for this batch</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {mealDemand.filter((r) => r.qtyNeeded > 0 || r.qtyCooked > 0).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No meal demand recorded for this batch yet.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {mealDemand
                      .filter((r) => r.qtyNeeded > 0 || r.qtyCooked > 0)
                      .slice(0, 12)
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
          ) : null}

          {canEditBatch ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Build member order</CardTitle>
                <CardDescription>
                  Select a member, add items from the catalog, and save drafts incrementally. Review
                  progress across all members before generating orders.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="member-select">Member</Label>
                      <Select
                        value={selectedMembershipId ?? undefined}
                        onValueChange={(value) => void handleSelectMember(value)}
                        disabled={loadingInventory || planningMembers.length === 0}
                      >
                        <SelectTrigger id="member-select" className="w-full">
                          <SelectValue placeholder="Choose a member…" />
                        </SelectTrigger>
                        <SelectContent>
                          {planningMembers.map((member) => (
                            <SelectItem key={member.membershipId} value={member.membershipId}>
                              {memberLabel(member)}
                              {draftMemberIds.has(member.membershipId) ? " · draft saved" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedMember ? (
                      <div className="text-sm text-muted-foreground">
                        <p>{selectedMember.planName ?? "No plan"}</p>
                        <p>
                          {selectedMember.mealsPerWeek} meals/wk ·{" "}
                          {formatPortionLabel(selectedMember.portionDefault)}
                        </p>
                      </div>
                    ) : null}

                    {!selectedMember ? (
                      <p className="text-sm text-muted-foreground">
                        Choose a member to start building their order.
                      </p>
                    ) : loadingMemberDraft ? (
                      <p className="text-sm text-muted-foreground">Loading order draft…</p>
                    ) : (
                      <>
                        <MemberOrderItemPicker
                          menuItems={menuItems}
                          disabled={loadingMemberDraft || savingMemberDraft}
                          lastBatchAddedByMenuItemId={lastBatchAddedByMenuItemId}
                          onSelect={(menuItemId) => void handleAddItemToMemberOrder(menuItemId)}
                          onRequestCreateNew={(name) =>
                            openMenuItemCreateDialog(name, "member-order")
                          }
                        />

                        {activeOrderLines.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No items in this order yet — search above to add meals.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Menu item</TableHead>
                                  <TableHead className="w-[120px] text-right">Unit price</TableHead>
                                  <TableHead className="w-[120px] text-right">Quantity</TableHead>
                                  <TableHead className="w-[56px]" />
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {activeOrderLines.map((line) => (
                                  <TableRow key={line.menuItemId}>
                                    <TableCell>{line.menuItemName}</TableCell>
                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                      {line.unitPriceCents > 0
                                        ? centsToLabel(line.unitPriceCents)
                                        : "No price"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Input
                                        type="number"
                                        min={0}
                                        max={999}
                                        className="ml-auto w-24 text-right tabular-nums"
                                        value={orderLineDraft[line.menuItemId] ?? 0}
                                        onChange={(e) => {
                                          const qty = Number(e.target.value) || 0;
                                          setOrderLineDraft((prev) => ({
                                            ...prev,
                                            [line.menuItemId]: qty,
                                          }));
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Remove ${line.menuItemName}`}
                                        onClick={() =>
                                          handleRemoveItemFromMemberOrder(line.menuItemId)
                                        }
                                      >
                                        <X className="size-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-4">
                          <Button
                            onClick={handleSaveMemberDraft}
                            disabled={savingMemberDraft || loadingMemberDraft}
                          >
                            {savingMemberDraft ? "Saving…" : "Save member draft"}
                          </Button>
                          <p className="text-sm text-muted-foreground">
                            {draftMealTotal} meal(s) selected
                            {selectedMember.mealsPerWeek > 0
                              ? ` · allowance ${selectedMember.mealsPerWeek}/wk`
                              : ""}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <MemberQuickViewPanel
                    userId={selectedMember?.userId ?? null}
                    memberLabel={selectedMember ? memberLabel(selectedMember) : null}
                    compact
                  />
                </div>

                <div className="space-y-3 rounded-md border border-border p-4">
                  <div>
                    <p className="text-sm font-medium">Order-building progress</p>
                    <p className="text-sm text-muted-foreground">
                      {draftSummaries.length} saved draft order(s) · {eligibleCount} eligible
                      member(s) · {catalogItemCount} menu item(s) in batch
                    </p>
                  </div>
                  <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-md border border-border px-3 py-2">
                      <p className="text-muted-foreground">Draft orders saved</p>
                      <p className="font-medium tabular-nums">{draftSummaries.length}</p>
                    </div>
                    <div className="rounded-md border border-border px-3 py-2">
                      <p className="text-muted-foreground">Eligible members</p>
                      <p className="font-medium tabular-nums">{eligibleCount}</p>
                    </div>
                    <div className="rounded-md border border-border px-3 py-2">
                      <p className="text-muted-foreground">Batch menu items</p>
                      <p className="font-medium tabular-nums">{catalogItemCount}</p>
                    </div>
                  </div>
                  {planningMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No eligible active members yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Member</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead className="text-right">Allowance</TableHead>
                            <TableHead>Progress</TableHead>
                            <TableHead className="w-[100px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {planningMembers.map((member) => {
                            const summary = draftSummaryByMembershipId.get(member.membershipId);
                            const progress = memberDraftProgressLabel(member, summary);
                            const label = memberLabel(member);
                            return (
                              <TableRow
                                key={member.membershipId}
                                className={
                                  selectedMembershipId === member.membershipId ? "bg-muted/40" : ""
                                }
                              >
                                <TableCell className="font-medium">{label}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {member.planName ?? "—"}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {member.mealsPerWeek}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={progress.complete ? "default" : "outline"}>
                                    {progress.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={
                                      selectedMembershipId === member.membershipId
                                        ? "secondary"
                                        : "outline"
                                    }
                                    onClick={() => void handleSelectMember(member.membershipId)}
                                  >
                                    {selectedMembershipId === member.membershipId
                                      ? "Editing"
                                      : summary
                                        ? "Review"
                                        : "Build"}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {unresolvedMembers.length > 0 ? (
                    <p className="text-sm text-destructive">
                      {unresolvedMembers.length} active membership
                      {unresolvedMembers.length === 1 ? "" : "s"} missing meals per week.
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {canEditBatch ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Send to members for selection</CardTitle>
                <CardDescription>
                  Alternative to chef-built orders — creates one empty order per eligible membership
                  so customers can choose meals themselves.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label htmlFor="selection-deadline">Selection deadline</Label>
                  <Input
                    id="selection-deadline"
                    type="datetime-local"
                    className="w-[260px]"
                    value={selectionDeadlineLocal}
                    onChange={(e) => setSelectionDeadlineLocal(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleOpenMenuForSelection}
                  disabled={!canOpenMenu || openingMenu || loadingInventory}
                >
                  {openingMenu ? "Sending…" : "Send to members for selection"}
                </Button>
              </CardContent>
              {!canOpenMenu && openMenuBlockReasons.length > 0 ? (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">{openMenuBlockReasons.join(" ")}</p>
                </CardContent>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Batch menu items</CardTitle>
                  <CardDescription>
                    Catalog items available for this batch. Item editing locks after selection
                    opens.
                  </CardDescription>
                </div>
                {canEditBatch ? (
                  <Button
                    variant="outline"
                    onClick={handleSaveCatalog}
                    disabled={savingCatalog || loadingInventory || catalogMenuItemIds.size === 0}
                  >
                    {savingCatalog ? "Saving…" : "Save menu items"}
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {canEditBatch ? (
                <WeeklyMenuPicker
                  menuItems={menuItems}
                  selectedMenuItemIds={catalogMenuItemIds}
                  disabled={loadingInventory}
                  creatingItem={creatingMenuItem}
                  lastBatchAddedByMenuItemId={lastBatchAddedByMenuItemId}
                  onSelect={(menuItemId) =>
                    setCatalogMenuItemIds((prev) => new Set(prev).add(menuItemId))
                  }
                  onCreateNewItem={handleCreateNewMenuItem}
                />
              ) : null}
              {loadingInventory ? (
                <p className="text-sm text-muted-foreground">Loading batch items…</p>
              ) : catalogRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {canEditBatch
                    ? "No items selected yet — search the active menu to build this batch."
                    : "No menu items saved for this batch."}
                </p>
              ) : (
                <div>
                  <p className="mb-3 text-sm font-medium">Selected items ({catalogRows.length})</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Menu item</TableHead>
                        <TableHead>Last in batch</TableHead>
                        {canEditBatch ? <TableHead className="w-[56px]" /> : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {catalogRows.map((row) => (
                        <TableRow key={row.menuItemId}>
                          <TableCell>{row.menuItemName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatLastBatchAdded(lastBatchAddedByMenuItemId.get(row.menuItemId)) ??
                              "—"}
                          </TableCell>
                          {canEditBatch ? (
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Remove ${row.menuItemName}`}
                                onClick={() =>
                                  setCatalogMenuItemIds((prev) => {
                                    const next = new Set(prev);
                                    next.delete(row.menuItemId);
                                    return next;
                                  })
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

          {canEditBatch ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Generate orders</CardTitle>
                <CardDescription>
                  Final step — validates pricing and membership plans, then creates customer-review
                  orders from saved drafts and updates batch quantities.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={handleGenerateOrders}
                  disabled={!canGenerateOrders || generatingOrders || loadingInventory}
                >
                  {generatingOrders ? "Generating…" : "Generate orders"}
                </Button>
                {draftSummaries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Save at least one member draft order before generating.
                  </p>
                ) : null}
                {excludedInactiveCount > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {excludedInactiveCount} paused or cancelled membership
                    {excludedInactiveCount === 1 ? "" : "s"} excluded.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      <MenuItemCreateDialog
        open={menuItemDialogOpen}
        initialName={menuItemDialogInitialName}
        planCategories={planCategories}
        saving={creatingMenuItem}
        onOpenChange={(open) => {
          setMenuItemDialogOpen(open);
          if (!open) setMenuItemDialogTarget(null);
        }}
        onCreate={handleCreateMenuItemFromDialog}
      />

      <MemberQuickViewSheet
        userId={quickViewUserId}
        memberLabel={quickViewLabel}
        onOpenChange={(open) => {
          if (!open) {
            setQuickViewUserId(null);
            setQuickViewLabel(null);
          }
        }}
      />
    </>
  );
}

function BatchPlanningMembersSection({
  members,
  onMemberClick,
}: {
  members: BatchPlanningMemberRow[];
  onMemberClick: (member: BatchPlanningMemberRow) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div>
        <p className="text-sm font-medium">Members due for items</p>
        <p className="text-sm text-muted-foreground">
          Active memberships sorted by last order date — click a name for quick profile details.
        </p>
      </div>
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No eligible active members yet.{" "}
          <Link
            to="/admin/memberships"
            search={{ userId: undefined, add: undefined }}
            className="text-primary underline-offset-4 hover:underline"
          >
            Activate a membership
          </Link>
          .
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Last ordered</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Meals/wk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const label = memberLabel(member);
              return (
                <TableRow key={member.membershipId}>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => onMemberClick(member)}
                    >
                      {label}
                    </button>
                    {member.name?.trim() ? (
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.lastOrderedDate
                      ? formatDateString(member.lastOrderedDate, "MMM d, yyyy")
                      : "Never"}
                  </TableCell>
                  <TableCell>{member.planName ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{member.mealsPerWeek}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
