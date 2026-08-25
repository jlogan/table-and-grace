import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { AdminPlanCategoryWithId } from "@/orders/admin-types";

export type MenuItemCreateInput = {
  name: string;
  note?: string;
  categoryId?: string;
  price4ozCents?: number;
  price6ozCents?: number;
};

type MenuItemCreateDialogProps = {
  open: boolean;
  initialName?: string;
  planCategories: AdminPlanCategoryWithId[];
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: MenuItemCreateInput) => Promise<void>;
};

function dollarsToCents(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 100);
}

export function MenuItemCreateDialog({
  open,
  initialName = "",
  planCategories,
  saving = false,
  onOpenChange,
  onCreate,
}: MenuItemCreateDialogProps) {
  const [name, setName] = useState(initialName);
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price4oz, setPrice4oz] = useState("");
  const [price6oz, setPrice6oz] = useState("");

  useEffect(() => {
    if (open) {
      setName(initialName);
      setNote("");
      setCategoryId("");
      setPrice4oz("");
      setPrice6oz("");
    }
  }, [initialName, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    await onCreate({
      name: trimmed,
      note: note.trim() || undefined,
      categoryId: categoryId || undefined,
      price4ozCents: dollarsToCents(price4oz),
      price6ozCents: dollarsToCents(price6oz),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add menu item</DialogTitle>
          <DialogDescription>
            New items are added to the active catalog and can be included in this batch and member
            orders. Pricing can inherit from category or override per portion.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-2">
            <Label htmlFor="dialog-item-name">Name</Label>
            <Input
              id="dialog-item-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Grilled salmon"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dialog-item-category">Category</Label>
            <Select
              value={categoryId || "none"}
              onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}
            >
              <SelectTrigger id="dialog-item-category">
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

          <div className="space-y-2">
            <Label htmlFor="dialog-item-note">Note</Label>
            <Textarea
              id="dialog-item-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional description or prep note"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dialog-item-price-4oz">4 oz price ($)</Label>
              <Input
                id="dialog-item-price-4oz"
                type="number"
                min={0}
                step={0.01}
                value={price4oz}
                onChange={(e) => setPrice4oz(e.target.value)}
                placeholder="Inherit from category"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-item-price-6oz">6 oz price ($)</Label>
              <Input
                id="dialog-item-price-6oz"
                type="number"
                min={0}
                step={0.01}
                value={price6oz}
                onChange={(e) => setPrice6oz(e.target.value)}
                placeholder="Inherit from category"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add item"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
