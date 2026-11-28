import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Lock,
  LogOut,
  Play,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import {
  getActiveEditionClass,
  getClassPathSlug,
  getEditionAllowedGrades,
  getEditionLabel,
  getEditionShortBadge,
  isBuildLockedEdition,
  isEditionRestricted,
  isGradeAllowedInEdition,
} from '../config/appEdition';
import { OperationType, db, handleFirestoreError } from '../lib/firebase';
import {
  GRADE_LABELS,
  GradeLevel,
  MCQTest,
  SUBJECT_GROUPS,
  SubjectName,
  TestAttempt,
  getAttemptBreakdown,
  isSingleStudentGrade,
} from '../types';
import { TestRunner } from './TestRunner';
import { DeveloperFooter } from './DeveloperFooter';
import {
  buildStudentPerformanceReport,
  getEffectiveTestEndMs,
} from '../utils/studentRecord';

interface SubjectAccentStyle {
  bar: string;
  border: string;
  label: string;
  button: string;
}

const BLUE_ACCENT: SubjectAccentStyle = {
  bar: 'from-blue-600 to-indigo-600',
  border: 'border-blue-200/80',
  label: 'text-blue-700',
  button: 'bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800',
};

const TEAL_ACCENT: SubjectAccentStyle = {
  bar: 'from-teal-600 to-emerald-600',
  border: 'border-teal-200/80',
  label: 'text-teal-700',
  button: 'bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800',
};

const EMERALD_ACCENT: SubjectAccentStyle = {
  bar: 'from-emerald-600 to-green-600',
  border: 'border-emerald-200/80',
  label: 'text-emerald-700',
  button: 'bg-gradient-to-r from-emerald-700 to-green-700 hover:from-emerald-800 hover:to-green-800',
};

const AMBER_ACCENT: SubjectAccentStyle = {
  bar: 'from-amber-500 to-orange-600',
  border: 'border-amber-200/80',
  label: 'text-amber-700',
  button: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700',
};

const INDIGO_ACCENT: SubjectAccentStyle = {
  bar: 'from-indigo-600 to-purple-600',
  border: 'border-indigo-200/80',
  label: 'text-indigo-700',
  button: 'bg-gradient-to-r from-indigo-700 to-purple-700 hover:from-indigo-800 hover:to-purple-800',
};

const ROSE_ACCENT: SubjectAccentStyle = {
  bar: 'from-rose-600 to-pink-600',
  border: 'border-rose-200/80',
  label: 'text-rose-700',
  button: 'bg-gradient-to-r from-rose-700 to-pink-700 hover:from-rose-800 hover:to-pink-800',
};

function getSubjectAccent(subject: SubjectName): SubjectAccentStyle {
  if (subject === 'Physics' || subject === 'Computer Science') return BLUE_ACCENT;
  if (subject === 'Chemistry' || subject === 'General Science') return TEAL_ACCENT;
  if (
    subject === 'Biology' ||
    subject === 'Pakistan Studies' ||
    subject === 'Geography' ||
    subject === 'Islamiat' ||
    subject === 'Islamic Studies'
  ) {
    return EMERALD_ACCENT;
  }
  if (subject === 'Math' || subject === 'General Math' || subject === 'Economics') {
    return AMBER_ACCENT;
  }
  if (subject === 'Urdu' || subject === 'Home Economics') {
    return ROSE_ACCENT;
  }
  return INDIGO_ACCENT;
}

function parseTimestampMs(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const ms = new Date(trimmed).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === 'object') {
    const maybeTs = value as { toDate?: () => Date; seconds?: number };
    if (typeof maybeTs.toDate === 'function') {
      const ms = maybeTs.toDate().getTime();
      return Number.isNaN(ms) ? null : ms;
    }
    if (typeof maybeTs.seconds === 'number') {
      return maybeTs.seconds * 1000;
    }
  }
  return null;
}

function getScheduledStartMs(test: MCQTest): number | null {
  return parseTimestampMs(test.scheduledReleaseAt);
}

function getScheduledEndMs(test: MCQTest): number | null {
  return getEffectiveTestEndMs(test);
}

function formatCountdownParts(diffMs: number) {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    days,
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(seconds),
    totalHours: pad(days * 24 + hours),
  };
}

export function StudentDashboard() {
  const { userProfile, systemSettings, updateOwnStudentClass, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'tests' | 'results' | 'answer_key'>('tests');
  const [subjectFilter, setSubjectFilter] = useState<SubjectName | 'All'>('All');

  const [activeTests, setActiveTests] = useState<MCQTest[]>([]);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const activeEdition = getActiveEditionClass();
  const buildLocked = isBuildLockedEdition();
  const isRestrictedEdition = isEditionRestricted(activeEdition);
  const editionGrades = getEditionAllowedGrades(activeEdition);
  const editionLabel = getEditionLabel(activeEdition);
  const editionBadge = getEditionShortBadge(activeEdition);

  // Legacy 'All' class migration gate state
  const [selectedClassToLock, setSelectedClassToLock] = useState<GradeLevel>(editionGrades[0]);
  const [savingClassLock, setSavingClassLock] = useState(false);
  const [classLockError, setClassLockError] = useState<string | null>(null);

  // Active Test Runner state
  const [runningTest, setRunningTest] = useState<MCQTest | null>(null);
  const [reviewingAttempt, setReviewingAttempt] = useState<TestAttempt | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!userProfile) return;

    const testsQuery = query(
      collection(db, 'tests'),
      where('isActive', '==', true),
    );
    const unsubTests = onSnapshot(
      testsQuery,
      (snap) => {
        setActiveTests(snap.docs.map((d) => d.data() as MCQTest));
        setLoadError(null);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        setLoadError('Unable to load examinations right now. Please refresh or contact your administrator.');
        try {
          handleFirestoreError(error, OperationType.LIST, 'tests');
        } catch (err) {
          console.error(err);
        }
      },
    );

    const attemptsQuery = query(
      collection(db, 'attempts'),
      where('studentId', '==', userProfile.uid),
    );
    const unsubAttempts = onSnapshot(
      attemptsQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as TestAttempt);
        list.sort((a, b) => {
          const aSec = (a.submittedAt as { seconds?: number } | undefined)?.seconds ?? 0;
          const bSec = (b.submittedAt as { seconds?: number } | undefined)?.seconds ?? 0;
          return bSec - aSec;
        });
        setAttempts(list);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'attempts');
        } catch (err) {
          console.error(err);
        }
      },
    );

    return () => {
      unsubTests();
      unsubAttempts();
    };
  }, [userProfile]);

  const studentGrade = userProfile?.grade;

  const attemptsByTestId = useMemo(() => {
    const map = new Map<string, TestAttempt>();
    attempts.forEach((a) => {
      if (!map.has(a.testId)) {
        map.set(a.testId, a);
      }
    });
    return map;
  }, [attempts]);

  const activeTestsById = useMemo(() => {
    const map = new Map<string, MCQTest>();
    activeTests.forEach((t) => map.set(t.id, t));
    return map;
  }, [activeTests]);

  const eligibleClassTests = useMemo(() => {
    const normalizedStudentGrade = studentGrade?.trim();
    if (!normalizedStudentGrade || !isSingleStudentGrade(normalizedStudentGrade)) {
      return [];
    }
    return activeTests
      .filter((t) => t.isActive === true && t.createdByRole !== 'student_practice')
      .filter((t) => {
        const allowed =
          t.allowedGrades && t.allowedGrades.length > 0 ? t.allowedGrades : [t.grade];
        return allowed.some((g) => String(g).trim() === normalizedStudentGrade);
      });
  }, [activeTests, studentGrade]);

  const allPendingToTakeTests = useMemo(() => {
    return eligibleClassTests
      .filter((t) => {
        const endMs = getScheduledEndMs(t);
        return endMs === null || nowMs <= endMs;
      })
      .filter((t) => !attemptsByTestId.has(t.id));
  }, [eligibleClassTests, nowMs, attemptsByTestId]);

  const permittedTests = useMemo(() => {
    return allPendingToTakeTests
      .filter((t) => (subjectFilter === 'All' ? true : t.subject === subjectFilter))
      .sort((a, b) => {
        const aStart = getScheduledStartMs(a) ?? 0;
        const bStart = getScheduledStartMs(b) ?? 0;
        const aLocked = aStart > nowMs;
        const bLocked = bStart > nowMs;
        if (aLocked !== bLocked) return aLocked ? 1 : -1;
        return aStart - bStart;
      });
  }, [allPendingToTakeTests, subjectFilter, nowMs]);

  const upcomingScheduledTests = useMemo(() => {
    return permittedTests
      .filter((t) => {
        const startMs = getScheduledStartMs(t);
        return startMs !== null && startMs > nowMs;
      })
      .sort((a, b) => (getScheduledStartMs(a) ?? 0) - (getScheduledStartMs(b) ?? 0));
  }, [permittedTests, nowMs]);

  const allMissedTests = useMemo(() => {
    return eligibleClassTests
      .filter((t) => {
        const endMs = getScheduledEndMs(t);
        if (endMs === null || nowMs <= endMs) return false;
        return !attemptsByTestId.has(t.id);
      })
      .sort((a, b) => (getScheduledEndMs(b) ?? 0) - (getScheduledEndMs(a) ?? 0));
  }, [eligibleClassTests, nowMs, attemptsByTestId]);

  const totalResultsCount = attempts.length + allMissedTests.length;

  const resultAttendanceRows = useMemo(() => {
    type StudentRow =
      | { kind: 'attempt'; sortMs: number; attempt: TestAttempt }
      | { kind: 'absent'; sortMs: number; test: MCQTest; endMs: number };

    const rows: StudentRow[] = attempts.map((attempt) => ({
      kind: 'attempt',
      sortMs: parseTimestampMs(attempt.submittedAt) ?? 0,
      attempt,
    }));

    allMissedTests.forEach((test) => {
      const endMs = getScheduledEndMs(test) ?? 0;
      rows.push({
        kind: 'absent',
        sortMs: endMs,
        test,
        endMs,
      });
    });

    rows.sort((a, b) => b.sortMs - a.sortMs);
    return rows;
  }, [attempts, allMissedTests]);

  const answerKeyEligibleAttempts = useMemo(() => {
    const globalAllowed = systemSettings.allowStudentAnswerKeyReview === true;
    return attempts.filter((attempt) => {
      if (attempt.autoCancelled || !attempt.resultReleased) return false;
      if (!globalAllowed && attempt.answerKeyReleased !== true) return false;
      return activeTestsById.has(attempt.testId);
    });
  }, [attempts, systemSettings.allowStudentAnswerKeyReview, activeTestsById]);

  const hasAnswerKeyAccess = answerKeyEligibleAttempts.length > 0;

  useEffect(() => {
    if (activeTab === 'answer_key' && !hasAnswerKeyAccess) {
      setActiveTab('results');
    }
  }, [activeTab, hasAnswerKeyAccess]);

  const studentReport = useMemo(() => {
    if (!userProfile) return null;
    return buildStudentPerformanceReport({
      student: userProfile,
      allAttempts: attempts,
      conductedTests: activeTests,
      includeHeldScores: false,
      nowMs,
    });
  }, [userProfile, attempts, activeTests, nowMs]);

  function isAttemptAnswerKeyAllowed(attempt: TestAttempt): boolean {
    return (
      !attempt.autoCancelled &&
      Boolean(attempt.resultReleased) &&
      (systemSettings.allowStudentAnswerKeyReview === true ||
        attempt.answerKeyReleased === true)
    );
  }

  function handleOpenAttemptReview(attempt: TestAttempt) {
    if (!isAttemptAnswerKeyAllowed(attempt)) return;
    const matchedTest = activeTestsById.get(attempt.testId);
    if (!matchedTest) return;
    setReviewingAttempt(attempt);
    setRunningTest(matchedTest);
  }

  if (!userProfile) return null;

  if (!isSingleStudentGrade(userProfile.grade)) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200">
          <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-teal-500 to-amber-500" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
            <div className="font-display text-base sm:text-lg font-bold text-slate-900 inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-xs bg-gradient-to-br from-blue-600 to-indigo-600 shrink-0" />
              <span>MeritExam</span>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-xl bg-white border border-amber-300 rounded-xl overflow-hidden shadow-sm">
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 to-blue-600" />
            <div className="p-6 sm:p-8 space-y-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-900">
                    Select Your Single Enrolled Class
                  </h1>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                    Welcome, <span className="font-semibold text-slate-900">{userProfile.fullName}</span>. Your account previously had{' '}
                    <span className="font-semibold text-amber-800">All Classes</span> access. Under the updated student policy, every student account must belong to one specific class only.
                  </p>
                </div>
              </div>

              {classLockError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800">
                  {classLockError}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Choose Your Class (Required)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {editionGrades.map((g) => {
                    const active = selectedClassToLock === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setSelectedClassToLock(g)}
                        className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-600/20 text-blue-950'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                        }`}
                      >
                        <div className="font-display text-sm font-bold">{g}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{GRADE_LABELS[g]}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5">
                Once saved, your dashboard will show only examinations and records for{' '}
                <strong className="text-slate-800">{GRADE_LABELS[selectedClassToLock]}</strong>. Any future class change requires Administrator approval.
              </p>

              <button
                type="button"
                disabled={savingClassLock}
                onClick={async () => {
                  setClassLockError(null);
                  setSavingClassLock(true);
                  try {
                    await updateOwnStudentClass(selectedClassToLock);
                  } catch (err) {
                    setClassLockError(
                      err instanceof Error
                        ? err.message
                        : 'Could not save your class selection. Please try again.',
                    );
                  } finally {
                    setSavingClassLock(false);
                  }
                }}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 disabled:opacity-60 rounded-lg transition-all cursor-pointer"
              >
                {savingClassLock
                  ? 'Saving Class...'
                  : `Confirm & Continue to ${selectedClassToLock} Portal`}
              </button>
            </div>
          </div>
        </main>
        <DeveloperFooter />
      </div>
    );
  }

  if (isRestrictedEdition && !isGradeAllowedInEdition(userProfile.grade, activeEdition)) {
    const ownClassSlug = getClassPathSlug(userProfile.grade as GradeLevel);
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200">
          <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-teal-500 to-amber-500" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
            <div className="font-display text-base sm:text-lg font-bold text-slate-900 inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-xs bg-gradient-to-br from-blue-600 to-indigo-600 shrink-0" />
              <span>MeritExam</span>
              <span className="px-2 py-0.5 text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 rounded">
                {editionBadge}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-lg bg-white border border-amber-300 rounded-xl overflow-hidden shadow-sm">
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 to-blue-600" />
            <div className="p-6 sm:p-8 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-900">
                    {editionLabel} Portal Only
                  </h1>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                    This link is exclusively for <strong>{editionLabel}</strong>. Your account is enrolled in{' '}
                    <strong className="text-blue-800">{GRADE_LABELS[userProfile.grade as GradeLevel]}</strong>.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {!buildLocked && (
                  <a
                    href={ownClassSlug}
                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
                  >
                    Open {userProfile.grade} Portal
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </main>
        <DeveloperFooter />
      </div>
    );
  }

  if (runningTest) {
    return (
      <TestRunner
        test={runningTest}
        studentProfile={userProfile}
        systemSettings={systemSettings}
        existingAttempt={reviewingAttempt}
        onExit={() => {
          setRunningTest(null);
          setReviewingAttempt(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-teal-500 to-amber-500" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-4 md:gap-8">
          <div className="font-display text-base sm:text-lg font-bold text-slate-900 whitespace-nowrap shrink-0 inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-gradient-to-br from-blue-600 to-indigo-600 shrink-0" />
            <span>MeritExam</span>
            {isRestrictedEdition && (
              <span className="px-2 py-0.5 text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 rounded">
                {editionBadge}
              </span>
            )}
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('tests')}
              className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                activeTab === 'tests'
                  ? 'border-blue-700 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Upcoming &amp; Open Tests ({allPendingToTakeTests.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('results')}
              className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                activeTab === 'results'
                  ? 'border-blue-700 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Results &amp; Record ({totalResultsCount})
            </button>
            {hasAnswerKeyAccess && (
              <button
                type="button"
                onClick={() => setActiveTab('answer_key')}
                className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums inline-flex items-center gap-1.5 ${
                  activeTab === 'answer_key'
                    ? 'border-emerald-700 text-emerald-900 font-semibold'
                    : 'border-transparent text-emerald-700 hover:text-emerald-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Answer Key ({answerKeyEligibleAttempts.length})
              </button>
            )}
          </nav>

          <button
            type="button"
            onClick={() => void logout()}
            className="px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-5 sm:space-y-6 flex-1">
        <nav
          aria-label="Student sections"
          className={`grid ${hasAnswerKeyAccess ? 'grid-cols-3' : 'grid-cols-2'} gap-2 md:hidden`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('tests')}
            className={`px-2.5 py-2.5 text-xs font-semibold rounded-lg border text-center whitespace-nowrap truncate cursor-pointer transition-colors tabular-nums ${
              activeTab === 'tests'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Upcoming ({allPendingToTakeTests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('results')}
            className={`px-2.5 py-2.5 text-xs font-semibold rounded-lg border text-center whitespace-nowrap truncate cursor-pointer transition-colors tabular-nums ${
              activeTab === 'results'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Record ({totalResultsCount})
          </button>
          {hasAnswerKeyAccess && (
            <button
              type="button"
              onClick={() => setActiveTab('answer_key')}
              className={`px-2.5 py-2.5 text-xs font-semibold rounded-lg border text-center whitespace-nowrap truncate cursor-pointer transition-colors tabular-nums ${
                activeTab === 'answer_key'
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              Answer Key ({answerKeyEligibleAttempts.length})
            </button>
          )}
        </nav>

        {/* Student Identity & Active Mode Banner */}
        <div className="bg-white border border-blue-200/80 rounded-xl overflow-hidden shadow-xs">
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 to-indigo-600" />
          <div className="bg-gradient-to-r from-blue-50/70 via-white to-teal-50/50 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">
                {userProfile.fullName}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Verified Student · Class <span className="font-semibold text-blue-800">{userProfile.grade}</span> · Roll ID:{' '}
                <span className="font-mono font-semibold text-slate-800">{userProfile.identifier || 'Registered'}</span>
              </p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-xs text-slate-500">Admin Examination Policy</p>
              <p className="text-sm font-semibold text-blue-800 mt-0.5">
                {systemSettings.resultMode === 'instant'
                  ? 'Option 1: Instant Score & Explanation Mode'
                  : 'Option 2: Controlled / Admin Result Release Mode'}
              </p>
            </div>
          </div>
        </div>

        {activeTab === 'tests' && (
          <div className="space-y-6">
            {/* Big Prominent Upcoming Scheduled Test Countdown Banner */}
            {upcomingScheduledTests.length > 0 && (() => {
              const nextTest = upcomingScheduledTests[0];
              const startMs = getScheduledStartMs(nextTest) ?? nowMs;
              const diffMs = Math.max(0, startMs - nowMs);
              const parts = formatCountdownParts(diffMs);

              return (
                <section
                  aria-label="Upcoming Test Countdown"
                  className="bg-slate-900 text-white rounded-xl p-5 sm:p-7 border border-slate-800"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-2xl">
                      <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>Upcoming Scheduled Examination · Starting Soon</span>
                      </div>
                      <h2 className="font-display text-xl sm:text-2xl font-bold text-white leading-snug">
                        {nextTest.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-300">
                        {nextTest.grade} · {nextTest.subject} · {nextTest.questionCount} MCQs
                        {(nextTest.shortQuestions?.length ?? 0) > 0
                          ? ` + ${nextTest.shortQuestions!.length} Short`
                          : ''}
                        {(nextTest.longQuestions?.length ?? 0) > 0
                          ? ` + ${nextTest.longQuestions!.length} Long`
                          : ''}{' '}
                        · {nextTest.durationMinutes} min duration
                      </p>
                      <p className="text-xs text-slate-400">
                        Scheduled Start Time: <span className="text-white font-medium">{new Date(startMs).toLocaleString()}</span>
                      </p>
                    </div>

                    <div className="shrink-0">
                      <p className="text-xs font-medium text-slate-400 mb-2 lg:text-right">
                        Time Remaining Until Test Starts
                      </p>
                      <div className="grid grid-cols-3 sm:flex items-center gap-2.5 sm:gap-3">
                        {parts.days > 0 && (
                          <div className="bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-center min-w-[72px]">
                            <div className="font-display text-2xl sm:text-3xl font-bold tabular-nums text-white">
                              {String(parts.days).padStart(2, '0')}
                            </div>
                            <div className="text-[11px] uppercase tracking-wider text-slate-400 mt-0.5">
                              Days
                            </div>
                          </div>
                        )}
                        <div className="bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-center min-w-[76px]">
                          <div className="font-display text-2xl sm:text-3xl font-bold tabular-nums text-white">
                            {parts.days > 0 ? parts.hours : parts.totalHours}
                          </div>
                          <div className="text-[11px] uppercase tracking-wider text-slate-400 mt-0.5">
                            Hours
                          </div>
                        </div>
                        <div className="bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-center min-w-[76px]">
                          <div className="font-display text-2xl sm:text-3xl font-bold tabular-nums text-white">
                            {parts.minutes}
                          </div>
                          <div className="text-[11px] uppercase tracking-wider text-slate-400 mt-0.5">
                            Minutes
                          </div>
                        </div>
                        <div className="bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-center min-w-[76px]">
                          <div className="font-display text-2xl sm:text-3xl font-bold tabular-nums text-amber-300">
                            {parts.seconds}
                          </div>
                          <div className="text-[11px] uppercase tracking-wider text-slate-400 mt-0.5">
                            Seconds
                          </div>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2 lg:text-right">
                        The Begin Test button unlocks automatically at 00:00:00.
                      </p>
                    </div>
                  </div>

                  {upcomingScheduledTests.length > 1 && (
                    <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap gap-3 text-xs text-slate-300">
                      <span className="text-slate-400 font-semibold">Also Scheduled:</span>
                      {upcomingScheduledTests.slice(1).map((extra) => {
                        const extraMs = getScheduledStartMs(extra) ?? nowMs;
                        const extraParts = formatCountdownParts(extraMs - nowMs);
                        return (
                          <span key={extra.id} className="bg-slate-800 px-2.5 py-1 rounded-md tabular-nums">
                            {extra.title} ({extra.grade} {extra.subject}) — {extraParts.totalHours}h {extraParts.minutes}m {extraParts.seconds}s
                          </span>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })()}

            {/* Permitted Upcoming & Open Tests Filter & Grid */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900">
                    Tests To Take (Active &amp; Upcoming)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Showing only upcoming and currently open examinations for Class {userProfile.grade}. Submitted, expired, and cancelled papers are closed and only your marks remain in Results &amp; Record.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value as SubjectName | 'All')}
                    aria-label="Filter by subject"
                    className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="All">All Subjects (Sciences & Arts)</option>
                    {SUBJECT_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.subjects.map((subj) => (
                          <option key={subj} value={subj}>
                            {subj}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                  Loading permitted assessments...
                </div>
              ) : loadError ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
                  <ShieldAlert className="w-8 h-8 text-red-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-red-900">{loadError}</p>
                </div>
              ) : permittedTests.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                  <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      No upcoming or open examinations remaining for Class {userProfile.grade}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Only upcoming and active tests appear here. Completed and expired papers are closed, while your marks are saved in Results &amp; Record.
                    </p>
                  </div>
                  {totalResultsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('results')}
                      className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View My Results &amp; Record ({totalResultsCount})
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {permittedTests.map((test) => {
                    const effectiveMode =
                      test.deliveryMode === 'inherit'
                        ? systemSettings.resultMode
                        : test.deliveryMode;
                    const startMs = getScheduledStartMs(test);
                    const endMs = getScheduledEndMs(test);
                    const isScheduledLocked = startMs !== null && startMs > nowMs;
                    const countdown = isScheduledLocked
                      ? formatCountdownParts(startMs - nowMs)
                      : null;
                    const closingCountdown =
                      !isScheduledLocked && endMs !== null && endMs > nowMs
                        ? formatCountdownParts(endMs - nowMs)
                        : null;

                    const subjectAccent = getSubjectAccent(test.subject);

                    return (
                      <div
                        key={test.id}
                        className={`bg-white border ${subjectAccent.border} rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between`}
                      >
                        <div className={`h-1.5 w-full bg-gradient-to-r ${subjectAccent.bar}`} />

                        {/* Prominent Paper Time Window Bar at Top of Card */}
                        <div
                          className={`px-4 py-2.5 border-b text-[11px] space-y-1 ${
                            isScheduledLocked
                              ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                              : endMs !== null
                                ? 'bg-blue-50/80 border-blue-200 text-slate-800'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 font-semibold">
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarClock className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                              Paper Time ({test.durationMinutes} min)
                            </span>
                            {isScheduledLocked && countdown ? (
                              <span className="text-amber-800 tabular-nums">
                                Starts in {countdown.days > 0 ? `${countdown.days}d ` : ''}
                                {countdown.hours}:{countdown.minutes}:{countdown.seconds}
                              </span>
                            ) : closingCountdown ? (
                              <span className="text-red-700 tabular-nums">
                                Closes in {closingCountdown.days > 0 ? `${closingCountdown.days}d ` : ''}
                                {closingCountdown.hours}:{closingCountdown.minutes}:{closingCountdown.seconds}
                              </span>
                            ) : (
                              <span className="text-emerald-700">Open Now</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px] text-slate-600 tabular-nums">
                            <span>
                              Start:{' '}
                              <strong className="text-slate-900">
                                {startMs !== null ? new Date(startMs).toLocaleString() : 'Open Now'}
                              </strong>
                            </span>
                            {endMs !== null && (
                              <span>
                                Ends:{' '}
                                <strong className="text-slate-900">
                                  {new Date(endMs).toLocaleString()}
                                </strong>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <div>
                            <div className={`text-xs font-bold uppercase tracking-wide mb-1.5 ${subjectAccent.label}`}>
                              {test.board === 'punjab_ptb' ? 'Punjab Board' : 'Federal NBF'} · {test.grade} · {test.subject} · {test.difficulty}
                            </div>
                            {(test.schoolName || test.examLabel || test.paperDate) && (
                              <p className="text-[11px] font-semibold text-slate-700 mb-1 truncate">
                                {[test.schoolName, test.examLabel, test.paperDate].filter(Boolean).join(' · ')}
                              </p>
                            )}
                            <h3 className="font-display text-base font-bold text-slate-900 leading-snug">
                              {test.title}
                            </h3>
                            {test.topic && (
                              <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                                Topic: {test.topic}
                              </p>
                            )}

                            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600 tabular-nums">
                              <span>
                                {test.questionCount} MCQs
                                {(test.shortQuestions?.length ?? 0) > 0
                                  ? ` · ${test.shortQuestions!.length} Short`
                                  : ''}
                                {(test.longQuestions?.length ?? 0) > 0
                                  ? ` · ${test.longQuestions!.length} Long`
                                  : ''}
                              </span>
                              <span>{test.durationMinutes} min</span>
                              <span className="col-span-2 text-slate-500">
                                By {test.createdByName} ·{' '}
                                {effectiveMode === 'instant' ? 'Instant Result' : 'Admin Review'}
                              </span>
                            </div>
                          </div>

                          <div className="mt-5">
                            {(() => {
                              if (isScheduledLocked && countdown && startMs !== null) {
                                return (
                                  <div className="w-full py-2.5 px-3 bg-amber-50 border border-amber-200 rounded-lg text-center space-y-1">
                                    <div className="text-xs font-semibold text-amber-900 inline-flex items-center gap-1.5 justify-center">
                                      <Lock className="w-3.5 h-3.5" />
                                      <span className="tabular-nums">
                                        Starts in {countdown.days > 0 ? `${countdown.days}d ` : ''}
                                        {countdown.hours}h : {countdown.minutes}m : {countdown.seconds}s
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-amber-700">
                                      Unlocks at {new Date(startMs).toLocaleString()}
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewingAttempt(null);
                                    setRunningTest(test);
                                  }}
                                  className={`w-full py-2 px-4 text-sm font-semibold text-white ${subjectAccent.button} rounded-lg transition-all inline-flex items-center justify-center gap-2 cursor-pointer`}
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                  <Play className="w-3.5 h-3.5" />
                                  Begin Test (Screen Lock)
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'answer_key' && hasAnswerKeyAccess && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-emerald-950 inline-flex items-center gap-2">
                  <Eye className="w-5 h-5 text-emerald-700" />
                  Read-Only Answer Key Review ({answerKeyEligibleAttempts.length})
                </h2>
                <p className="text-xs text-emerald-800 mt-1">
                  Permitted by your Administrator for papers you have already given. You can review your correct and wrong answers below — solving or re-attempting is disabled.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('results')}
                className="px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-white border border-emerald-300 hover:bg-emerald-100 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                Back to Results &amp; Record
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {answerKeyEligibleAttempts.map((attempt) => {
                const accent = getSubjectAccent(attempt.subject);
                const breakdown = getAttemptBreakdown(attempt);
                const sortMs = parseTimestampMs(attempt.submittedAt) ?? 0;
                return (
                  <div
                    key={`key_${attempt.id}`}
                    className={`bg-white border ${accent.border} rounded-xl overflow-hidden shadow-xs flex flex-col justify-between`}
                  >
                    <div className={`h-1.5 w-full bg-gradient-to-r ${accent.bar}`} />
                    <div className="p-5 space-y-2.5 flex-1">
                      <div className={`text-xs font-bold uppercase tracking-wide ${accent.label}`}>
                        {attempt.grade} · {attempt.subject} · Read-Only Key
                      </div>
                      <h3 className="font-display text-base font-bold text-slate-900 leading-snug">
                        {attempt.testTitle}
                      </h3>
                      {sortMs > 0 && (
                        <p className="text-xs text-slate-500 tabular-nums">
                          Submitted: {new Date(sortMs).toLocaleString()}
                        </p>
                      )}
                      <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600 tabular-nums">
                        <div className="flex items-center justify-between">
                          <span>
                            Score:{' '}
                            <strong className="text-slate-900">
                              {attempt.obtainedMarks ?? attempt.score} /{' '}
                              {attempt.totalMarks ?? attempt.totalQuestions} ({attempt.percentage}%)
                            </strong>
                          </span>
                        </div>
                        {breakdown.total > 0 && (
                          <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 text-[11px]">
                            <div>
                              <span className="text-slate-500 block">Attempted</span>
                              <strong className="text-slate-900">{breakdown.attempted}</strong>
                            </div>
                            <div>
                              <span className="text-emerald-700 block">Correct</span>
                              <strong className="text-emerald-700">{breakdown.correct}</strong>
                            </div>
                            <div>
                              <span className="text-red-700 block">Wrong</span>
                              <strong className="text-red-700">{breakdown.wrong}</strong>
                            </div>
                            <div>
                              <span className="text-amber-800 block">Left</span>
                              <strong className="text-amber-700">{breakdown.skipped}</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70">
                      <button
                        type="button"
                        onClick={() => handleOpenAttemptReview(attempt)}
                        className="w-full py-2 px-4 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Answer Key (Read-Only)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="space-y-5">
            {studentReport && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Total Tests
                  </p>
                  <p className="font-display text-2xl font-bold text-slate-900 tabular-nums mt-1">
                    {studentReport.totalTestsCount}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Recorded for class</p>
                </div>

                <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-xs">
                  <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                    Tests Given
                  </p>
                  <p className="font-display text-2xl font-bold text-emerald-700 tabular-nums mt-1">
                    {studentReport.givenCount}
                  </p>
                  <p className="text-[11px] text-emerald-700/80 mt-0.5 tabular-nums">
                    {studentReport.cancelledCount > 0
                      ? `+${studentReport.cancelledCount} Cancelled`
                      : 'Submitted'}
                  </p>
                </div>

                <div className="bg-white border border-red-200 rounded-xl p-4 shadow-xs">
                  <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wide">
                    Not Given (Missed)
                  </p>
                  <p className="font-display text-2xl font-bold text-red-700 tabular-nums mt-1">
                    {studentReport.missedCount}
                  </p>
                  <p className="text-[11px] text-red-700/80 mt-0.5">Marked Absent (0)</p>
                </div>

                <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-xs">
                  <p className="text-[11px] font-semibold text-blue-800 uppercase tracking-wide">
                    Total Marks
                  </p>
                  <p className="font-display text-xl sm:text-2xl font-bold text-blue-900 tabular-nums mt-1">
                    {studentReport.totalObtainedMarks} / {studentReport.totalPossibleMarks}
                  </p>
                  <p className="text-[11px] text-blue-700 mt-0.5 tabular-nums">
                    {studentReport.heldCount > 0
                      ? `${studentReport.heldCount} Held for Release`
                      : studentReport.missedCount > 0
                        ? `Given Only: ${studentReport.givenObtainedMarks}/${studentReport.givenPossibleMarks}`
                        : 'All Released Tests'}
                  </p>
                </div>

                <div
                  className={`bg-white border rounded-xl p-4 shadow-xs col-span-2 sm:col-span-1 ${
                    studentReport.totalPossibleMarks === 0
                      ? 'border-slate-200'
                      : studentReport.overallPercentage >= systemSettings.passingPercentage
                        ? 'border-teal-200'
                        : 'border-amber-200'
                  }`}
                >
                  <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                    Overall %
                  </p>
                  <p
                    className={`font-display text-2xl font-bold tabular-nums mt-1 ${
                      studentReport.totalPossibleMarks === 0
                        ? 'text-slate-700'
                        : studentReport.overallPercentage >= systemSettings.passingPercentage
                          ? 'text-teal-800'
                          : 'text-amber-800'
                    }`}
                  >
                    {studentReport.overallPercentage}%
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5 tabular-nums">
                    {studentReport.missedCount > 0
                      ? `Given Avg: ${studentReport.givenPercentage}%`
                      : `Pass Threshold: ${systemSettings.passingPercentage}%`}
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900">
                    My Complete Test Record &amp; Marks Breakdown
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Every MCQ test you have taken or missed, with marks, percentage, and question breakdown.
                  </p>
                </div>
              </div>

              {resultAttendanceRows.length === 0 ? (
                <div className="p-10 text-center">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">No tests recorded yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Assessment</th>
                        <th className="py-3 px-4">Class · Subject</th>
                        <th className="py-3 px-4">Attendance</th>
                        <th className="py-3 px-4">Score</th>
                        <th className="py-3 px-4">Question Summary</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {resultAttendanceRows.map((row) => {
                        if (row.kind === 'absent') {
                          const { test, endMs } = row;
                          const totalQs = test.questionCount || test.questions?.length || 0;
                          const totalMarks =
                            Math.round(totalQs * (test.marksPerQuestion ?? 1) * 100) /
                            100;
                          return (
                            <tr key={`absent_${test.id}`} className="bg-red-50/30 hover:bg-red-50/60">
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-900">{test.title}</div>
                                <div className="text-[11px] text-red-700 tabular-nums mt-0.5">
                                  Closed: {new Date(endMs).toLocaleString()}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                {test.grade} · {test.subject}
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold bg-red-100 text-red-800 border border-red-200 rounded">
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  Absent (Missed)
                                </span>
                              </td>
                              <td className="py-3 px-4 tabular-nums font-semibold text-red-700">
                                0 / {totalMarks} (0%)
                              </td>
                              <td className="py-3 px-4 text-xs tabular-nums text-slate-600">
                                <div>Attempted: <strong className="text-slate-900">0 / {totalQs}</strong></div>
                                <div className="text-[11px] mt-0.5">
                                  <span className="text-emerald-700 font-semibold">0 Correct</span> ·{' '}
                                  <span className="text-red-700 font-semibold">0 Wrong</span> ·{' '}
                                  <span className="text-amber-700 font-semibold">{totalQs} Left</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-xs font-semibold text-red-700">
                                Paper Not Attempted
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="text-xs text-red-700 inline-flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> Time Expired
                                </span>
                              </td>
                            </tr>
                          );
                        }

                        const { attempt } = row;
                        const breakdown = getAttemptBreakdown(attempt);
                        return (
                          <tr key={attempt.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-medium text-slate-900">
                              {attempt.testTitle}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {attempt.grade} · {attempt.subject}
                            </td>
                            <td className="py-3 px-4">
                              {attempt.autoCancelled ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200 rounded">
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  Cancelled
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 rounded">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Present
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 tabular-nums font-semibold text-slate-900">
                              {attempt.resultReleased
                                ? `${attempt.obtainedMarks ?? attempt.score} / ${attempt.totalMarks ?? attempt.totalQuestions} (${attempt.percentage}%)`
                                : 'Held Until Release'}
                            </td>
                            <td className="py-3 px-4 text-xs tabular-nums text-slate-600 whitespace-nowrap">
                              {breakdown.total === 0 ? (
                                <span className="text-slate-500">Subjective Paper</span>
                              ) : attempt.resultReleased && !attempt.autoCancelled ? (
                                <>
                                  <div>
                                    Attempted: <strong className="text-slate-900">{breakdown.attempted} / {breakdown.total}</strong>
                                  </div>
                                  <div className="text-[11px] mt-0.5">
                                    <span className="text-emerald-700 font-semibold">{breakdown.correct} Correct</span> ·{' '}
                                    <span className="text-red-700 font-semibold">{breakdown.wrong} Wrong</span> ·{' '}
                                    <span className="text-amber-700 font-semibold">{breakdown.skipped} Left</span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div>
                                    Attempted: <strong className="text-slate-900">{breakdown.attempted} / {breakdown.total}</strong>
                                  </div>
                                  <div className="text-[11px] text-amber-700 font-semibold mt-0.5">
                                    {breakdown.skipped} Left · {attempt.autoCancelled ? 'Cancelled' : 'Key Held'}
                                  </div>
                                </>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {attempt.autoCancelled && (
                                <div className="text-xs font-semibold text-red-700 inline-flex items-center gap-1 mr-2">
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  Auto-Cancelled (Left Screen)
                                </div>
                              )}
                              {attempt.resultReleased ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Released
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                                  <Clock className="w-3.5 h-3.5" />
                                  Pending Admin Release
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {attempt.autoCancelled ? (
                                <span className="text-xs text-red-600 inline-flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> Cancelled
                                </span>
                              ) : isAttemptAnswerKeyAllowed(attempt) && activeTestsById.has(attempt.testId) ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAttemptReview(attempt)}
                                  className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Answer Key
                                </button>
                              ) : attempt.resultReleased ? (
                                <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> Paper Closed
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> Held
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <DeveloperFooter />
    </div>
  );
}
