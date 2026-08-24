import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AdminMenuItemOption } from "@/orders/admin-types";
import { cn } from "@/lib/utils";

type WeeklyMenuPickerProps = {
  menuItems: AdminMenuItemOption[];
  selectedMenuItemIds: Set<string>;
  disabled?: boolean;
  onSelect: (menuItemId: string) => void;
};

export function WeeklyMenuPicker({
  menuItems,
  selectedMenuItemIds,
  disabled,
  onSelect,
}: WeeklyMenuPickerProps) {
  const [open, setOpen] = useState(false);

  const availableItems = menuItems.filter((item) => !selectedMenuItemIds.has(item.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || availableItems.length === 0}
          className="w-full max-w-md justify-between sm:w-[320px]"
        >
          <span className="flex items-center gap-2 truncate">
            <Plus className="size-4 shrink-0" />
            Add meal to weekly menu
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search active menu…" />
          <CommandList>
            <CommandEmpty>No matching menu items.</CommandEmpty>
            <CommandGroup>
              {availableItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.name} ${item.note ?? ""}`}
                  onSelect={() => {
                    onSelect(item.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 size-4 opacity-0")} />
                  <span className="truncate">{item.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
