ALTER TABLE `weekly_orders` ADD INDEX `weekly_orders_user_id_idx` (`user_id`);--> statement-breakpoint
ALTER TABLE `weekly_orders` DROP INDEX `weekly_orders_batch_user_idx`;--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD CONSTRAINT `weekly_orders_batch_membership_idx` UNIQUE(`batch_id`,`membership_id`);