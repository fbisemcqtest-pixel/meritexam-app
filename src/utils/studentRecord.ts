import {
  AttemptQuestionBreakdown,
  MCQTest,
  TestAttempt,
  UserAccount,
  getAttemptBreakdown,
} from '../types';

export function parseRecordTimestampMs(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const ms = new Date(trimmed).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === 'object') {
    const maybeTs = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof maybeTs.toDate === 'function') {
      const ms = maybeTs.toDate().getTime();
      return Number.isNaN(ms) ? null : ms;
    }
    if (typeof maybeTs.seconds === 'number') {
      return maybeTs.seconds * 1000;
    }
    if (typeof maybeTs._seconds === 'number') {
      return maybeTs._seconds * 1000;
    }
  }
  return null;
}

const IMMEDIATE_TEST_AUTO_CLOSE_MS = 12 * 60 * 60 * 1000;

/**
 * Computes the effective closing timestamp (ms) for an exam:
 * 1. Explicit `scheduledEndAt` if set.
 * 2. Otherwise `scheduledReleaseAt + durationMinutes` (min 15m) for scheduled papers.
 * 3. Otherwise `createdAt + max(durationMinutes, 12h)` for unscheduled "Start Now" papers
 *    so old exams never stay on Student Login indefinitely.
 */
export function getEffectiveTestEndMs(
  test: Pick<MCQTest, 'scheduledEndAt' | 'scheduledReleaseAt' | 'durationMinutes' | 'createdAt'>,
): number | null {
  const explicitEndMs = parseRecordTimestampMs(test.scheduledEndAt);
  if (explicitEndMs !== null) return explicitEndMs;

  const durationMins = Math.max(Number(test.durationMinutes) || 60, 15);
  const startMs = parseRecordTimestampMs(test.scheduledReleaseAt);
  if (startMs !== null) {
    return startMs + durationMins * 60_000;
  }

  const createdMs = parseRecordTimestampMs(test.createdAt);
  if (createdMs !== null) {
    return createdMs + Math.max(durationMins * 60_000, IMMEDIATE_TEST_AUTO_CLOSE_MS);
  }

  return null;
}

export interface StudentRecordRow {
  key: string;
  kind: 'present' | 'cancelled' | 'absent';
  testId: string;
  title: string;
  grade: string;
  subject: string;
  sortMs: number;
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  resultReleased: boolean;
  autoCancelled: boolean;
  breakdown: AttemptQuestionBreakdown;
  attempt?: TestAttempt;
  missedTest?: MCQTest;
}

export interface StudentPerformanceReport {
  studentUid: string;
  studentName: string;
  studentEmail: string;
  studentGrade: string;
  studentIdentifier: string;
  totalTestsCount: number;
  givenCount: number;
  cancelledCount: number;
  missedCount: number;
  heldCount: number;
  totalObtainedMarks: number;
  totalPossibleMarks: number;
  overallPercentage: number;
  givenObtainedMarks: number;
  givenPossibleMarks: number;
  givenPercentage: number;
  rows: StudentRecordRow[];
}

function roundTwo(val: number): number {
  return Math.round(val * 100) / 100;
}

function roundOne(val: number): number {
  return Math.round(val * 10) / 10;
}

export function buildStudentPerformanceReport(input: {
  student: Pick<UserAccount, 'uid' | 'fullName' | 'email' | 'grade' | 'identifier'>;
  allAttempts: TestAttempt[];
  conductedTests: MCQTest[];
  includeHeldScores: boolean;
  nowMs?: number;
}): StudentPerformanceReport {
  const { student, allAttempts, conductedTests, includeHeldScores } = input;
  const nowMs = input.nowMs ?? Date.now();
  const studentAttempts = allAttempts.filter((a) => a.studentId === student.uid);

  const attemptByTestId = new Map<string, TestAttempt>();
  studentAttempts.forEach((a) => {
    if (!attemptByTestId.has(a.testId)) {
      attemptByTestId.set(a.testId, a);
    }
  });

  const rows: StudentRecordRow[] = [];

  studentAttempts.forEach((attempt) => {
    const totalMarks = roundTwo(
      attempt.totalMarks ??
        (attempt.totalQuestions || 0) * (attempt.marksPerQuestion ?? 1),
    );
    const obtainedMarks = roundTwo(attempt.obtainedMarks ?? attempt.score ?? 0);
    const breakdown = getAttemptBreakdown(attempt);
    const kind: 'present' | 'cancelled' = attempt.autoCancelled ? 'cancelled' : 'present';

    rows.push({
      key: `attempt_${attempt.id}`,
      kind,
      testId: attempt.testId,
      title: attempt.testTitle,
      grade: attempt.grade,
      subject: attempt.subject,
      sortMs: parseRecordTimestampMs(attempt.submittedAt) ?? 0,
      obtainedMarks,
      totalMarks,
      percentage: attempt.percentage ?? (totalMarks > 0 ? roundOne((obtainedMarks / totalMarks) * 100) : 0),
      resultReleased: Boolean(attempt.resultReleased),
      autoCancelled: Boolean(attempt.autoCancelled),
      breakdown,
      attempt,
    });
  });

  const studentGrade = String(student.grade).trim();
  const hasSingleGrade = ['9th', '10th', '1st A', '2nd Year'].includes(studentGrade);
  conductedTests.forEach((test) => {
    if (!hasSingleGrade || !test.isActive || test.createdByRole === 'student_practice') return;
    const endMs = getEffectiveTestEndMs(test);
    if (endMs === null || nowMs <= endMs) return;

    const allowed =
      test.allowedGrades && test.allowedGrades.length > 0
        ? test.allowedGrades
        : [test.grade];
    const matchesClass = allowed.some((g) => String(g).trim() === studentGrade);
    if (!matchesClass) return;
    if (attemptByTestId.has(test.id)) return;

    const totalQs = test.questionCount || test.questions?.length || 0;
    const totalMarks = roundTwo(totalQs * (test.marksPerQuestion ?? 1));

    rows.push({
      key: `absent_${test.id}_${student.uid}`,
      kind: 'absent',
      testId: test.id,
      title: test.title,
      grade: test.grade,
      subject: test.subject,
      sortMs: endMs,
      obtainedMarks: 0,
      totalMarks,
      percentage: 0,
      resultReleased: true,
      autoCancelled: false,
      breakdown: {
        total: totalQs,
        attempted: 0,
        correct: 0,
        wrong: 0,
        skipped: totalQs,
      },
      missedTest: test,
    });
  });

  rows.sort((a, b) => b.sortMs - a.sortMs);

  let givenCount = 0;
  let cancelledCount = 0;
  let missedCount = 0;
  let heldCount = 0;
  let totalObtainedMarks = 0;
  let totalPossibleMarks = 0;
  let givenObtainedMarks = 0;
  let givenPossibleMarks = 0;

  rows.forEach((row) => {
    if (row.kind === 'absent') {
      missedCount += 1;
      totalPossibleMarks += row.totalMarks;
      return;
    }

    if (row.kind === 'cancelled') {
      cancelledCount += 1;
    } else {
      givenCount += 1;
    }

    if (!row.resultReleased) {
      heldCount += 1;
    }

    const canCountMarks = includeHeldScores || row.resultReleased;
    if (canCountMarks) {
      totalObtainedMarks += row.obtainedMarks;
      totalPossibleMarks += row.totalMarks;
      givenObtainedMarks += row.obtainedMarks;
      givenPossibleMarks += row.totalMarks;
    }
  });

  const roundedTotalObtained = roundTwo(totalObtainedMarks);
  const roundedTotalPossible = roundTwo(totalPossibleMarks);
  const roundedGivenObtained = roundTwo(givenObtainedMarks);
  const roundedGivenPossible = roundTwo(givenPossibleMarks);

  return {
    studentUid: student.uid,
    studentName: student.fullName,
    studentEmail: student.email,
    studentGrade: student.grade,
    studentIdentifier: student.identifier || student.uid.slice(0, 8),
    totalTestsCount: givenCount + cancelledCount + missedCount,
    givenCount,
    cancelledCount,
    missedCount,
    heldCount,
    totalObtainedMarks: roundedTotalObtained,
    totalPossibleMarks: roundedTotalPossible,
    overallPercentage:
      roundedTotalPossible > 0
        ? roundOne((roundedTotalObtained / roundedTotalPossible) * 100)
        : 0,
    givenObtainedMarks: roundedGivenObtained,
    givenPossibleMarks: roundedGivenPossible,
    givenPercentage:
      roundedGivenPossible > 0
        ? roundOne((roundedGivenObtained / roundedGivenPossible) * 100)
        : 0,
    rows,
  };
}
