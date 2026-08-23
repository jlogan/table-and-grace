import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { AdminCustomerDetail } from "@/orders/admin-types";
import {
  hasPreviousFoodInformation,
  type FoodProfileFormState,
} from "@/lib/customer-food-profile-form";
import {
  dietaryPreferenceLabel,
  dietaryPreferenceOptions,
  foodAllergenLabel,
  foodAllergenOptions,
} from "@/lib/food-profile";

function formatPortionDefault(portion: PortionDefault): string {
  return portion === "4oz" ? "4 oz" : "6 oz";
}

function toggleSlug<T extends string>(selected: T[], slug: T, checked: boolean): T[] {
  if (checked) {
    return selected.includes(slug) ? selected : [...selected, slug];
  }
  return selected.filter((value) => value !== slug);
}

function CheckboxOptionGrid<T extends string>({
  options,
  selected,
  onToggle,
  idPrefix,
}: {
  options: ReadonlyArray<{ slug: T; label: string }>;
  selected: T[];
  onToggle: (slug: T, checked: boolean) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {options.map((option) => {
        const inputId = `${idPrefix}-${option.slug}`;
        return (
          <div key={option.slug} className="flex items-center gap-2">
            <Checkbox
              id={inputId}
              checked={selected.includes(option.slug)}
              onCheckedChange={(checked) => onToggle(option.slug, checked === true)}
            />
            <Label htmlFor={inputId} className="cursor-pointer font-normal">
              {option.label}
            </Label>
          </div>
        );
      })}
    </div>
  );
}

export function PreviousFoodInformation({
  customer,
  className,
}: {
  customer: AdminCustomerDetail;
  className?: string;
}) {
  if (!hasPreviousFoodInformation(customer)) {
    return null;
  }

  return (
    <div className={className}>
      <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-4">
        <h4 className="text-sm font-medium text-foreground">Previous food information</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Legacy records kept for reference. Not converted into the structured profile below.
        </p>
        <dl className="mt-3 space-y-3">
          {customer.dietaryTags.length > 0 ? (
            <div className="space-y-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Previous dietary tags
              </dt>
              <dd className="text-sm">
                <ul className="flex flex-wrap gap-1.5">
                  {customer.dietaryTags.map((tag) => (
                    <li key={tag}>
                      <Badge variant="outline">{tag}</Badge>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {customer.allergies?.trim() ? (
            <div className="space-y-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Previous allergy notes
              </dt>
              <dd className="whitespace-pre-wrap text-sm text-foreground">{customer.allergies}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

export function FoodProfileEditFields({
  form,
  onChange,
}: {
  form: FoodProfileFormState;
  onChange: (next: FoodProfileFormState) => void;
}) {
  function update<K extends keyof FoodProfileFormState>(key: K, value: FoodProfileFormState[K]) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="profile-portion">Default portion</Label>
        <Select
          value={form.portionDefault}
          onValueChange={(value) => update("portionDefault", value as PortionDefault)}
        >
          <SelectTrigger id="profile-portion" className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="4oz">4 oz</SelectItem>
            <SelectItem value="6oz">6 oz</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Dietary preferences</Label>
          <p className="text-xs text-muted-foreground">Select all that apply.</p>
        </div>
        <CheckboxOptionGrid
          idPrefix="dietary-preference"
          options={dietaryPreferenceOptions}
          selected={form.dietaryPreferences}
          onToggle={(slug, checked) =>
            update("dietaryPreferences", toggleSlug(form.dietaryPreferences, slug, checked))
          }
        />
        {form.dietaryPreferences.includes("other") ? (
          <div className="space-y-2">
            <Label htmlFor="dietary-preference-other">Other dietary preference</Label>
            <Input
              id="dietary-preference-other"
              value={form.dietaryPreferenceOther}
              onChange={(e) => update("dietaryPreferenceOther", e.target.value)}
              placeholder="Describe other preference"
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
        <div>
          <Label className="text-destructive">Food allergies</Label>
          <p className="text-xs text-muted-foreground">
            Safety information — select all allergens that apply.
          </p>
        </div>
        <CheckboxOptionGrid
          idPrefix="food-allergen"
          options={foodAllergenOptions}
          selected={form.foodAllergens}
          onToggle={(slug, checked) =>
            update("foodAllergens", toggleSlug(form.foodAllergens, slug, checked))
          }
        />
        {form.foodAllergens.includes("other") ? (
          <div className="space-y-2">
            <Label htmlFor="food-allergen-other">Other allergen</Label>
            <Input
              id="food-allergen-other"
              value={form.foodAllergenOther}
              onChange={(e) => update("foodAllergenOther", e.target.value)}
              placeholder="Describe other allergen"
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-chef-notes">Chef notes</Label>
        <Textarea
          id="profile-chef-notes"
          value={form.chefNotes}
          onChange={(e) => update("chefNotes", e.target.value)}
          rows={8}
        />
      </div>
    </div>
  );
}

export function FoodProfileReadOnlyView({ customer }: { customer: AdminCustomerDetail }) {
  const hasStructuredAllergens =
    customer.foodAllergens.length > 0 || Boolean(customer.foodAllergenOther?.trim());
  const hasStructuredPreferences =
    customer.dietaryPreferences.length > 0 || Boolean(customer.dietaryPreferenceOther?.trim());

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Default portion
        </dt>
        <dd className="text-sm text-foreground">{formatPortionDefault(customer.portionDefault)}</dd>
      </div>

      <div className="space-y-1">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Dietary preferences
        </dt>
        <dd className="text-sm">
          {hasStructuredPreferences ? (
            <ul className="flex flex-wrap gap-1.5">
              {customer.dietaryPreferences.map((slug) => (
                <li key={slug}>
                  <Badge variant="secondary">{dietaryPreferenceLabel(slug)}</Badge>
                </li>
              ))}
              {customer.dietaryPreferenceOther?.trim() ? (
                <li>
                  <Badge variant="secondary">Other: {customer.dietaryPreferenceOther.trim()}</Badge>
                </li>
              ) : null}
            </ul>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </dd>
      </div>

      <div className="space-y-2">
        <dt className="text-xs font-semibold uppercase tracking-wide text-destructive">
          Food allergies — safety information
        </dt>
        <dd>
          {hasStructuredAllergens ? (
            <Alert variant="destructive" className="bg-destructive/5">
              <AlertTriangle className="size-4" />
              <AlertTitle>Allergens on file</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {customer.foodAllergens.map((slug) => (
                    <li key={slug}>
                      <Badge variant="destructive">{foodAllergenLabel(slug)}</Badge>
                    </li>
                  ))}
                  {customer.foodAllergenOther?.trim() ? (
                    <li>
                      <Badge variant="destructive">
                        Other: {customer.foodAllergenOther.trim()}
                      </Badge>
                    </li>
                  ) : null}
                </ul>
              </AlertDescription>
            </Alert>
          ) : (
            <span className="text-sm text-muted-foreground">No structured allergens on file.</span>
          )}
        </dd>
      </div>

      <div className="space-y-1">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Chef notes
        </dt>
        <dd className="whitespace-pre-wrap text-sm text-foreground">
          {customer.chefNotes?.trim() ? customer.chefNotes : "—"}
        </dd>
      </div>

      <PreviousFoodInformation customer={customer} />
    </div>
  );
}
