ALTER TABLE `memberships` ADD `discount_label` varchar(120);--> statement-breakpoint
ALTER TABLE `memberships` ADD `weekly_invoice_day` int;--> statement-breakpoint
ALTER TABLE `memberships` ADD `monthly_invoice_day` int;--> statement-breakpoint
ALTER TABLE `memberships` ADD `biweekly_anchor_date` timestamp;
