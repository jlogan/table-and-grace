ALTER TABLE `customer_profiles` ADD `birthday` date;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `favorite_cake` varchar(255);--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `profile_photo_url` varchar(512);--> statement-breakpoint
ALTER TABLE `users` ADD `first_name` varchar(127);--> statement-breakpoint
ALTER TABLE `users` ADD `last_name` varchar(127);--> statement-breakpoint
ALTER TABLE `users` ADD `preferred_name` varchar(127);
