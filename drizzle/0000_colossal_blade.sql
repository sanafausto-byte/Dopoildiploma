CREATE TABLE `answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_code` text NOT NULL,
	`participant_id` text NOT NULL,
	`phrase` text NOT NULL,
	`choice` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `sessions`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `answers_room_participant_idx` ON `answers` (`room_code`,`participant_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`code` text PRIMARY KEY NOT NULL,
	`admin_key` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
