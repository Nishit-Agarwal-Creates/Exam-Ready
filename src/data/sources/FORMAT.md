# Source packs

Each `*.json` file in this folder describes **one official source document** and the questions extracted from it.
They are loaded by `scripts/build-sources.mjs` into the `papers` (source documents), `questions` and
`question_sources` tables.

Rules:

- Question text is copied **verbatim** from the document's text layer. Nothing is paraphrased or "fixed".
  Where extraction lost a symbol or a figure is needed, the question is flagged (`extractionIssues`).
- Answers only come from an **official marking scheme** for the same paper. If none is published, `officialAnswer` is omitted.
- Chapter mappings are **suggestions** (`mappingStatus: "AI_SUGGESTED"`) until an editor confirms them.
- Everything imported from a pack starts as `PENDING_REVIEW` / unverified. An editor verifies it in
  `/admin/review` after checking it against the linked official PDF. Extraction is not verification.

```jsonc
{
  "source": {
    "key": "cbse-2026-x-science-31-2-1",          // stable id
    "title": "CBSE Secondary School Examination 2026, Science (086), Q.P. Code 31/2/1",
    "board": "cbse", "class": 10, "subject": "science",
    "authority": "OFFICIAL_BOARD",                 // OFFICIAL_BOARD | OFFICIAL_INSTITUTION | REPOSITORY | USER_UPLOAD | OTHER
    "authorityName": "Central Board of Secondary Education",
    "paperType": "BOARD_EXAM",                     // BOARD_EXAM | SPECIMEN | SAMPLE | SCHOOL_EXAM | OTHER
                                                   // SPECIMEN/SAMPLE → OFFICIAL_SAMPLE questions, never PYQs
    "examYear": 2026,
    "session": "Main examination",                 // or null
    "paperName": "Science (086)",
    "paperCode": "31/2/1",                          // Q.P. code as printed, or null
    "setCode": "SET-1",                             // as printed, or null
    "seriesCode": "...",                            // as printed, or null
    "language": "English (from a bilingual Hindi/English paper)",
    "sourceUrl": "https://www.cbse.gov.in/cbsenew/question-paper/2026/X/Science.zip",
    "sourceFile": "Science/31-2-1.pdf",             // path inside the archive, or null
    "answerSourceUrl": "https://…/marking-scheme/…zip", // or null
    "answerSourceFile": "…pdf",                     // or null
    "fileType": "pdf", "pageCount": 27, "sha256": "…",
    "maxMarks": 80, "durationMinutes": 180,
    "extractionMethod": "PDF_TEXT_LAYER",           // PDF_TEXT_LAYER | OCR | MANUAL
    "extractionTool": "pdftotext (poppler)",
    "ocrUsed": false,
    "notes": "…",
    "usage": "Official … publication, freely available on …; reproduced for study with attribution.", // how the content may be used
    "accessedOn": "2026-09-28"                      // date the document was downloaded
  },
  "questions": [
    {
      "number": "10",            // question number as printed
      "part": "(a)",             // internal-choice alternative or sub-part label as printed, or null
      "choiceGroup": "10",       // set when the paper offers alternatives (OR); alternatives share it, else null
      "page": 7,                 // 1-based PDF page of the English text of the question
      "section": "A",            // as printed, or null
      "sectionTitle": "Biology", // as printed, or null
      "marks": 2,                // as printed or as stated in the section instructions
      "marksSource": "PRINTED",  // PRINTED | SECTION_INSTRUCTIONS
      "type": "MCQ",             // MCQ | ASSERTION_REASON | FILL_BLANK | SHORT_ANSWER | LONG_ANSWER | CASE_BASED | NUMERICAL
      "text": "…verbatim…",
      "options": ["…", "…", "…", "…"],   // MCQ / assertion-reason only, verbatim without the (A) labels
      "hasFigure": false,        // true when the question needs a diagram/table not reproducible as text
      "extractionIssues": [],    // e.g. ["Figure on page 5 not reproduced", "Superscripts flattened: Al2O3"]
      "confidence": "HIGH",      // HIGH | MEDIUM | LOW — extraction confidence
      "officialAnswer": { "text": "…verbatim value points…", "correctOption": 2 }, // omit when no official scheme
      "cognitiveLevel": "Application",    // only when printed on the paper (e.g. CISCE specimens); never inferred
      "chapter": "life-processes",        // suggested chapter slug
      "mappingStatus": "AI_SUGGESTED"
    }
  ]
}
```

Check a pack before loading it: `node scripts/check-sources.mjs [file]`. List the valid chapter slugs for a
subject with `node scripts/check-sources.mjs --chapters <board> <class> <subject>`.
