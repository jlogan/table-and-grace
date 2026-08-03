CREATE TABLE `batch_items` (
	`id` varchar(36) NOT NULL,
	`batch_id` varchar(36) NOT NULL,
	`menu_item_id` varchar(36) NOT NULL,
	`qty_cooked` int NOT NULL DEFAULT 0,
	`qty_remaining` int NOT NULL DEFAULT 0,
	`internal_note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `batch_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `charges` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`stripe_payment_intent_id` varchar(255),
	`amount_cents` int NOT NULL,
	`status` enum('pending','succeeded','failed','cancelled') NOT NULL DEFAULT 'pending',
	`failure_reason` text,
	`charged_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `charges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_profiles` (
	`user_id` varchar(36) NOT NULL,
	`phone` varchar(32),
	`dietary_tags` json,
	`allergies` text,
	`portion_default` enum('4oz','6oz') NOT NULL DEFAULT '6oz',
	`household_size` int,
	`chef_notes` text,
	`weekly_budget_cents` int,
	`senior_mode` boolean NOT NULL DEFAULT false,
	`billing_enabled` boolean NOT NULL DEFAULT true,
	`sms_opt_in` boolean NOT NULL DEFAULT false,
	`default_pickup_window_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_profiles_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` varchar(36) NOT NULL,
	`job_type` varchar(64) NOT NULL,
	`idempotency_key` varchar(255) NOT NULL,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	`error_message` text,
	`metadata` json,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `jobs_idempotency_key_unique` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `magic_links` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`email` varchar(255) NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`purpose` enum('login','signup','verify_email') NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `magic_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`status` enum('active','paused','cancelled') NOT NULL DEFAULT 'active',
	`paused_until` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`order_id` varchar(36),
	`channel` enum('email','sms') NOT NULL,
	`template_key` varchar(64) NOT NULL,
	`idempotency_key` varchar(255),
	`status` enum('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
	`payload` json,
	`sent_at` timestamp,
	`error_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_comments` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`author_id` varchar(36),
	`body` text NOT NULL,
	`visibility` enum('customer','internal') NOT NULL DEFAULT 'customer',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_lines` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`menu_item_id` varchar(36) NOT NULL,
	`portion` enum('4oz','6oz') NOT NULL DEFAULT '6oz',
	`qty` int NOT NULL DEFAULT 1,
	`unit_price_cents` int NOT NULL DEFAULT 0,
	`source` enum('recurring','chef_assigned','customer_requested','adjustment') NOT NULL DEFAULT 'chef_assigned',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`stripe_pm_id` varchar(255) NOT NULL,
	`brand` varchar(32),
	`last4` varchar(4),
	`exp_month` int,
	`exp_year` int,
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_methods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stripe_events` (
	`id` varchar(36) NOT NULL,
	`stripe_event_id` varchar(255) NOT NULL,
	`type` varchar(128) NOT NULL,
	`payload` json NOT NULL,
	`processed_at` timestamp,
	`processing_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stripe_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripe_events_stripe_event_id_unique` UNIQUE(`stripe_event_id`)
);
--> statement-breakpoint
CREATE TABLE `weekly_batches` (
	`id` varchar(36) NOT NULL,
	`week_start` date NOT NULL,
	`pickup_date` date,
	`pickup_window_id` varchar(36),
	`status` enum('planning','draft','pending_customer_review','approved','charging','closed') NOT NULL DEFAULT 'planning',
	`chef_internal_notes` text,
	`review_deadline` timestamp,
	`charge_scheduled_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `weekly_batches_week_start_idx` UNIQUE(`week_start`)
);
--> statement-breakpoint
CREATE TABLE `weekly_orders` (
	`id` varchar(36) NOT NULL,
	`batch_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`status` enum('draft','pending_customer_review','changes_requested','approved','charging','ready_for_pickup','picked_up','payment_failed','skipped') NOT NULL DEFAULT 'draft',
	`pickup_window_id` varchar(36),
	`subtotal_cents` int NOT NULL DEFAULT 0,
	`tax_cents` int NOT NULL DEFAULT 0,
	`total_cents` int NOT NULL DEFAULT 0,
	`customer_visible_note` text,
	`reviewed_at` timestamp,
	`approved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `weekly_orders_batch_user_idx` UNIQUE(`batch_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified_at` timestamp;--> statement-breakpoint
ALTER TABLE `batch_items` ADD CONSTRAINT `batch_items_batch_id_weekly_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `weekly_batches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `charges` ADD CONSTRAINT `charges_order_id_weekly_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `weekly_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD CONSTRAINT `customer_profiles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `magic_links` ADD CONSTRAINT `magic_links_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_order_id_weekly_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `weekly_orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_comments` ADD CONSTRAINT `order_comments_order_id_weekly_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `weekly_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_comments` ADD CONSTRAINT `order_comments_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_lines` ADD CONSTRAINT `order_lines_order_id_weekly_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `weekly_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_methods` ADD CONSTRAINT `payment_methods_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD CONSTRAINT `weekly_orders_batch_id_weekly_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `weekly_batches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD CONSTRAINT `weekly_orders_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;