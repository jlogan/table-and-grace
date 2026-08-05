CREATE TABLE `billing_cycles` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`period_start` date NOT NULL,
	`period_end` date NOT NULL,
	`status` enum('open','charging','charged','failed') NOT NULL DEFAULT 'open',
	`total_cents` int NOT NULL DEFAULT 0,
	`stripe_payment_intent_id` varchar(255),
	`charged_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billing_cycles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` varchar(36) NOT NULL,
	`category_id` varchar(36),
	`slug` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`note` text,
	`price_4oz_cents` int,
	`price_6oz_cents` int,
	`sort_order` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `menu_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `menu_items_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `order_line_requests` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`order_line_id` varchar(36),
	`type` enum('substitution','zero_out','add') NOT NULL,
	`requested_menu_item_id` varchar(36),
	`requested_qty` int NOT NULL DEFAULT 0,
	`customer_note` text,
	`status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
	`resolved_at` timestamp,
	`resolved_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_line_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pickup_windows` (
	`id` varchar(36) NOT NULL,
	`label` varchar(255) NOT NULL,
	`day_of_week` varchar(16) NOT NULL,
	`time_range` varchar(64) NOT NULL,
	`location_name` varchar(255),
	`sort_order` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pickup_windows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plan_categories` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`tagline` varchar(255),
	`description` text,
	`recommended_for` text,
	`tags` json,
	`price_4oz_cents` int NOT NULL DEFAULT 0,
	`price_6oz_cents` int NOT NULL DEFAULT 0,
	`accent` enum('gold','green','orange','pink','navy') NOT NULL DEFAULT 'green',
	`sort_order` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plan_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `plan_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `charges` ADD `billing_cycle_id` varchar(36);--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `payment_schedule` enum('weekly_autopay','monthly_autopay','manual_per_order') DEFAULT 'weekly_autopay' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `monthly_billing_day` int;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `payment_schedule_set_by` enum('customer','admin') DEFAULT 'customer' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `autopay_enabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD `payment_schedule_snapshot` enum('weekly_autopay','monthly_autopay','manual_per_order');--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD `charge_due_at` timestamp;--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD `billing_cycle_id` varchar(36);--> statement-breakpoint
ALTER TABLE `billing_cycles` ADD CONSTRAINT `billing_cycles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_category_id_plan_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `plan_categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line_requests` ADD CONSTRAINT `order_line_requests_order_id_weekly_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `weekly_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line_requests` ADD CONSTRAINT `order_line_requests_order_line_id_order_lines_id_fk` FOREIGN KEY (`order_line_id`) REFERENCES `order_lines`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line_requests` ADD CONSTRAINT `order_line_requests_requested_menu_item_id_menu_items_id_fk` FOREIGN KEY (`requested_menu_item_id`) REFERENCES `menu_items`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `batch_items` ADD CONSTRAINT `batch_items_menu_item_id_menu_items_id_fk` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `charges` ADD CONSTRAINT `charges_billing_cycle_id_billing_cycles_id_fk` FOREIGN KEY (`billing_cycle_id`) REFERENCES `billing_cycles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD CONSTRAINT `customer_profiles_default_pickup_window_id_pickup_windows_id_fk` FOREIGN KEY (`default_pickup_window_id`) REFERENCES `pickup_windows`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_lines` ADD CONSTRAINT `order_lines_menu_item_id_menu_items_id_fk` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weekly_batches` ADD CONSTRAINT `weekly_batches_pickup_window_id_pickup_windows_id_fk` FOREIGN KEY (`pickup_window_id`) REFERENCES `pickup_windows`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD CONSTRAINT `weekly_orders_pickup_window_id_pickup_windows_id_fk` FOREIGN KEY (`pickup_window_id`) REFERENCES `pickup_windows`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD CONSTRAINT `weekly_orders_billing_cycle_id_billing_cycles_id_fk` FOREIGN KEY (`billing_cycle_id`) REFERENCES `billing_cycles`(`id`) ON DELETE set null ON UPDATE no action;