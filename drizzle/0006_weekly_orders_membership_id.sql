ALTER TABLE `weekly_orders` ADD `membership_id` varchar(36);--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD CONSTRAINT `weekly_orders_membership_id_memberships_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weekly_orders` ADD INDEX `weekly_orders_membership_id_idx` (`membership_id`);
