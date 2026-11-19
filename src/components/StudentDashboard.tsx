import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
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
import { OperationType, db, handleFirestoreError } from '../lib/firebase';
import {
  MCQTest,
  SUBJECT_GROUPS,
  SubjectName,
  TestAttempt,
} from '../types';
import { TestRunner } from './TestRunner';
import { DeveloperFooter } from './DeveloperFooter';

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

function getScheduledStartMs(test: MCQTest): number | null {
  if (!test.scheduledReleaseAt) return null;
  const ms = new Date(test.scheduledReleaseAt).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function getScheduledEndMs(test: MCQTest): number | null {
  if (!test.scheduledEndAt) return null;
  const ms = new Date(test.scheduledEndAt).getTime();
  return Number.isNaN(ms) ? null : ms;
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
  const { userProfile, systemSettings, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'tests' | 'results'>('tests');
  const [subjectFilter, setSubjectFilter] = useState<SubjectName | 'All'>('All');

  const [activeTests, setActiveTests] = useState<MCQTest[]>([]);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);

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
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tests');
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
        handleFirestoreError(error, OperationType.LIST, 'attempts');
      },
    );

    return () => {
      unsubTests();
      unsubAttempts();
    };
  }, [userProfile]);

  const studentGrade = userProfile?.grade;

  const permittedTests = useMemo(() => {
    return activeTests
      .filter((t) => t.isActive === true && t.createdByRole !== 'student_practice')
      .filter((t) => {
        if (!studentGrade || studentGrade === 'All') return true;
        const allowed =
          t.allowedGrades && t.allowedGrades.length > 0 ? t.allowedGrades : [t.grade];
        return allowed.includes(studentGrade);
      })
      .filter((t) => {
        const endMs = getScheduledEndMs(t);
        return endMs === null || nowMs <= endMs;
      })
      .filter((t) => (subjectFilter === 'All' ? true : t.subject === subjectFilter));
  }, [activeTests, studentGrade, subjectFilter, nowMs]);

  const upcomingScheduledTests = useMemo(() => {
    return permittedTests
      .filter((t) => {
        const startMs = getScheduledStartMs(t);
        return startMs !== null && startMs > nowMs;
      })
      .sort((a, b) => (getScheduledStartMs(a) ?? 0) - (getScheduledStartMs(b) ?? 0));
  }, [permittedTests, nowMs]);

  const attemptsByTestId = useMemo(() => {
    const map = new Map<string, TestAttempt>();
    attempts.forEach((a) => {
      if (!map.has(a.testId)) {
        map.set(a.testId, a);
      }
    });
    return map;
  }, [attempts]);

  function handleOpenAttemptReview(attempt: TestAttempt) {
    if (!attempt.resultReleased || attempt.autoCancelled) return;
    const matchedTest = activeTests.find((t) => t.id === attempt.testId);
    if (!matchedTest) return;
    setReviewingAttempt(attempt);
    setRunningTest(matchedTest);
  }

  if (!userProfile) return null;

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
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('tests')}
              className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'tests'
                  ? 'border-blue-700 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              MCQ Tests
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('results')}
              className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'results'
                  ? 'border-blue-700 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              My Results ({attempts.length})
            </button>
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
        <nav aria-label="Student sections" className="grid grid-cols-2 gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setActiveTab('tests')}
            className={`px-3 py-2.5 text-xs font-semibold rounded-lg border text-center whitespace-nowrap truncate cursor-pointer transition-colors ${
              activeTab === 'tests'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            MCQ Tests
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('results')}
            className={`px-3 py-2.5 text-xs font-semibold rounded-lg border text-center whitespace-nowrap truncate cursor-pointer transition-colors ${
              activeTab === 'results'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            My Results ({attempts.length})
          </button>
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

            {/* Permitted Tests Filter & Grid */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900">
                    Permitted Class Examinations
                  </h2>
                  <p className="text-xs text-slate-500">
                    Showing active examinations permitted by your teacher or administrator for Class {userProfile.grade}. Expired papers are hidden automatically.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg">
                    Class: {userProfile.grade}
                  </span>

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
              ) : permittedTests.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                  <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-800">
                    No active examinations are currently open for Class {userProfile.grade}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Only papers permitted by your teacher or administrator within their active time window appear here.
                  </p>
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
                              const prevAttempt = attemptsByTestId.get(test.id);
                              if (prevAttempt) {
                                if (prevAttempt.autoCancelled) {
                                  return (
                                    <div className="w-full py-2.5 px-3 bg-red-50 border border-red-200 rounded-lg text-center space-y-1">
                                      <div className="text-xs font-bold text-red-800 inline-flex items-center gap-1.5 justify-center">
                                        <ShieldAlert className="w-3.5 h-3.5" />
                                        <span>Paper Cancelled &amp; Auto-Submitted</span>
                                      </div>
                                      <div className="text-[11px] text-red-700">
                                        Screen Lock was broken · Retake blocked
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <div className="w-full py-2.5 px-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center space-y-1">
                                    <div className="text-xs font-semibold text-emerald-800 inline-flex items-center gap-1.5 justify-center">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Paper Already Submitted</span>
                                    </div>
                                    {prevAttempt.resultReleased && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenAttemptReview(prevAttempt)}
                                        className="text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
                                      >
                                        View Answer Key
                                      </button>
                                    )}
                                  </div>
                                );
                              }

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

        {activeTab === 'results' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                My Submitted Assessments
              </h2>
            </div>

            {attempts.length === 0 ? (
              <div className="p-10 text-center">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600">No tests submitted yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Assessment</th>
                      <th className="py-3 px-4">Class · Subject</th>
                      <th className="py-3 px-4">Score</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {attempts.map((attempt) => (
                      <tr key={attempt.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {attempt.testTitle}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {attempt.grade} · {attempt.subject}
                        </td>
                        <td className="py-3 px-4 tabular-nums font-semibold text-slate-900">
                          {attempt.resultReleased
                            ? `${attempt.obtainedMarks ?? attempt.score} / ${attempt.totalMarks ?? attempt.totalQuestions} (${attempt.percentage}%)`
                            : 'Held Until Release'}
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
                          ) : attempt.resultReleased ? (
                            <button
                              type="button"
                              onClick={() => handleOpenAttemptReview(attempt)}
                              className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                            >
                              View Answer Key
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Locked
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      <DeveloperFooter />
    </div>
  );
}
