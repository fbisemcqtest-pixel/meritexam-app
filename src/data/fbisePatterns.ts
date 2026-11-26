import { ExamBoard, GradeLevel, SubjectName } from '../types';

export type FbisePatternMode =
  | 'reformed_50_50'
  | 'official_new'
  | 'apsacs_official'
  | 'scheme_2006';

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
  /** Exact per-question marks when Section C questions carry different weights (e.g. [7, 6, 7, 6] = 26 Marks in legacy 12th Phy/Bio). */
  longMarksList?: number[];
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
    value: 'reformed_50_50',
    label: 'New FBISE / APSACS Pattern (50% MCQs / 50% Descriptive — 2026–27)',
    shortLabel: 'New 50/50 (2026–27)',
    description:
      'FBISE Notification 1-10/FBISE/RES/242 (Aug 2026): STEM 50% MCQs (0.5/0.75 marks) + 50% Descriptive; Compulsory/Arts Inclusive Scheme 2024',
  },
  {
    value: 'official_new',
    label: 'FBISE / APSACS Inclusive Scheme 2024 (20% MCQs / 80% Descriptive)',
    shortLabel: 'Inclusive Scheme 2024',
    description:
      'Official 2025–26 Inclusive Scheme Model Papers (9th/10th Sci & CS 60, 11th/12th Sci & CS 80, 10th PST 100, Math/Eng/Urdu 75/100)',
  },
  {
    value: 'scheme_2006',
    label: 'Legacy Scheme 2006 (Compartments / Old 65-85)',
    shortLabel: 'Legacy Scheme 2006',
    description:
      'Old Scheme 2006 distribution (10th Sci 65 / CS 55, 12th Sci 85 / CS 75, PST 50 Marks)',
  },
];

const SCIENCE_SUBJECTS = new Set<SubjectName>([
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
]);

const COMPULSORY_SOCIAL_SUBJECTS = new Set<SubjectName>(['Islamiat', 'Pakistan Studies']);

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

export function getRomanGradeNumeral(grade: GradeLevel): 'IX' | 'X' | 'XI' | 'XII' {
  switch (grade) {
    case '9th':
      return 'IX';
    case '10th':
      return 'X';
    case '1st A':
      return 'XI';
    case '2nd Year':
      return 'XII';
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
  if (mcqCount >= 64) return 100;
  if (mcqCount >= 45) return 80;
  if (mcqCount >= 35) return 60;
  if (mcqCount <= 10) return 15;
  if (mcqCount <= 15) return 20;
  return isSscGrade(grade) ? 20 : 25;
}

export function getOfficialPattern(
  board: ExamBoard,
  grade: GradeLevel,
  subject: SubjectName,
  rawMode: FbisePatternMode = 'reformed_50_50',
): OfficialPaperPattern {
  const mode: FbisePatternMode = rawMode === 'apsacs_official' ? 'official_new' : rawMode;
  const ssc = isSscGrade(grade);
  const boardLevelCode = getBoardLevelCode(grade);
  const boardTitlePrefix =
    board === 'punjab_ptb'
      ? 'Punjab Board (PTB)'
      : 'FBISE / APSACS';

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
    longMarksList?: number[];
    longChoiceNote: string;
    totalTimeMinutes: number;
    titleTag: string;
    shortHasOr?: boolean;
    longHasOr?: boolean;
  }): OfficialPaperPattern => {
    const sectionAMarks = Math.round(spec.mcqCount * spec.mcqMarks * 100) / 100;
    const sectionBMarks = Math.round(spec.shortCount * spec.shortMarks * 100) / 100;
    const sectionCMarks = spec.longMarksList
      ? Math.round(spec.longMarksList.reduce((acc, m) => acc + m, 0) * 100) / 100
      : Math.round(spec.longCount * spec.longMarks * 100) / 100;
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
      ...(spec.longMarksList ? { longMarksList: spec.longMarksList } : {}),
      longHasOr: spec.longHasOr ?? true,
      longChoiceNote: spec.longChoiceNote,
      sectionCMarks,
    };
  };

  const schemeTag =
    mode === 'reformed_50_50'
      ? 'FBISE Inclusive Scheme 2024'
      : 'Official FBISE Inclusive Scheme';

  // 1. Compulsory Islamiat & Pakistan Studies (Always Inclusive Scheme 2024 except legacy scheme_2006)
  if (COMPULSORY_SOCIAL_SUBJECTS.has(subject)) {
    // 9th Islamiat Inclusive Scheme (100 Marks: 20 + 36 + 44)
    if (subject === 'Islamiat' && grade === '9th' && mode !== 'scheme_2006') {
      return makePattern({
        mcqCount: 20,
        mcqMarks: 1,
        sectionATimeMinutes: 25,
        shortCount: 12,
        shortMarks: 3,
        shortChoiceNote: `حصہ دوم کے تمام 12 مختصر سوالات کے جوابات تحریر کریں (اندرونی انتخاب موجود ہے)۔ (12 × 3 = 36)`,
        longCount: 4,
        longMarks: 11,
        longMarksList: [10, 10, 10, 14],
        longChoiceNote: `حصہ سوم (3 × 10 = 30) اور حصہ چہارم منتخب احادیث (14 نمبر) کے سوالات حل کریں۔ (کل 44 نمبر)`,
        totalTimeMinutes: 180,
        titleTag: `${boardLevelCode} Islamiat · ${schemeTag} (100 Marks)`,
      });
    }
    // 10th Pakistan Studies Inclusive Scheme 2024 (100 Marks: 20 + 10×5=50 + 3×10=30)
    if (subject === 'Pakistan Studies' && grade === '10th' && mode !== 'scheme_2006') {
      return makePattern({
        mcqCount: 20,
        mcqMarks: 1,
        sectionATimeMinutes: 25,
        shortCount: 10,
        shortMarks: 5,
        shortChoiceNote: `Attempt all 10 parts from Section 'B' on the E-sheet (internal OR choice provided). (10 × 5 = 50)`,
        longCount: 3,
        longMarks: 10,
        longChoiceNote: `Attempt all 3 questions (Q.3, Q.4 & Q.5) from Section 'C' (internal OR choice provided). (3 × 10 = 30)`,
        totalTimeMinutes: 180,
        titleTag: `${boardLevelCode} Pakistan Studies · ${schemeTag} (100 Marks)`,
      });
    }
    // 11th Islamiat (50 Marks: 10 + 18 + 22)
    if (subject === 'Islamiat' && grade === '1st A' && mode !== 'scheme_2006') {
      return makePattern({
        mcqCount: 10,
        mcqMarks: 1,
        sectionATimeMinutes: 15,
        shortCount: 6,
        shortMarks: 3,
        shortChoiceNote: `حصہ دوم کے تمام 6 مختصر سوالات کے جوابات تحریر کریں (اندرونی انتخاب موجود ہے)۔ (6 × 3 = 18)`,
        longCount: 3,
        longMarks: 8,
        longMarksList: [8, 8, 6],
        longChoiceNote: `حصہ سوم (2 × 8 = 16) اور منتخب احادیث/سوال (6 نمبر) حل کریں۔ (کل 22 نمبر)`,
        totalTimeMinutes: 150,
        titleTag: `${boardLevelCode} Islamiat · ${schemeTag} (50 Marks)`,
      });
    }
    // 10th Islamiat, 12th Pakistan Studies & Legacy 50-Mark pattern (10 + 24 + 16 = 50 Marks)
    return makePattern({
      mcqCount: 10,
      mcqMarks: 1,
      sectionATimeMinutes: 15,
      shortCount: 8,
      shortMarks: 3,
      shortChoiceNote: `Attempt all 8 parts from Section 'B' on the E-sheet (internal OR choice provided). (8 × 3 = 24)`,
      longCount: 2,
      longMarks: 8,
      longChoiceNote: `Attempt both questions (Q.3 & Q.4) from Section 'C' (internal OR choice provided). (2 × 8 = 16)`,
      totalTimeMinutes: 150,
      titleTag: `${boardLevelCode} ${subject} · ${mode === 'scheme_2006' ? 'Legacy Scheme 2006' : schemeTag} (50 Marks)`,
    });
  }

  // 2. Science & Technology Subjects (Physics, Chemistry, Biology, Computer Science)
  if (SCIENCE_SUBJECTS.has(subject)) {
    const isCs = subject === 'Computer Science';

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
          titleTag: `${boardLevelCode} ${subject} · New 50/50 Pattern (60 Marks)`,
        });
      }

      // Legacy Scheme 2006: 55 Marks CS (13 + 22 + 20), 65 Marks Phy/Chem/Bio (12 + 33 + 20)
      if (mode === 'scheme_2006') {
        if (isCs) {
          return makePattern({
            mcqCount: 13,
            mcqMarks: 1,
            sectionATimeMinutes: 20,
            shortCount: 11,
            shortMarks: 2,
            shortChoiceNote: `Attempt all 11 parts from Section 'B' on the E-sheet (internal OR choice provided). (11 × 2 = 22)`,
            longCount: 4,
            longMarks: 5,
            longChoiceNote: `Attempt all questions (Q.3 to Q.6) from Section 'C' (internal OR choice provided). (4 × 5 = 20)`,
            totalTimeMinutes: 180,
            titleTag: `${boardLevelCode} Computer Science · Legacy Scheme 2006 (55 Marks)`,
          });
        }
        return makePattern({
          mcqCount: 12,
          mcqMarks: 1,
          sectionATimeMinutes: 20,
          shortCount: 11,
          shortMarks: 3,
          shortChoiceNote: `Attempt all 11 parts from Section 'B' on the E-sheet (internal OR choice provided). (11 × 3 = 33)`,
          longCount: 4,
          longMarks: 5,
          longChoiceNote: `Attempt all questions (Q.3 to Q.6) from Section 'C' (internal OR choice provided). (4 × 5 = 20)`,
          totalTimeMinutes: 180,
          titleTag: `${boardLevelCode} ${subject} · Legacy Scheme 2006 (65 Marks)`,
        });
      }

      // SSC-I (9th) & SSC-II (10th) Inclusive Scheme 2024 & APSACS (60 Marks: 12 + 30 + 18)
      return makePattern({
        mcqCount: 12,
        mcqMarks: 1,
        sectionATimeMinutes: 20,
        shortCount: 10,
        shortMarks: 3,
        shortChoiceNote: `Attempt all 10 parts from Section 'B' on the E-sheet (internal OR choice provided). (10 × 3 = 30)`,
        longCount: 3,
        longMarks: 6,
        longChoiceNote: `Attempt all questions (Q.3, Q.4, Q.5) from Section 'C' (internal OR choice provided). (3 × 6 = 18)`,
        totalTimeMinutes: 180,
        titleTag: `${boardLevelCode} ${subject} · Inclusive Scheme 2024 (60 Marks)`,
      });
    }

    // HSSC Sciences (11th / 12th)
    if (mode === 'reformed_50_50') {
      return makePattern({
        mcqCount: 80,
        mcqMarks: 0.5,
        sectionATimeMinutes: 100,
        shortCount: 7,
        shortMarks: 4,
        shortChoiceNote: `Attempt all 7 parts from Section 'B' on the E-sheet (internal OR choice provided). (7 × 4 = 28)`,
        longCount: 2,
        longMarks: 6,
        longChoiceNote: `Attempt both questions (Q.3 & Q.4) from Section 'C' (internal OR choice provided). (2 × 6 = 12)`,
        totalTimeMinutes: 180,
        titleTag: `${boardLevelCode} ${subject} · New 50/50 Pattern (80 Marks)`,
      });
    }

    // Legacy Scheme 2006: 75 Marks CS (13 + 42 + 20), 85 Marks Phy/Chem/Bio (17 + 42 + 26)
    if (mode === 'scheme_2006') {
      if (isCs) {
        return makePattern({
          mcqCount: 13,
          mcqMarks: 1,
          sectionATimeMinutes: 20,
          shortCount: 14,
          shortMarks: 3,
          shortChoiceNote: `Attempt all 14 parts from Section 'B' on the E-sheet (internal OR choice provided). (14 × 3 = 42)`,
          longCount: 4,
          longMarks: 5,
          longChoiceNote: `Attempt all questions (Q.3 to Q.6) from Section 'C' (internal OR choice provided). (4 × 5 = 20)`,
          totalTimeMinutes: 180,
          titleTag: `${boardLevelCode} Computer Science · Legacy Scheme 2006 (75 Marks)`,
        });
      }
      const marksList = subject === 'Chemistry' ? [6, 6, 7, 7] : [7, 6, 7, 6];
      return makePattern({
        mcqCount: 17,
        mcqMarks: 1,
        sectionATimeMinutes: 25,
        shortCount: 14,
        shortMarks: 3,
        shortChoiceNote: `Attempt all 14 parts from Section 'B' on the E-sheet (internal OR choice provided). (14 × 3 = 42)`,
        longCount: 4,
        longMarks: 7,
        longMarksList: marksList,
        longChoiceNote: `Attempt ALL questions (Q.3–Q.6). Marks of each question are given within brackets (${marksList.join(' + ')} = 26 Marks, with internal OR).`,
        totalTimeMinutes: 180,
        titleTag: `${boardLevelCode} ${subject} · Legacy Scheme 2006 (85 Marks)`,
      });
    }

    // HSSC-I (11th) & HSSC-II (12th) Inclusive Scheme 2024 & APSACS (80 Marks: 17 + 39 + 24)
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
      titleTag: `${boardLevelCode} ${subject} · Inclusive Scheme 2024 (80 Marks)`,
    });
  }

  // 3. Mathematics
  if (subject === 'Math') {
    if (ssc) {
      if (mode === 'reformed_50_50') {
        return makePattern({
          mcqCount: 48,
          mcqMarks: 0.75,
          sectionATimeMinutes: 80,
          shortCount: 7,
          shortMarks: 3,
          shortChoiceNote: `Attempt all 7 parts from Section 'B' on the E-sheet (internal OR choice provided). (7 × 3 = 21)`,
          longCount: 3,
          longMarks: 6,
          longChoiceNote: `Attempt all 3 questions (Q.3, Q.4 & Q.5) from Section 'C' (internal OR choice provided). (3 × 6 = 18)`,
          totalTimeMinutes: 180,
          titleTag: `${boardLevelCode} Mathematics · New 50/50 Pattern (75 Marks)`,
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
        mcqCount: 64,
        mcqMarks: 0.75,
        sectionATimeMinutes: 100,
        shortCount: 7,
        shortMarks: 4,
        shortChoiceNote: `Attempt all 7 parts from Section 'B' on the E-sheet (internal OR choice provided). (7 × 4 = 28)`,
        longCount: 3,
        longMarks: 8,
        longChoiceNote: `Attempt all 3 questions (Q.3, Q.4, Q.5) from Section 'C' (internal OR choice provided). (3 × 8 = 24)`,
        totalTimeMinutes: 180,
        titleTag: `${boardLevelCode} Mathematics · New 50/50 Pattern (100 Marks)`,
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
    if (grade === '9th') {
      return makePattern({
        mcqCount: 15,
        mcqMarks: 1,
        sectionATimeMinutes: 20,
        shortCount: 10,
        shortMarks: 4,
        shortChoiceNote: `Attempt all 10 parts from Section 'B' (Unseen Comprehension + Poetry Stanza + Applied Grammar with internal OR). (40 Marks)`,
        longCount: 3,
        longMarks: 7,
        longMarksList: [6, 6, 8],
        longChoiceNote: `Attempt all questions from Section 'C' (Formal Letter/Application 8, Dialogue/Translation/Grammar 6+6 = 20 Marks).`,
        totalTimeMinutes: 180,
        titleTag: `${boardLevelCode} English · Official FBISE (75 Marks)`,
      });
    }
    if (grade === '10th') {
      return makePattern({
        mcqCount: 15,
        mcqMarks: 1,
        sectionATimeMinutes: 20,
        shortCount: 13,
        shortMarks: 3,
        shortChoiceNote: `Attempt Section 'B' (Unseen Passage Precis & Qs, Stanza Comprehension & Grammar = 39 Marks).`,
        longCount: 3,
        longMarks: 7,
        longChoiceNote: `Attempt all questions from Section 'C' (Narrative/Essay, Letter/Application & Applied Grammar = 21 Marks).`,
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
      shortChoiceNote: `Attempt Section 'B' (Unseen Prose Summary/Comprehension, Poetry Stanzas & Grammar = 40 Marks).`,
      longCount: 4,
      longMarks: 10,
      longMarksList: [12, 10, 10, 8],
      longChoiceNote: `Attempt all questions from Section 'C' (Essay 12, Job Application/Report 10, Idioms/Grammar 10, Precis/Analysis 8 = 40 Marks).`,
      totalTimeMinutes: 180,
      titleTag: `${boardLevelCode} English · Official FBISE (100 Marks)`,
    });
  }

  // 5. Urdu Compulsory (Verified against official FBISE Urdu SSC & HSSC PDFs)
  if (subject === 'Urdu') {
    if (ssc) {
      return makePattern({
        mcqCount: 15,
        mcqMarks: 1,
        sectionATimeMinutes: 20,
        shortCount: 17,
        shortMarks: 2,
        shortChoiceNote: `حصہ دوم: تمام مختصر سوالات کے جوابات تحریر کریں (نثر 8، نظم و غزل 5، قواعد 4 — اندرونی انتخاب موجود ہے)۔ (17 × 2 = 34)`,
        longCount: 4,
        longMarks: 7,
        longMarksList: [6, 6, 6, 8],
        longChoiceNote: `حصہ سوم: تمام تفصیلی سوالات (اقتباس، اشعار کی تشریح، درخواست/خط اور مضمون) حل کریں۔ (26 نمبر)`,
        totalTimeMinutes: 180,
        titleTag: `${boardLevelCode} Urdu · Official FBISE (75 Marks)`,
      });
    }
    if (grade === '1st A') {
      return makePattern({
        mcqCount: 20,
        mcqMarks: 1,
        sectionATimeMinutes: 25,
        shortCount: 12,
        shortMarks: 4,
        shortChoiceNote: `حصہ دوم: تمام مختصر سوالات کے جوابات تحریر کریں (نثر 6×4=24، نظم 3×4=12، غزل 4، قواعد 8 — کل 48 نمبر)۔`,
        longCount: 4,
        longMarks: 8,
        longMarksList: [9, 7, 8, 8],
        longChoiceNote: `حصہ سوم: تمام تفصیلی سوالات (اشعار کی تشریح، خط/روداد، تلخیص اور مضمون) حل کریں۔ (32 نمبر)`,
        totalTimeMinutes: 180,
        titleTag: `${boardLevelCode} Urdu · Official FBISE (100 Marks)`,
      });
    }
    return makePattern({
      mcqCount: 20,
      mcqMarks: 1,
      sectionATimeMinutes: 25,
      shortCount: 13,
      shortMarks: 3,
      shortChoiceNote: `حصہ دوم: تمام مختصر سوالات کے جوابات تحریر کریں (نثر 6، نظم 3، غزل 2، قواعد 2 — 13 × 3 = 39 نمبر)۔`,
      longCount: 4,
      longMarks: 10,
      longMarksList: [9, 10, 10, 12],
      longChoiceNote: `حصہ سوم: تمام تفصیلی سوالات (سیاق و سباق، اشعار کی تشریح، خط/روداد اور مضمون) حل کریں۔ (41 نمبر)`,
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
        longCount: 4,
        longMarks: 7,
        longMarksList: [7, 6, 7, 6],
        longChoiceNote: `Attempt all questions (Q.3 to Q.6) from Section 'C' (internal OR choice provided). (26 Marks)`,
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
