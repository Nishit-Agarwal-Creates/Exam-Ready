/**
 * Factual context about exam structure shown on SEO pages. Kept deliberately general and
 * phrased with "typically"; students are pointed to the current CISCE regulations for specifics.
 */
export function classExamNote(boardSlug: string, level: number): string {
  if (boardSlug !== "icse") return "";
  if (level === 10) {
    return "Class 10 ends with the ICSE board examination conducted by CISCE. Theory papers in Mathematics, Physics, Chemistry and Biology are typically marked out of 80, with the remaining 20 marks from internal assessment. Check the current CISCE regulations and specimen papers for the exact pattern and timing.";
  }
  return `There is no board examination in Class ${level}. Schools set their own term and annual exams on the ICSE syllabus, so previous questions for this class come from school papers or official material. Only questions checked against a stored paper are marked verified.`;
}

export function subjectExamNote(boardSlug: string, level: number, subjectSlug: string): string {
  if (boardSlug !== "icse") return "";
  if (level === 10) {
    const science = ["physics", "chemistry", "biology"].includes(subjectSlug);
    return science
      ? "In the ICSE Class 10 exam, Physics, Chemistry and Biology are separate papers of Science. Papers typically have a compulsory Section A of short and objective questions and a Section B with longer questions to choose from. ExamReady's exam simulation mode follows that two-section shape."
      : "The ICSE Class 10 Mathematics paper typically has a compulsory Section A of shorter questions and a Section B of longer problems to choose from. ExamReady's exam simulation mode follows that two-section shape.";
  }
  return `Class ${level} exams are set by schools, so the pattern varies. A two-section paper, short questions first and longer ones after, is a good way to practise for most school exams.`;
}
