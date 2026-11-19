import { ExamBoard, GradeLevel, SubjectName } from '../types';

export type FbisePatternMode = 'official_new' | 'reformed_50_50' | 'scheme_2006';

export interface OfficialPaperPattern {
  mode: FbisePatternMode;
  modeLabel: string;
  titleTag: string;
  boardLevelCode: 'SSC-I' | 'SSC-II' | 'HSSC-I' | 'HSSC-II';
  totalMarks: number;
  totalTimeMinutes: number;
  sectionATimeMinutes: number;
  subjectiveTimeMinutes: number;
  mcqCount: number;
  mcqMarks: number;
  sectionAMarks: number;
  shortCount: number;
  shortMarks: number;
  shortHasOr: boolean;
  shortChoiceNote: string;
  sectionBMarks: number;
  longCount: number;
  longMarks: number;
  longHasOr: boolean;
  longChoiceNote: string;
  sectionCMarks: number;
}

export const FBISE_PATTERN_MODES: Array<{
  value: FbisePatternMode;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: 'official_new',
    label: 'Official FBISE New Pattern (NCP 2023–26)',
    shortLabel: 'Official New (NCP)',
    description: 'Latest fbise.edu.pk Annual Pattern (SSC Sci 60, HSSC Sci 80, Math 75/100, Eng/Urdu 75/100, Isl/PST 50)',
  },
  {
    value: 'reformed_50_50',
    label: 'Reformed 50% MCQs / 50% Descriptive',
    shortLabel: 'Reformed 50/50',
    description: 'FBISE Inclusive Scheme 2024 50% Objective + 50% Subjective pattern',
  },
  {
    value: 'scheme_2006',
    label: 'Classic Scheme 2006 (65 / 85 Marks)',
    shortLabel: 'Scheme 2006 (65/85)',
    description: 'Traditional 65-mark SSC Science & 85-mark HSSC Science distribution',
  },
];

const SCIENCE_SUBJECTS = new Set<SubjectName>([
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
]);

const COMPULSORY_50_SUBJECTS = new Set<SubjectName>(['Islamiat', 'Pakistan Studies']);

const HSSC_PRACTICAL_ARTS = new Set<SubjectName>([
  'Geography',
  'Psychology',
  'Home Economics',
]);

export function getBoardLevelCode(
  grade: GradeLevel,
): 'SSC-I' | 'SSC-II' | 'HSSC-I' | 'HSSC-II' {
  switch (grade) {
    case '9th':
      return 'SSC-I';
    case '10th':
      return 'SSC-II';
    case '1st A':
      return 'HSSC-I';
    case '2nd Year':
      return 'HSSC-II';
  }
}

export function isSscGrade(grade: GradeLevel): boolean {
  return grade === '9th' || grade === '10th';
}

export function formatRomanPart(zeroBasedIndex: number): string {
  const romans = [
    'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
    'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx',
    'xxi', 'xxii', 'xxiii', 'xxiv', 'xxv', 'xxvi', 'xxvii', 'xxviii', 'xxix', 'xxx',
    'xxxi', 'xxxii', 'xxxiii', 'xxxiv', 'xxxv', 'xxxvi', 'xxxvii', 'xxxviii', 'xxxix', 'xl',
    'xli', 'xlii', 'xliii', 'xliv', 'xlv', 'xlvi', 'xlvii', 'xlviii', 'xlix', 'l',
  ];
  const numeral = romans[zeroBasedIndex] ?? String(zeroBasedIndex + 1);
  return `(${numeral})`;
}

export function formatDurationHoursMin(minutes: number): string {
  const safeMin = Math.max(0, Math.round(minutes));
  if (safeMin < 60) {
    return `${safeMin} Minutes`;
  }
  const hrs = Math.floor(safeMin / 60);
  const mins = safeMin % 60;
  return `${hrs}:${String(mins).padStart(2, '0')} Hours`;
}

export function estimateSectionATimeMinutes(
  grade: GradeLevel,
  mcqCount: number,
  explicitSectionATime?: number,
): number {
  if (explicitSectionATime && explicitSectionATime > 0) {
    return explicitSectionATime;
  }
  if (mcqCount <= 0) return 0;
  if (mcqCount >= 55) return 80; // Reformed 50/50 (60 or 80 MCQs)
  if (mcqCount >= 40) return 60;
  if (mcqCount <= 10) return 15;
  if (mcqCount <= 15) return 20;
  return isSscGrade(grade) ? 20 : 25;
}

export function getOfficialPattern(
  board: ExamBoard,
  grade: GradeLevel,
  subject: SubjectName,
  mode: FbisePatternMode = 'official_new',
): OfficialPaperPattern {
  const ssc = isSscGrade(grade);
  const boardLevelCode = getBoardLevelCode(grade);
  const boardTitlePrefix =
    board === 'punjab_ptb' ? 'Punjab Board (PTB)' : 'FBISE Official';

  const modeMeta =
    FBISE_PATTERN_MODES.find((m) => m.value === mode) ?? FBISE_PATTERN_MODES[0];

  const makePattern = (spec: {
    mcqCount: number;
    mcqMarks: number;
    sectionATimeMinutes: number;
    shortCount: number;
    shortMarks: number;
    shortChoiceNote: string;
    longCount: number;
    longMarks: number;
    longChoiceNote: string;
    totalTimeMinutes: number;
    titleTag: string;
    shortHasOr?: boolean;
    longHasOr?: boolean;
  }): OfficialPaperPattern => {
    const sectionAMarks = Math.round(spec.mcqCount * spec.mcqMarks * 100) / 100;
    const sectionBMarks = Math.round(spec.shortCount * spec.shortMarks * 100) / 100;
    const sectionCMarks = Math.round(spec.longCount * spec.longMarks * 100) / 100;
    const totalMarks = Math.round((sectionAMarks + sectionBMarks + sectionCMarks) * 100) / 100;
    const subjectiveTimeMinutes = Math.max(15, spec.totalTimeMinutes - spec.sectionATimeMinutes);

    return {
      mode,
      modeLabel: `${boardTitlePrefix} · ${modeMeta.shortLabel}`,
      titleTag: spec.titleTag,
      boardLevelCode,
      totalMarks,
      totalTimeMinutes: spec.totalTimeMinutes,
      sectionATimeMinutes: spec.sectionATimeMinutes,
      subjectiveTimeMinutes,
      mcqCount: spec.mcqCount,
      mcqMarks: spec.mcqMarks,
      sectionAMarks,
      shortCount: spec.shortCount,
      shortMarks: spec.shortMarks,
      shortHasOr: spec.shortHasOr ?? true,
      shortChoiceNote: spec.shortChoiceNote,
      sectionBMarks,
      longCount: spec.longCount,
      longMarks: spec.longMarks,
      longHasOr: spec.longHasOr ?? true,
      longChoiceNote: spec.longChoiceNote,
      sectionCMarks,
    };
  };

  // 1. Compulsory 50-Mark Subjects (Islamiat & Pakistan Studies) — SSC & HSSC
  if (COMPULSORY_50_SUBJECTS.has(subject)) {
    if (mode === 'reformed_50_50') {
      return makePattern({
        mcqCount: 25,
        mcqMarks: 1,
        sectionATimeMinutes: 35,
        shortCount: 5,
        shortMarks: 3,
        shortChoiceNote: `Attempt all 5 parts from Section 'B' on the E-sheet (internal OR provided). (5 × 3 = 15)`,
        longCount: 2,
        longMarks: 5,
        longChoiceNote: `Attempt both questions (Q.3 & Q.4) from Section 'C' (internal OR provided). (2 × 5 = 10)`,
        totalTimeMinutes: 120,
        titleTag: `${boardLevelCode} ${subject} · Reformed 50/50 (50 Marks)`,
      });
    }
    return makePattern({
      mcqCount: 10,
      mcqMarks: 1,
      sectionATimeMinutes: 15,
      shortCount: 8,
      shortMarks: 3,
      shortChoiceNote: `Attempt all 8 parts from Section 'B' on the E-sheet (internal OR choice provided). (8 × 3 = 24)`,
      longCount: 2,
      longMarks: 8,
      longChoiceNote: `Attempt all questions (Q.3 & Q.4) from Section 'C' (internal OR choice provided). (2 × 8 = 16)`,
      totalTimeMinutes: 120,
      titleTag: `${boardLevelCode} ${subject} · Official FBISE (50 Marks)`,
    });
  }

  // 2. Science & Technology Subjects (Physics, Chemistry, Biology, Computer Science)
  if (SCIENCE_SUBJECTS.has(subject)) {
    if (ssc) {
      if (mode === 'reformed_50_50') {
        return makePattern({
          mcqCount: 60,
          mcqMarks: 0.5,
          sectionATimeMinutes: 80,
          shortCount: 6,
          shortMarks: 3,
          shortChoiceNote: `Attempt all 6 parts from Section 'B' on the E-sheet (internal OR choice provided). (6 × 3 = 18)`,
          longCount: 2,
          longMarks: 6,
          longChoiceNote: `Attempt both questions (Q.3 & Q.4) from Section 'C' (internal OR choice provided). (2 × 6 = 12)`,
          totalTimeMinutes: 180,
          titleTag: `${boardLevelCode} ${subject} · Reformed 50/50 (60 Marks)`,
        });
      }
      if (mode === 'scheme_2006') {
        return makePattern({
          mcqCount: 12,
          mcqMarks: 1,
          sectionATimeMinutes: 20,
          shortCount: 11,
          shortMarks: 3,
          shortChoiceNote: `Attempt all 11 parts from Section 'B' (internal OR choice provided). (11 × 3 = 33)`,
          longCount: 2,
          longMarks: 10,
          longChoiceNote: `Attempt both questions (Q.3 & Q.4) from Section 'C' (internal OR choice provided). (2 × 10 = 20)`,
          totalTimeMinutes: 180,
          titleTag: `${boardLevelCode} ${subject} · Classic Scheme (65 Marks)`,
        });
      }
      // Official New Pattern (Curriculum 2022–23 / 2024–26 Model Papers)
      return makePattern({
        mcqCount: 12,
        mcqMarks: 1,
        sectionATimeMinutes: 20,
        shortCount: 10,
        shortMarks: 3,
        shortChoiceNote: `Attempt all parts from Section 'B' on the E-sheet (internal OR choice provided). (10 × 3 = 30)`,
        longCount: 3,
        longMarks: 6,
        longChoiceNote: `Attempt all questions (Q.3, Q.4, Q.5) from Section 'C' (internal OR choice provided). (3 × 6 = 18)`,
        totalTimeMinutes: 180,
        titleTag: `${boardLevelCode} ${subject} · Official FBISE NCP (60 Marks)`,
      });
    }

    // HSSC Sciences (11th / 12th)
    if (mode === 'reformed_50_50') {
      return makePattern({
        mcqCount: 80,
        mcqMarks: 0.5,
        sectionATimeMinutes: 80,
        shortCount: 8,
        shortMarks: 3,
        shortChoiceNote: `Attempt all 8 parts from Section 'B' on the E-sheet (internal OR choice provided). (8 × 3 = 24)`,
        longCount: 2,
        longMarks: 8,
        longChoiceNote: `Attempt both questions (Q.3 & Q.4) from Section 'C' (internal OR choice provided). (2 × 8 = 16)`,
        totalTimeMinutes: 180,
        titleTag: `${boardLevelCode} ${subject} · Reformed 50/50 (80 Marks)`,
      });
    }
    if (mode === 'scheme_2006') {
      return makePattern({
        mcqCount: 17,
        mcqMarks: 1,
        sectionATimeMinutes: 25,
        shortCount: 14,
        shortMarks: 3,
        shortChoiceNote: `Attempt all 14 parts from Section 'B' (internal OR choice provided). (14 × 3 = 42)`,
        longCount: 2,
        longMarks: 13,
        longChoiceNote: `Attempt both questions (Q.3 & Q.4) from Section 'C' (internal OR choice provided). (2 × 13 = 26)`,
        totalTimeMinutes: 180,
        titleTag: `${boardLevelCode} ${subject} · Classic Scheme (85 Marks)`,
      });
    }
    // Official New Pattern (Curriculum 2022–23 / 2024–26 Model Papers)
    return makePattern({
      mcqCount: 17,
      mcqMarks: 1,
      sectionATimeMinutes: 25,
      shortCount: 13,
      shortMarks: 3,
      shortChoiceNote: `Attempt all parts from Section 'B' on the E-sheet (internal OR choice provided). (13 × 3 = 39)`,
      longCount: 4,
      longMarks: 6,
      longChoiceNote: `Attempt all questions (Q.3 to Q.6) from Section 'C' (internal OR choice provided). (4 × 6 = 24)`,
      totalTimeMinutes: 180,
      titleTag: `${boardLevelCode} ${subject} · Official FBISE NCP (80 Marks)`,
    });
  }

  // 3. Mathematics
  if (subject === 'Math') {
    if (ssc) {
      if (mode === 'reformed_50_50') {
        return makePattern({
          mcqCount: 37,
          mcqMarks: 1,
          sectionATimeMinutes: 55,
          shortCount: 6,
          shortMarks: 4,
          shortChoiceNote: `Attempt all 6 parts from Section 'B' on the E-sheet (internal OR choice provided). (6 × 4 = 24)`,
          longCount: 2,
          longMarks: 7,
          longChoiceNote: `Attempt both questions (Q.3 & Q.4) from Section 'C' (internal OR choice provided). (2 × 7 = 14)`,
          totalTimeMinutes: 180,
          titleTag: `${boardLevelCode} Mathematics · Reformed 50/50 (75 Marks)`,
        });
      }
      return makePattern({
        mcqCount: 15,
        mcqMarks: 1,
        sectionATimeMinutes: 20,
        shortCount: 9,
        shortMarks: 4,
        shortChoiceNote: `Attempt all 9 parts from Section 'B' on the E-sheet (internal OR choice provided). (9 × 4 = 36)`,
        longCount: 3,
        longMarks: 8,
        longChoiceNote: `Attempt all questions (Q.3, Q.4, Q.5) from Section 'C' (internal OR choice provided). (3 × 8 = 24)`,
        totalTimeMinutes: 180,
        titleTag: `${boardLevelCode} Mathematics · Official FBISE (75 Marks)`,
      });
    }

    // HSSC Math (100 Marks)
    if (mode === 'reformed_50_50') {
      return makePattern({
        mcqCount: 48,
        mcqMarks: 1,
        sectionATimeMinutes: 70,
        shortCount: 7,
        shortMarks: 4,
        shortChoiceNote: `Attempt all 7 parts from Section 'B' on the E-sheet (internal OR choice provided). (7 × 4 = 28)`,
        longCount: 3,
        longMarks: 8,
        longChoiceNote: `Attempt all 3 questions (Q.3, Q.4, Q.5) from Section 'C' (internal OR choice provided). (3 × 8 = 24)`,
        totalTimeMinutes: 180,
        titleTag: `${boardLevelCode} Mathematics · Reformed 50/50 (100 Marks)`,
      });
    }
    return makePattern({
      mcqCount: 20,
      mcqMarks: 1,
      sectionATimeMinutes: 25,
      shortCount: 12,
      shortMarks: 4,
      shortChoiceNote: `Attempt all 12 parts from Section 'B' on the E-sheet (internal OR choice provided). (12 × 4 = 48)`,
      longCount: 4,
      longMarks: 8,
      longChoiceNote: `Attempt all questions (Q.3 to Q.6) from Section 'C' (internal OR choice provided). (4 × 8 = 32)`,
      totalTimeMinutes: 180,
      titleTag: `${boardLevelCode} Mathematics · Official FBISE (100 Marks)`,
    });
  }

  // 4. English Compulsory
  if (subject === 'English') {
    if (ssc) {
      return makePattern({
        mcqCount: 15,
        mcqMarks: 1,
        sectionATimeMinutes: 20,
        shortCount: 9,
        shortMarks: 4,
        shortChoiceNote: `Attempt all 9 parts from Section 'B' (Comprehension, Poetry & Textual SRQs with internal OR). (9 × 4 = 36)`,
        longCount: 3,
        longMarks: 8,
        longChoiceNote: `Attempt all questions (Q.3, Q.4, Q.5 — Essay, Letter/Application & Grammar/Translation with internal OR). (3 × 8 = 24)`,
        totalTimeMinutes: 180,
        titleTag: `${boardLevelCode} English · Official FBISE (75 Marks)`,
      });
    }
    return makePattern({
      mcqCount: 20,
      mcqMarks: 1,
      sectionATimeMinutes: 25,
      shortCount: 10,
      shortMarks: 4,
      shortChoiceNote: `Attempt all 10 parts from Section 'B' (Prose Comprehension, Poetry & Textual SRQs with internal OR). (10 × 4 = 40)`,
      longCount: 4,
      longMarks: 10,
      longChoiceNote: `Attempt all questions (Q.3 to Q.6 — Essay, Report/Letter, Summarizing & Applied Grammar with internal OR). (4 × 10 = 40)`,
      totalTimeMinutes: 180,
      titleTag: `${boardLevelCode} English · Official FBISE (100 Marks)`,
    });
  }

  // 5. Urdu Compulsory (Verified against official FBISE Urdu SSC-II & HSSC-II PDFs)
  if (subject === 'Urdu') {
    if (ssc) {
      return makePattern({
        mcqCount: 15,
        mcqMarks: 1,
        sectionATimeMinutes: 20,
        shortCount: 15,
        shortMarks: 2,
        shortChoiceNote: `حصہ دوم: تمام مختصر سوالات کے جوابات تحریر کریں (نثر 7، نظم و غزل 5، قواعد 3 — اندرونی انتخاب موجود ہے)۔ (15 × 2 = 30)`,
        longCount: 5,
        longMarks: 6,
        longChoiceNote: `حصہ سوم: تمام تفصیلی سوالات (اقتباس، اشعار کی تشریح، درخواست/کہانی اور مضمون) حل کریں۔ (5 × 6 = 30)`,
        totalTimeMinutes: 180,
        titleTag: `${boardLevelCode} Urdu · Official FBISE (75 Marks)`,
      });
    }
    return makePattern({
      mcqCount: 20,
      mcqMarks: 1,
      sectionATimeMinutes: 25,
      shortCount: 12,
      shortMarks: 3,
      shortChoiceNote: `حصہ دوم: تمام مختصر سوالات کے جوابات تحریر کریں (نثر 5، نظم 3، غزل 2، قواعد 2 — اندرونی انتخاب موجود ہے)۔ (12 × 3 = 36)`,
      longCount: 4,
      longMarks: 11,
      longChoiceNote: `حصہ سوم: تمام تفصیلی سوالات (سیاق و سباق، اشعار کی تشریح، خط/روداد اور مضمون) حل کریں۔ (4 × 11 = 44)`,
      totalTimeMinutes: 180,
      titleTag: `${boardLevelCode} Urdu · Official FBISE (100 Marks)`,
    });
  }

  // 6. Arts & Humanities Electives
  if (ssc) {
    return makePattern({
      mcqCount: 15,
      mcqMarks: 1,
      sectionATimeMinutes: 20,
      shortCount: 12,
      shortMarks: 3,
      shortChoiceNote: `Attempt all 12 parts from Section 'B' on the E-sheet (internal OR choice provided). (12 × 3 = 36)`,
      longCount: 3,
      longMarks: 8,
      longChoiceNote: `Attempt all questions (Q.3, Q.4, Q.5) from Section 'C' (internal OR choice provided). (3 × 8 = 24)`,
      totalTimeMinutes: 180,
      titleTag: `${boardLevelCode} ${subject} · Official FBISE (75 Marks)`,
    });
  }

  if (HSSC_PRACTICAL_ARTS.has(subject)) {
    if (mode === 'scheme_2006') {
      return makePattern({
        mcqCount: 17,
        mcqMarks: 1,
        sectionATimeMinutes: 25,
        shortCount: 14,
        shortMarks: 3,
        shortChoiceNote: `Attempt all 14 parts from Section 'B' (internal OR choice provided). (14 × 3 = 42)`,
        longCount: 2,
        longMarks: 13,
        longChoiceNote: `Attempt both questions (Q.3 & Q.4) from Section 'C' (internal OR choice provided). (2 × 13 = 26)`,
        totalTimeMinutes: 180,
        titleTag: `${boardLevelCode} ${subject} · Practical Elective (85 Marks)`,
      });
    }
    return makePattern({
      mcqCount: 17,
      mcqMarks: 1,
      sectionATimeMinutes: 25,
      shortCount: 13,
      shortMarks: 3,
      shortChoiceNote: `Attempt all 13 parts from Section 'B' on the E-sheet (internal OR choice provided). (13 × 3 = 39)`,
      longCount: 4,
      longMarks: 6,
      longChoiceNote: `Attempt all questions (Q.3 to Q.6) from Section 'C' (internal OR choice provided). (4 × 6 = 24)`,
      totalTimeMinutes: 180,
      titleTag: `${boardLevelCode} ${subject} · Official FBISE (80 Marks)`,
    });
  }

  // HSSC Non-Practical Arts Electives (100 Marks: Civics, Economics, Education, Islamic Studies, History, Sociology, General Science, General Math)
  return makePattern({
    mcqCount: 20,
    mcqMarks: 1,
    sectionATimeMinutes: 25,
    shortCount: 10,
    shortMarks: 4,
    shortChoiceNote: `Attempt all 10 parts from Section 'B' on the E-sheet (internal OR choice provided). (10 × 4 = 40)`,
    longCount: 4,
    longMarks: 10,
    longChoiceNote: `Attempt all questions (Q.3 to Q.6) from Section 'C' (internal OR choice provided). (4 × 10 = 40)`,
    totalTimeMinutes: 180,
    titleTag: `${boardLevelCode} ${subject} · Official FBISE (100 Marks)`,
  });
}
