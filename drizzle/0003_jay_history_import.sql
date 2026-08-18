ALTER TABLE `weekly_orders` ADD `tip_cents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD `receipt_number` varchar(32);--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD `external_order_number` varchar(64);--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD `imported_at` timestamp;