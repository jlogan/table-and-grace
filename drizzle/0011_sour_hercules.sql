ALTER TABLE `weekly_batches` MODIFY COLUMN `status` enum('planning','draft','selection_open','pending_customer_review','approved','charging','closed') NOT NULL DEFAULT 'planning';--> statement-breakpoint
ALTER TABLE `weekly_orders` MODIFY COLUMN `status` enum('draft','awaiting_selection','selection_in_progress','selection_submitted','pending_customer_review','changes_requested','approved','charging','ready_for_pickup','picked_up','payment_failed','skipped') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `weekly_batches` ADD `selection_deadline` timestamp;--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD `selection_submitted_at` timestamp;--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD `meals_allowed_snapshot` int;--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD `portion_snapshot` enum('4oz','6oz');--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD `plan_slug_snapshot` varchar(64);--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD `plan_name_snapshot` varchar(255);