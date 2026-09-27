CREATE TABLE `attempt_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` text NOT NULL,
	`question_id` integer NOT NULL,
	`position` integer NOT NULL,
	`response` text,
	`is_correct` integer,
	`marks_awarded` real,
	`evaluation_method` text DEFAULT 'NONE' NOT NULL,
	`marked_for_review` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_answers_unique` ON `attempt_answers` (`attempt_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`generated_paper_id` text NOT NULL,
	`user_id` integer,
	`started_at` text NOT NULL,
	`submitted_at` text,
	`time_used_seconds` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'SUBMITTED' NOT NULL,
	`max_score` integer DEFAULT 0 NOT NULL,
	`auto_score` real,
	`self_score` real,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`generated_paper_id`) REFERENCES `generated_papers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `attempts_paper` ON `attempts` (`generated_paper_id`);--> statement-breakpoint
CREATE TABLE `boards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`full_name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `boards_slug_unique` ON `boards` (`slug`);--> statement-breakpoint
CREATE TABLE `chapters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_id` integer NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapters_subject_slug` ON `chapters` (`subject_id`,`slug`);--> statement-breakpoint
CREATE TABLE `classes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`board_id` integer NOT NULL,
	`level` integer NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classes_board_slug` ON `classes` (`board_id`,`slug`);--> statement-breakpoint
CREATE TABLE `generated_papers` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` integer NOT NULL,
	`class_id` integer NOT NULL,
	`subject_id` integer NOT NULL,
	`user_id` integer,
	`title` text NOT NULL,
	`mode` text NOT NULL,
	`total_marks` integer NOT NULL,
	`requested_marks` integer NOT NULL,
	`duration_minutes` integer NOT NULL,
	`difficulty` text DEFAULT 'MIXED' NOT NULL,
	`chapter_ids` text DEFAULT '[]' NOT NULL,
	`composition` text DEFAULT '{}' NOT NULL,
	`notices` text DEFAULT '[]' NOT NULL,
	`has_demo` integer DEFAULT false NOT NULL,
	`seed` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `generated_papers_subject` ON `generated_papers` (`subject_id`);--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_id` integer NOT NULL,
	`paper_id` integer,
	`title` text NOT NULL,
	`raw_text` text NOT NULL,
	`status` text DEFAULT 'IN_REVIEW' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `import_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer NOT NULL,
	`position` integer NOT NULL,
	`question_number` text,
	`section` text,
	`text` text NOT NULL,
	`marks` integer,
	`suggested_chapter_id` integer,
	`duplicate_of_question_id` integer,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`question_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`suggested_chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`duplicate_of_question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `import_items_batch` ON `import_items` (`batch_id`);--> statement-breakpoint
CREATE TABLE `paper_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`generated_paper_id` text NOT NULL,
	`question_id` integer NOT NULL,
	`position` integer NOT NULL,
	`section` text DEFAULT 'A' NOT NULL,
	`marks` integer NOT NULL,
	FOREIGN KEY (`generated_paper_id`) REFERENCES `generated_papers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `paper_questions_position` ON `paper_questions` (`generated_paper_id`,`position`);--> statement-breakpoint
CREATE TABLE `papers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`board_id` integer NOT NULL,
	`class_id` integer NOT NULL,
	`subject_id` integer NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`paper_type` text NOT NULL,
	`source_url` text,
	`source_notes` text DEFAULT '' NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `papers_subject` ON `papers` (`subject_id`,`year`);--> statement-breakpoint
CREATE TABLE `question_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer NOT NULL,
	`paper_id` integer NOT NULL,
	`question_number` text,
	`marks_in_paper` integer,
	`is_primary` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_sources_unique` ON `question_sources` (`question_id`,`paper_id`);--> statement-breakpoint
CREATE INDEX `question_sources_paper` ON `question_sources` (`paper_id`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_key` text,
	`board_id` integer NOT NULL,
	`class_id` integer NOT NULL,
	`subject_id` integer NOT NULL,
	`chapter_id` integer NOT NULL,
	`topic_id` integer,
	`question_text` text NOT NULL,
	`question_type` text NOT NULL,
	`marks` integer NOT NULL,
	`difficulty` text DEFAULT 'MEDIUM' NOT NULL,
	`options` text,
	`answer_key` text,
	`answer_text` text DEFAULT '' NOT NULL,
	`explanation` text DEFAULT '' NOT NULL,
	`source_type` text NOT NULL,
	`verification_status` text DEFAULT 'UNVERIFIED' NOT NULL,
	`verification_notes` text DEFAULT '' NOT NULL,
	`verified_at` text,
	`verified_by` text,
	`is_published` integer DEFAULT true NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`frequency_count` integer DEFAULT 0 NOT NULL,
	`content_hash` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `questions_external_key_unique` ON `questions` (`external_key`);--> statement-breakpoint
CREATE INDEX `questions_subject_chapter` ON `questions` (`subject_id`,`chapter_id`);--> statement-breakpoint
CREATE INDEX `questions_source` ON `questions` (`source_type`,`verification_status`);--> statement-breakpoint
CREATE INDEX `questions_hash` ON `questions` (`content_hash`);--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`class_id` integer NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`overview` text DEFAULT '' NOT NULL,
	`study_tips` text DEFAULT '[]' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_class_slug` ON `subjects` (`class_id`,`slug`);--> statement-breakpoint
CREATE TABLE `topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chapter_id` integer NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topics_chapter_slug` ON `topics` (`chapter_id`,`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'STUDENT' NOT NULL,
	`plan` text DEFAULT 'FREE' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);