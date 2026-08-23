SET @has_weekly_orders_user_id_idx = (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'weekly_orders'
    AND INDEX_NAME = 'weekly_orders_user_id_idx'
);--> statement-breakpoint
SET @add_weekly_orders_user_id_idx = IF(
  @has_weekly_orders_user_id_idx = 0,
  'ALTER TABLE `weekly_orders` ADD INDEX `weekly_orders_user_id_idx` (`user_id`)',
  'SELECT 1'
);--> statement-breakpoint
PREPARE add_weekly_orders_user_id_idx_stmt FROM @add_weekly_orders_user_id_idx;--> statement-breakpoint
EXECUTE add_weekly_orders_user_id_idx_stmt;--> statement-breakpoint
DEALLOCATE PREPARE add_weekly_orders_user_id_idx_stmt;--> statement-breakpoint
SET @has_weekly_orders_batch_user_idx = (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'weekly_orders'
    AND INDEX_NAME = 'weekly_orders_batch_user_idx'
);--> statement-breakpoint
SET @drop_weekly_orders_batch_user_idx = IF(
  @has_weekly_orders_batch_user_idx > 0,
  'ALTER TABLE `weekly_orders` DROP INDEX `weekly_orders_batch_user_idx`',
  'SELECT 1'
);--> statement-breakpoint
PREPARE drop_weekly_orders_batch_user_idx_stmt FROM @drop_weekly_orders_batch_user_idx;--> statement-breakpoint
EXECUTE drop_weekly_orders_batch_user_idx_stmt;--> statement-breakpoint
DEALLOCATE PREPARE drop_weekly_orders_batch_user_idx_stmt;--> statement-breakpoint
SET @has_weekly_orders_batch_membership_idx = (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'weekly_orders'
    AND INDEX_NAME = 'weekly_orders_batch_membership_idx'
);--> statement-breakpoint
SET @add_weekly_orders_batch_membership_idx = IF(
  @has_weekly_orders_batch_membership_idx = 0,
  'ALTER TABLE `weekly_orders` ADD CONSTRAINT `weekly_orders_batch_membership_idx` UNIQUE(`batch_id`,`membership_id`)',
  'SELECT 1'
);--> statement-breakpoint
PREPARE add_weekly_orders_batch_membership_idx_stmt FROM @add_weekly_orders_batch_membership_idx;--> statement-breakpoint
EXECUTE add_weekly_orders_batch_membership_idx_stmt;--> statement-breakpoint
DEALLOCATE PREPARE add_weekly_orders_batch_membership_idx_stmt;
