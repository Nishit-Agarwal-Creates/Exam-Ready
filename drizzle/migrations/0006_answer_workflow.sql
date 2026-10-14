-- Answer completion workflow and practice worksheets (additive; existing rows keep their meaning).
-- practice_marks: a SUGGESTED practice allocation chosen by an editor, never a printed mark. Shown with that label
--   and never used by scored tests (which only use printed marks). NULL = none suggested.
ALTER TABLE `questions` ADD `practice_marks` integer;
--> statement-breakpoint
-- answer_rubric: marking points for a descriptive answer that has been published (official or editor-reviewed).
ALTER TABLE `questions` ADD `answer_rubric` text DEFAULT '' NOT NULL;
--> statement-breakpoint
-- answer_meta: JSON provenance of the PUBLISHED answer: { reviewedBy, reviewedAt, source: { title, year, page,
--   questionNumber, url }, sourceChecked }. sourceChecked is true only when an editor checked the answer against that source.
ALTER TABLE `questions` ADD `answer_meta` text;
--> statement-breakpoint
-- answer_draft: JSON draft that is NOT shown to students and NOT used for marking until an editor publishes it:
--   { origin: "AI" | "EDITOR", text, key, rubric, practiceMarks, source, notes, flags, confidence, savedBy, savedAt }.
ALTER TABLE `questions` ADD `answer_draft` text;
--> statement-breakpoint
-- kind: SCORED (marks-balanced test, existing behaviour) or WORKSHEET (a number of questions for practice; only
--   questions with a valid key are checked, nothing else is scored). Every existing paper is a scored test.
ALTER TABLE `generated_papers` ADD `kind` text DEFAULT 'SCORED' NOT NULL;
