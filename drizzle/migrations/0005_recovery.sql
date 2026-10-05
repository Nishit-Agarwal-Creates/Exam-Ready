-- Phase 5.1 recovery (additive; existing rows keep their meaning).
-- marks_status: whether the question's own mark is printed on the paper.
--   PRINTED      the mark beside this item, or a printed per-item rule such as "5 × 2 = 10" (default; all existing rows)
--   GROUP_TOTAL  only a total for the whole group is printed; marks is 0 and marks_note quotes the printed total
--   NOT_PRINTED  the paper prints no mark for this item; marks is 0
--   FRACTIONAL   the printed mark is a fraction such as 2½ (marks_note quotes it); marks is 0
-- Questions without a printed mark are never used by the paper builder, which needs real marks.
ALTER TABLE `questions` ADD `marks_status` text DEFAULT 'PRINTED' NOT NULL;
--> statement-breakpoint
ALTER TABLE `questions` ADD `marks_note` text DEFAULT '' NOT NULL;
--> statement-breakpoint
-- figure: JSON array of figures cropped from the original source page (never redrawn):
--   [{ "src": "/figures/<pack>/<q>.png", "kind": "FIGURE|TABLE|GRAPH|MAP|PASSAGE", "alt": "...", "width": 900, "height": 420,
--      "page": 3, "crop": { "x": 0.08, "y": 0.41, "w": 0.6, "h": 0.22 }, "method": "SOURCE_PAGE_CROP", "confidence": "HIGH" }]
ALTER TABLE `questions` ADD `figure` text;
