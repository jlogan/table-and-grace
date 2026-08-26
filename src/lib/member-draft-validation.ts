export function sumMemberDraftOrderMeals(lines: ReadonlyArray<{ qty: number }>): number {
  return lines.reduce((sum, line) => sum + (line.qty > 0 ? Math.floor(line.qty) : 0), 0);
}

/** Validate admin member draft meal total against membership allowance (source of truth). */
export function validateMemberDraftOrderMeals(totalMeals: number, mealsPerWeek: number): void {
  if (mealsPerWeek <= 0) {
    throw new Error("Meal allowance is not available for this member.");
  }
  if (totalMeals <= 0) {
    throw new Error("Add at least one meal before saving this draft.");
  }
  if (totalMeals > mealsPerWeek) {
    throw new Error(`This order exceeds the member's ${mealsPerWeek}-meal allowance.`);
  }
}

export function getMemberDraftOrderSaveState(input: { totalMeals: number; mealsPerWeek: number }): {
  canSave: boolean;
  blockedReason: string | null;
} {
  try {
    validateMemberDraftOrderMeals(input.totalMeals, input.mealsPerWeek);
    return { canSave: true, blockedReason: null };
  } catch (error) {
    return {
      canSave: false,
      blockedReason: error instanceof Error ? error.message : "Cannot save this draft.",
    };
  }
}
