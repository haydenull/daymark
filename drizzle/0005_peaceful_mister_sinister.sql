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
        "__new_important_days"."type" = 'lunar_birthday'
        AND "__new_important_days"."festivalCode" IS NULL
        AND "__new_important_days"."lunarMonth" BETWEEN 1 AND 12
        AND "__new_important_days"."lunarDay" BETWEEN 1 AND 30
        AND "__new_important_days"."isLeapMonth" IN (0, 1)
        AND ("__new_important_days"."birthYear" IS NULL OR "__new_important_days"."birthYear" BETWEEN 1 AND 9999)
        AND "__new_important_days"."solarMonth" IS NULL
        AND "__new_important_days"."solarDay" IS NULL
        AND "__new_important_days"."anniversaryYear" IS NULL
      ) OR (
        "__new_important_days"."type" = 'festival'
        AND "__new_important_days"."festivalCode" IS NOT NULL
        AND "__new_important_days"."lunarMonth" IS NULL
        AND "__new_important_days"."lunarDay" IS NULL
        AND "__new_important_days"."isLeapMonth" IS NULL
        AND "__new_important_days"."birthYear" IS NULL
        AND "__new_important_days"."solarMonth" IS NULL
        AND "__new_important_days"."solarDay" IS NULL
        AND "__new_important_days"."anniversaryYear" IS NULL
      ) OR (
        "__new_important_days"."type" = 'solar_anniversary'
        AND "__new_important_days"."festivalCode" IS NULL
        AND "__new_important_days"."lunarMonth" IS NULL
        AND "__new_important_days"."lunarDay" IS NULL
        AND "__new_important_days"."isLeapMonth" IS NULL
        AND "__new_important_days"."birthYear" IS NULL
        AND (
          ("__new_important_days"."solarMonth" IN (1, 3, 5, 7, 8, 10, 12) AND "__new_important_days"."solarDay" BETWEEN 1 AND 31)
          OR ("__new_important_days"."solarMonth" IN (4, 6, 9, 11) AND "__new_important_days"."solarDay" BETWEEN 1 AND 30)
          OR ("__new_important_days"."solarMonth" = 2 AND "__new_important_days"."solarDay" BETWEEN 1 AND 29)
        )
        AND ("__new_important_days"."anniversaryYear" IS NULL OR "__new_important_days"."anniversaryYear" BETWEEN 1 AND 9999)
      ))
);
--> statement-breakpoint
INSERT INTO `__new_important_days`("id", "userId", "title", "type", "birthYear", "lunarMonth", "lunarDay", "isLeapMonth", "festivalCode", "solarMonth", "solarDay", "anniversaryYear", "createdAt", "updatedAt") SELECT "id", "userId", "title", "type", "birthYear", "lunarMonth", "lunarDay", "isLeapMonth", "festivalCode", NULL, NULL, NULL, "createdAt", "updatedAt" FROM `important_days`;--> statement-breakpoint
DROP TABLE `important_days`;--> statement-breakpoint
ALTER TABLE `__new_important_days` RENAME TO `important_days`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `important_days_user_festival_uq` ON `important_days` (`userId`,`festivalCode`);