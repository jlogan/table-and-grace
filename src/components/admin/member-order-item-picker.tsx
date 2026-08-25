import { Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { formatLastBatchAdded } from "@/lib/batch-date-labels";
import { cn } from "@/lib/utils";
import type { AdminMenuItemOption } from "@/orders/admin-types";

const MIN_SEARCH_LENGTH = 3;

type MemberOrderItemPickerProps = {
  menuItems: AdminMenuItemOption[];
  disabled?: boolean;
  lastBatchAddedByMenuItemId?: Map<string, string | null>;
  onSelect: (menuItemId: string) => void;
  onRequestCreateNew?: (name: string) => void;
};

export function MemberOrderItemPicker({
  menuItems,
  disabled,
  lastBatchAddedByMenuItemId,
  onSelect,
  onRequestCreateNew,
}: MemberOrderItemPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= MIN_SEARCH_LENGTH;

  const matchingItems = useMemo(() => {
    if (!canSearch) return [];
    const needle = trimmedQuery.toLowerCase();
    return menuItems.filter((item) => {
      const haystack = `${item.name} ${item.note ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [canSearch, menuItems, trimmedQuery]);

  const hasExactMatch = useMemo(() => {
    if (!canSearch) return false;
    const needle = trimmedQuery.toLowerCase();
    return menuItems.some((item) => item.name.trim().toLowerCase() === needle);
  }, [canSearch, menuItems, trimmedQuery]);

  const showAddNew =
    canSearch && !hasExactMatch && Boolean(onRequestCreateNew) && trimmedQuery.length > 0;

  function handleSelectItem(menuItemId: string) {
    onSelect(menuItemId);
    setQuery("");
    setOpen(false);
  }

  function handleRequestCreateNew() {
    if (!onRequestCreateNew || !trimmedQuery) return;
    onRequestCreateNew(trimmedQuery);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">Add items to order</p>
      <p className="text-sm text-muted-foreground">
        Search the catalog (min. 3 characters) or add a new menu item with full details.
      </p>
      <div className="relative w-full max-w-md">
        <div className="relative">
          <Plus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            role="combobox"
            aria-expanded={open && canSearch}
            aria-autocomplete="list"
            disabled={disabled}
            placeholder="Type to search items…"
            className="pl-9"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setOpen(false), 150);
            }}
          />
        </div>

        {open && canSearch ? (
          <div
            className={cn(
              "absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md",
            )}
          >
            <Command shouldFilter={false}>
              <CommandList>
                {matchingItems.length === 0 && !showAddNew ? (
                  <CommandEmpty>No matching menu items.</CommandEmpty>
                ) : null}
                {matchingItems.length > 0 ? (
                  <CommandGroup heading="Menu items">
                    {matchingItems.map((item) => {
                      const lastAdded = formatLastBatchAdded(
                        lastBatchAddedByMenuItemId?.get(item.id),
                      );
                      return (
                        <CommandItem
                          key={item.id}
                          value={item.id}
                          onSelect={() => handleSelectItem(item.id)}
                        >
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate">{item.name}</span>
                            {lastAdded ? (
                              <span className="text-xs text-muted-foreground">
                                Last in batch {lastAdded}
                              </span>
                            ) : null}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ) : null}
                {showAddNew ? (
                  <CommandGroup>
                    <CommandItem
                      value={`add-new-${trimmedQuery}`}
                      onSelect={handleRequestCreateNew}
                    >
                      <span className="font-medium">Add new item: {trimmedQuery}</span>
                    </CommandItem>
                  </CommandGroup>
                ) : null}
              </CommandList>
            </Command>
          </div>
        ) : null}

        {open && !canSearch && trimmedQuery.length > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Type {MIN_SEARCH_LENGTH - trimmedQuery.length} more character
            {MIN_SEARCH_LENGTH - trimmedQuery.length === 1 ? "" : "s"} to search.
          </p>
        ) : null}
      </div>
    </div>
  );
}
