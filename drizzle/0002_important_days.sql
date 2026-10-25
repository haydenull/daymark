CREATE TABLE `important_days` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`birthYear` integer,
	`lunarMonth` integer,
	`lunarDay` integer,
	`isLeapMonth` integer,
	`festivalCode` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "important_days_rule_chk" CHECK((
        "important_days"."type" = 'lunar_birthday'
        AND "important_days"."festivalCode" IS NULL
        AND "important_days"."lunarMonth" BETWEEN 1 AND 12
        AND "important_days"."lunarDay" BETWEEN 1 AND 30
        AND "important_days"."isLeapMonth" IN (0, 1)
        AND ("important_days"."birthYear" IS NULL OR "important_days"."birthYear" BETWEEN 1 AND 9999)
      ) OR (
        "important_days"."type" = 'festival'
        AND "important_days"."festivalCode" IS NOT NULL
        AND "important_days"."lunarMonth" IS NULL
        AND "important_days"."lunarDay" IS NULL
        AND "important_days"."isLeapMonth" IS NULL
        AND "important_days"."birthYear" IS NULL
      ))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `important_days_user_festival_uq` ON `important_days` (`userId`,`festivalCode`);