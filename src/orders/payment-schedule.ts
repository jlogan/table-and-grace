import type { PaymentSchedule } from "@/db/schema/payment-schedules.ts";

/** Resolve live payment schedule: membership when scoped, else customer profile fallback. */
export function resolveOrderPaymentSchedule(input: {
  paymentScheduleSnapshot: PaymentSchedule | null;
  membershipPaymentSchedule?: PaymentSchedule | null;
  profilePaymentSchedule?: PaymentSchedule | null;
}): PaymentSchedule {
  if (input.paymentScheduleSnapshot) {
    return input.paymentScheduleSnapshot;
  }
  if (input.membershipPaymentSchedule) {
    return input.membershipPaymentSchedule;
  }
  return input.profilePaymentSchedule ?? "weekly_autopay";
}
