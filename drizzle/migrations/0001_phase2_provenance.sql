ALTER TABLE `import_batches` ADD `extraction_method` text DEFAULT 'PASTED_TEXT' NOT NULL;--> statement-breakpoint
ALTER TABLE `import_batches` ADD `ocr_confidence` real;--> statement-breakpoint
ALTER TABLE `import_items` ADD `page_number` integer;--> statement-breakpoint
ALTER TABLE `import_items` ADD `detected_type` text;--> statement-breakpoint
ALTER TABLE `import_items` ADD `options` text;--> statement-breakpoint
ALTER TABLE `import_items` ADD `confidence` text;--> statement-breakpoint
ALTER TABLE `import_items` ADD `issues` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `papers` ADD `source_key` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `authority` text DEFAULT 'OTHER' NOT NULL;--> statement-breakpoint
ALTER TABLE `papers` ADD `authority_name` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `source_domain` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `source_file` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `answer_source_url` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `answer_source_file` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `exam_session` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `paper_name` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `paper_code` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `set_code` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `series_code` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `region` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `language` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `file_type` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `page_count` integer;--> statement-breakpoint
ALTER TABLE `papers` ADD `sha256` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `max_marks` integer;--> statement-breakpoint
ALTER TABLE `papers` ADD `duration_minutes` integer;--> statement-breakpoint
ALTER TABLE `papers` ADD `extraction_method` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `extraction_tool` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `ocr_used` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `papers` ADD `ocr_confidence` real;--> statement-breakpoint
ALTER TABLE `papers` ADD `status` text DEFAULT 'IMPORTED' NOT NULL;--> statement-breakpoint
ALTER TABLE `papers` ADD `reviewed_by` text;--> statement-breakpoint
ALTER TABLE `papers` ADD `reviewed_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `papers_source_key` ON `papers` (`source_key`);--> statement-breakpoint
ALTER TABLE `question_sources` ADD `part` text;--> statement-breakpoint
ALTER TABLE `question_sources` ADD `page_number` integer;--> statement-breakpoint
ALTER TABLE `question_sources` ADD `section` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `canonical_question_id` integer;--> statement-breakpoint
ALTER TABLE `questions` ADD `mapping_status` text DEFAULT 'CONFIRMED' NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `mapping_source` text DEFAULT 'author' NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `answer_source` text DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `has_figure` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `extraction_confidence` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `extraction_issues` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE INDEX `questions_canonical` ON `questions` (`canonical_question_id`);