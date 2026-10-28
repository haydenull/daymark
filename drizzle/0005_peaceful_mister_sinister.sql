PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_important_days` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`birthYear` integer,
	`lunarMonth` integer,
	`lunarDay` integer,
	`isLeapMonth` integer,
	`festivalCode` text,
	`solarMonth` integer,
	`solarDay` integer,
	`anniversaryYear` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "important_days_rule_chk" CHECK((
        "type" = 'lunar_birthday'
        AND "festivalCode" IS NULL
        AND "lunarMonth" BETWEEN 1 AND 12
        AND "lunarDay" BETWEEN 1 AND 30
        AND "isLeapMonth" IN (0, 1)
        AND ("birthYear" IS NULL OR "birthYear" BETWEEN 1 AND 9999)
        AND "solarMonth" IS NULL
        AND "solarDay" IS NULL
        AND "anniversaryYear" IS NULL
      ) OR (
        "type" = 'festival'
        AND "festivalCode" IS NOT NULL
        AND "lunarMonth" IS NULL
        AND "lunarDay" IS NULL
        AND "isLeapMonth" IS NULL
        AND "birthYear" IS NULL
        AND "solarMonth" IS NULL
        AND "solarDay" IS NULL
        AND "anniversaryYear" IS NULL
      ) OR (
        "type" = 'solar_anniversary'
        AND "festivalCode" IS NULL
        AND "lunarMonth" IS NULL
        AND "lunarDay" IS NULL
        AND "isLeapMonth" IS NULL
        AND "birthYear" IS NULL
        AND (
          ("solarMonth" IN (1, 3, 5, 7, 8, 10, 12) AND "solarDay" BETWEEN 1 AND 31)
          OR ("solarMonth" IN (4, 6, 9, 11) AND "solarDay" BETWEEN 1 AND 30)
          OR ("solarMonth" = 2 AND "solarDay" BETWEEN 1 AND 29)
        )
        AND ("anniversaryYear" IS NULL OR "anniversaryYear" BETWEEN 1 AND 9999)
      ))
);
--> statement-breakpoint
INSERT INTO `__new_important_days`("id", "userId", "title", "type", "birthYear", "lunarMonth", "lunarDay", "isLeapMonth", "festivalCode", "solarMonth", "solarDay", "anniversaryYear", "createdAt", "updatedAt") SELECT "id", "userId", "title", "type", "birthYear", "lunarMonth", "lunarDay", "isLeapMonth", "festivalCode", NULL, NULL, NULL, "createdAt", "updatedAt" FROM `important_days`;--> statement-breakpoint
DROP TABLE `important_days`;--> statement-breakpoint
ALTER TABLE `__new_important_days` RENAME TO `important_days`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `important_days_user_festival_uq` ON `important_days` (`userId`,`festivalCode`);