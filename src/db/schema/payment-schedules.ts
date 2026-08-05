/** Reusable payment schedule enums shared by customer profiles and weekly orders. */

export const paymentSchedules = ["weekly_autopay", "monthly_autopay", "manual_per_order"] as const;
export type PaymentSchedule = (typeof paymentSchedules)[number];

export const paymentScheduleSetBy = ["customer", "admin"] as const;
export type PaymentScheduleSetBy = (typeof paymentScheduleSetBy)[number];
