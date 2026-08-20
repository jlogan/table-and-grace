ALTER TABLE `memberships` ADD `plan_slug` varchar(64);--> statement-breakpoint
ALTER TABLE `memberships` ADD `meals_per_week` int;--> statement-breakpoint
ALTER TABLE `memberships` ADD `portion_default` enum('4oz','6oz') DEFAULT '6oz' NOT NULL;--> statement-breakpoint
ALTER TABLE `memberships` ADD `payment_schedule` enum('weekly_autopay','monthly_autopay','manual_per_order') DEFAULT 'weekly_autopay' NOT NULL;--> statement-breakpoint
ALTER TABLE `memberships` ADD `billing_profile` enum('catalog','fixed_price') DEFAULT 'catalog' NOT NULL;--> statement-breakpoint
ALTER TABLE `memberships` ADD `fixed_price_per_meal_cents` int;--> statement-breakpoint
ALTER TABLE `memberships` ADD `discount_cents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `memberships` m
INNER JOIN `customer_profiles` cp ON cp.user_id = m.user_id
SET
  m.portion_default = cp.portion_default,
  m.payment_schedule = cp.payment_schedule;
