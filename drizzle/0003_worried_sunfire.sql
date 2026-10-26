CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`tokenHash` text NOT NULL,
	`tokenPrefix` text NOT NULL,
	`expiresAt` integer,
	`revokedAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_tokenHash_unique` ON `api_tokens` (`tokenHash`);--> statement-breakpoint
CREATE INDEX `api_tokens_userId_idx` ON `api_tokens` (`userId`);