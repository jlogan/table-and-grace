CREATE TABLE `invoice_lines` (
	`id` varchar(36) NOT NULL,
	`invoice_id` varchar(36) NOT NULL,
	`order_line_id` varchar(36),
	`stripe_price_id` varchar(36),
	`stripe_invoice_line_item_id` varchar(255),
	`description` text NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unit_amount_cents` int NOT NULL DEFAULT 0,
	`amount_cents` int NOT NULL DEFAULT 0,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoice_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoice_lines_stripe_line_item_id_idx` UNIQUE(`stripe_invoice_line_item_id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36),
	`user_id` varchar(36) NOT NULL,
	`membership_id` varchar(36),
	`stripe_invoice_id` varchar(255),
	`stripe_payment_intent_id` varchar(255),
	`stripe_charge_id` varchar(255),
	`stripe_customer_id` varchar(255) NOT NULL,
	`default_payment_method_id` varchar(36),
	`status` enum('draft','open','paid','void','uncollectible') NOT NULL DEFAULT 'draft',
	`source` enum('app_batch','stripe_dashboard') NOT NULL DEFAULT 'app_batch',
	`collection_method` enum('charge_automatically','send_invoice') NOT NULL DEFAULT 'charge_automatically',
	`subtotal_cents` int NOT NULL DEFAULT 0,
	`tax_cents` int NOT NULL DEFAULT 0,
	`total_cents` int NOT NULL DEFAULT 0,
	`amount_due_cents` int NOT NULL DEFAULT 0,
	`amount_paid_cents` int NOT NULL DEFAULT 0,
	`hosted_invoice_url` varchar(2048),
	`invoice_pdf_url` varchar(2048),
	`due_at` timestamp,
	`finalized_at` timestamp,
	`paid_at` timestamp,
	`voided_at` timestamp,
	`last_payment_error_code` varchar(64),
	`last_payment_error_message` text,
	`attempt_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_order_id_idx` UNIQUE(`order_id`),
	CONSTRAINT `invoices_stripe_invoice_id_idx` UNIQUE(`stripe_invoice_id`),
	CONSTRAINT `invoices_stripe_payment_intent_id_idx` UNIQUE(`stripe_payment_intent_id`),
	CONSTRAINT `invoices_stripe_charge_id_idx` UNIQUE(`stripe_charge_id`)
);
--> statement-breakpoint
CREATE TABLE `stripe_prices` (
	`id` varchar(36) NOT NULL,
	`stripe_product_id` varchar(36) NOT NULL,
	`stripe_price_id` varchar(255) NOT NULL,
	`unit_amount_cents` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripe_prices_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripe_prices_stripe_price_id_idx` UNIQUE(`stripe_price_id`)
);
--> statement-breakpoint
CREATE TABLE `stripe_products` (
	`id` varchar(36) NOT NULL,
	`menu_item_id` varchar(36) NOT NULL,
	`portion` enum('4oz','6oz') NOT NULL,
	`stripe_product_id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripe_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripe_products_stripe_product_id_idx` UNIQUE(`stripe_product_id`),
	CONSTRAINT `stripe_products_menu_item_portion_idx` UNIQUE(`menu_item_id`,`portion`)
);
--> statement-breakpoint
ALTER TABLE `weekly_orders` MODIFY COLUMN `status` enum('draft','awaiting_selection','selection_in_progress','selection_submitted','finalized','pending_customer_review','changes_requested','approved','charging','ready_for_pickup','picked_up','payment_failed','skipped') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `charges` ADD `invoice_id` varchar(36);--> statement-breakpoint
ALTER TABLE `charges` ADD `stripe_charge_id` varchar(255);--> statement-breakpoint
ALTER TABLE `charges` ADD `payment_method_id` varchar(36);--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `stripe_customer_metadata` json;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `stripe_customer_metadata_updated_at` timestamp;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `stripe_customer_synced_at` timestamp;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `stripe_customer_sync_error` text;--> statement-breakpoint
ALTER TABLE `memberships` ADD `default_payment_method_id` varchar(36);--> statement-breakpoint
ALTER TABLE `payment_methods` ADD `stripe_customer_id` varchar(255);--> statement-breakpoint
ALTER TABLE `payment_methods` ADD `status` enum('active','detached','expired','requires_action') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_methods` ADD `last_used_at` timestamp;--> statement-breakpoint
ALTER TABLE `payment_methods` ADD `detached_at` timestamp;--> statement-breakpoint
ALTER TABLE `payment_methods` ADD `last_failure_at` timestamp;--> statement-breakpoint
ALTER TABLE `payment_methods` ADD `last_failure_reason` text;--> statement-breakpoint
ALTER TABLE `stripe_events` ADD `livemode` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD `payment_method_id` varchar(36);--> statement-breakpoint
ALTER TABLE `charges` ADD CONSTRAINT `charges_stripe_payment_intent_id_idx` UNIQUE(`stripe_payment_intent_id`);--> statement-breakpoint
ALTER TABLE `charges` ADD CONSTRAINT `charges_stripe_charge_id_idx` UNIQUE(`stripe_charge_id`);--> statement-breakpoint
ALTER TABLE `payment_methods` ADD CONSTRAINT `payment_methods_stripe_pm_id_idx` UNIQUE(`stripe_pm_id`);--> statement-breakpoint
ALTER TABLE `payment_methods` ADD CONSTRAINT `payment_methods_user_stripe_pm_id_idx` UNIQUE(`user_id`,`stripe_pm_id`);--> statement-breakpoint
ALTER TABLE `invoice_lines` ADD CONSTRAINT `invoice_lines_invoice_id_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice_lines` ADD CONSTRAINT `invoice_lines_order_line_id_order_lines_id_fk` FOREIGN KEY (`order_line_id`) REFERENCES `order_lines`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice_lines` ADD CONSTRAINT `invoice_lines_stripe_price_id_stripe_prices_id_fk` FOREIGN KEY (`stripe_price_id`) REFERENCES `stripe_prices`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_order_id_weekly_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `weekly_orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_membership_id_memberships_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_default_payment_method_id_payment_methods_id_fk` FOREIGN KEY (`default_payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stripe_prices` ADD CONSTRAINT `stripe_prices_stripe_product_id_stripe_products_id_fk` FOREIGN KEY (`stripe_product_id`) REFERENCES `stripe_products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stripe_products` ADD CONSTRAINT `stripe_products_menu_item_id_menu_items_id_fk` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `invoice_lines_invoice_id_idx` ON `invoice_lines` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `invoice_lines_order_line_id_idx` ON `invoice_lines` (`order_line_id`);--> statement-breakpoint
CREATE INDEX `invoice_lines_stripe_price_id_idx` ON `invoice_lines` (`stripe_price_id`);--> statement-breakpoint
CREATE INDEX `invoices_user_id_idx` ON `invoices` (`user_id`);--> statement-breakpoint
CREATE INDEX `invoices_membership_id_idx` ON `invoices` (`membership_id`);--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `invoices_stripe_customer_id_idx` ON `invoices` (`stripe_customer_id`);--> statement-breakpoint
CREATE INDEX `invoices_default_payment_method_id_idx` ON `invoices` (`default_payment_method_id`);--> statement-breakpoint
CREATE INDEX `stripe_prices_stripe_product_id_idx` ON `stripe_prices` (`stripe_product_id`);--> statement-breakpoint
CREATE INDEX `stripe_products_menu_item_id_idx` ON `stripe_products` (`menu_item_id`);--> statement-breakpoint
ALTER TABLE `charges` ADD CONSTRAINT `charges_invoice_id_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `charges` ADD CONSTRAINT `charges_payment_method_id_payment_methods_id_fk` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_default_payment_method_id_payment_methods_id_fk` FOREIGN KEY (`default_payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD CONSTRAINT `weekly_orders_payment_method_id_payment_methods_id_fk` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `charges_invoice_id_idx` ON `charges` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `charges_order_id_idx` ON `charges` (`order_id`);--> statement-breakpoint
CREATE INDEX `charges_status_idx` ON `charges` (`status`);--> statement-breakpoint
CREATE INDEX `payment_methods_user_id_idx` ON `payment_methods` (`user_id`);--> statement-breakpoint
CREATE INDEX `payment_methods_status_idx` ON `payment_methods` (`status`);--> statement-breakpoint
CREATE INDEX `stripe_events_type_idx` ON `stripe_events` (`type`);--> statement-breakpoint
CREATE INDEX `stripe_events_processed_at_idx` ON `stripe_events` (`processed_at`);--> statement-breakpoint
CREATE INDEX `stripe_events_created_at_idx` ON `stripe_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `weekly_orders_payment_method_id_idx` ON `weekly_orders` (`payment_method_id`);--> statement-breakpoint
ALTER TABLE `stripe_prices` ADD `stripe_synced_at` timestamp;--> statement-breakpoint
ALTER TABLE `stripe_prices` ADD `stripe_sync_error` text;--> statement-breakpoint
ALTER TABLE `stripe_products` ADD `stripe_metadata` json;--> statement-breakpoint
ALTER TABLE `stripe_products` ADD `stripe_metadata_updated_at` timestamp;--> statement-breakpoint
ALTER TABLE `stripe_products` ADD `stripe_synced_at` timestamp;--> statement-breakpoint
ALTER TABLE `stripe_products` ADD `stripe_sync_error` text;
