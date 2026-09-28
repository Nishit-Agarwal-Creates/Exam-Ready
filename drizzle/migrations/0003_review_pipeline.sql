ALTER TABLE `questions` ADD `review_state` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `review_reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `reviewed_at` text;--> statement-breakpoint
CREATE INDEX `questions_review_state` ON `questions` (`review_state`);--> statement-breakpoint
-- Existing decisions: questions verified before the pipeline existed were verified by an editor.
UPDATE `questions` SET `review_state` = 'EDITOR_VERIFIED' WHERE `is_demo` = 0 AND `verification_status` = 'VERIFIED';--> statement-breakpoint
UPDATE `questions` SET `review_state` = 'PENDING_REVIEW' WHERE `is_demo` = 0 AND `verification_status` = 'UNVERIFIED';
