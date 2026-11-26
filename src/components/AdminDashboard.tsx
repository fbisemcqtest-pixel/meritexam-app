import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Layers,
  Lock,
  LogOut,
  PauseCircle,
  PlayCircle,
  Printer,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import {
  BOOTSTRAPPED_ADMIN_EMAILS,
  OperationType,
  db,
  handleFirestoreError,
} from '../lib/firebase';
import {
  deleteMCQTest,
  deleteTestAttempt,
  pauseOrResumeAdmin,
  releaseAttemptResult,
  revokeAdminAccess,
  saveSystemSettings,
  toggleStudentAnswerKeyReview,
  toggleTeacherPaperCreation,
  toggleTestActiveStatus,
  updateAccountApproval,
  updateAccountClass,
  updateTestDeliveryOverride,
  toggleAttemptAnswerKeyRelease,
} from '../services/mcqService';
import {
  AccountStatus,
  GRADES,
  GRADE_LABELS,
  GradeLevel,
  MCQTest,
  ResultMode,
  TestAccessMode,
  TestAttempt,
  TestDeliveryOverride,
  UserAccount,
  UserRole,
  getAttemptBreakdown,
  isSingleStudentGrade,
} from '../types';
import { TestGeneratorPanel } from './TestGeneratorPanel';
import { TestRunner } from './TestRunner';
import { PrintablePaperModal } from './PrintablePaperModal';
import { ScheduleAccessModal } from './ScheduleAccessModal';
import { StudentRecordModal } from './StudentRecordModal';
import { PlatformBrochureModal } from './PlatformBrochureModal';
import { ClassDeploymentsModal } from './ClassDeploymentsModal';
import { DeveloperFooter } from './DeveloperFooter';
import { getActiveEditionClass, getClassPathSlug } from '../config/appEdition';
import {
  buildStudentPerformanceReport,
  getEffectiveTestEndMs,
} from '../utils/studentRecord';

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

export function AdminDashboard() {
  const { firebaseUser, userProfile, isMainAdmin, systemSettings, logout } = useAuth();
  const activeEdition = getActiveEditionClass();
  const isSingleClassEdition = activeEdition !== 'All';
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'tests' | 'results'>('users');

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [tests, setTests] = useState<MCQTest[]>([]);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);

  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [userClassFilter, setUserClassFilter] = useState<GradeLevel | 'All'>(
    isSingleClassEdition ? activeEdition : 'All',
  );

  const [resultsClassFilter, setResultsClassFilter] = useState<GradeLevel | 'All'>(
    isSingleClassEdition ? activeEdition : 'All',
  );
  const [resultsTestFilter, setResultsTestFilter] = useState<string>('all');
  const [resultsAttendanceFilter, setResultsAttendanceFilter] = useState<
    'all' | 'present' | 'absent' | 'cancelled'
  >('all');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Examination Mode form state
  const [resultMode, setResultMode] = useState<ResultMode>(systemSettings.resultMode);
  const [testAccessMode, setTestAccessMode] = useState<TestAccessMode>(systemSettings.testAccessMode);
  const [allowTeacherPaperCreation, setAllowTeacherPaperCreation] = useState<boolean>(
    systemSettings.allowTeacherPaperCreation !== false,
  );
  const [allowStudentAnswerKeyReview, setAllowStudentAnswerKeyReview] = useState<boolean>(
    systemSettings.allowStudentAnswerKeyReview === true,
  );
  const [togglingTeacherPapers, setTogglingTeacherPapers] = useState(false);
  const [togglingAnswerKeys, setTogglingAnswerKeys] = useState(false);
  const [defaultTimeLimitMinutes, setDefaultTimeLimitMinutes] = useState<number>(
    systemSettings.defaultTimeLimitMinutes,
  );
  const [passingPercentage, setPassingPercentage] = useState<number>(
    systemSettings.passingPercentage,
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);

  const [previewTest, setPreviewTest] = useState<MCQTest | null>(null);
  const [printingTest, setPrintingTest] = useState<MCQTest | null>(null);
  const [schedulingState, setSchedulingState] = useState<{
    test: MCQTest;
    initialActive?: boolean;
    expiredNotice?: boolean;
  } | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [showBrochureModal, setShowBrochureModal] = useState(false);
  const [showClassDeploymentsModal, setShowClassDeploymentsModal] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  useEffect(() => {
    setResultMode(systemSettings.resultMode);
    setTestAccessMode(systemSettings.testAccessMode);
    setAllowTeacherPaperCreation(systemSettings.allowTeacherPaperCreation !== false);
    setAllowStudentAnswerKeyReview(systemSettings.allowStudentAnswerKeyReview === true);
    setDefaultTimeLimitMinutes(systemSettings.defaultTimeLimitMinutes);
    setPassingPercentage(systemSettings.passingPercentage);
  }, [systemSettings]);

  useEffect(() => {
    if (!firebaseUser) return;

    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), orderBy('createdAt', 'desc')),
      (snap) => {
        setUsers(snap.docs.map((d) => d.data() as UserAccount));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      },
    );

    const unsubTests = onSnapshot(
      query(collection(db, 'tests'), orderBy('createdAt', 'desc')),
      (snap) => {
        setTests(snap.docs.map((d) => d.data() as MCQTest));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tests');
      },
    );

    const unsubAttempts = onSnapshot(
      query(collection(db, 'attempts'), orderBy('submittedAt', 'desc')),
      (snap) => {
        setAttempts(snap.docs.map((d) => d.data() as TestAttempt));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'attempts');
      },
    );

    return () => {
      unsubUsers();
      unsubTests();
      unsubAttempts();
    };
  }, [firebaseUser]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 15_000);
    return () => window.clearInterval(id);
  }, []);

  const pendingUsersCount = useMemo(
    () => users.filter((u) => u.status === 'pending').length,
    [users],
  );

  const unreleasedAttemptsCount = useMemo(
    () => attempts.filter((a) => !a.resultReleased).length,
    [attempts],
  );

  const approvedStudents = useMemo(
    () => users.filter((u) => u.role === 'student' && u.status === 'approved'),
    [users],
  );

  const conductedTests = useMemo(
    () => tests.filter((t) => t.createdByRole !== 'student_practice'),
    [tests],
  );

  const absentRecords = useMemo(() => {
    const attemptedPairKeys = new Set(
      attempts.map((a) => `${a.testId}__${a.studentId}`),
    );
    const list: Array<{
      key: string;
      test: MCQTest;
      student: UserAccount;
      endMs: number;
      totalMarks: number;
    }> = [];

    conductedTests.forEach((t) => {
      if (!t.isActive) return;
      const endMs = getEffectiveTestEndMs(t);
      if (endMs === null || nowMs <= endMs) return;

      const allowed =
        t.allowedGrades && t.allowedGrades.length > 0 ? t.allowedGrades : [t.grade];
      const normalizedAllowed = new Set(allowed.map((g) => String(g).trim()));
      const mcqCount = t.questions?.length ?? t.questionCount ?? 0;
      const totalMarks = Math.round(mcqCount * (t.marksPerQuestion ?? 1) * 100) / 100;

      approvedStudents.forEach((student) => {
        const stuGrade = String(student.grade).trim();
        const matchesClass = isSingleStudentGrade(stuGrade) && normalizedAllowed.has(stuGrade);
        if (!matchesClass) return;
        if (attemptedPairKeys.has(`${t.id}__${student.uid}`)) return;

        list.push({
          key: `absent_${t.id}_${student.uid}`,
          test: t,
          student,
          endMs,
          totalMarks,
        });
      });
    });

    list.sort((a, b) => b.endMs - a.endMs);
    return list;
  }, [conductedTests, approvedStudents, attempts, nowMs]);

  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => (statusFilter === 'all' ? true : u.status === statusFilter))
      .filter((u) => (roleFilter === 'all' ? true : u.role === roleFilter))
      .filter((u) =>
        userClassFilter === 'All'
          ? true
          : String(u.grade).trim() === userClassFilter,
      );
  }, [users, statusFilter, roleFilter, userClassFilter]);

  const filteredClassApprovedStudentCount = useMemo(() => {
    if (userClassFilter === 'All') return approvedStudents.length;
    return approvedStudents.filter(
      (s) => String(s.grade).trim() === userClassFilter,
    ).length;
  }, [approvedStudents, userClassFilter]);

  const studentsNeedingSingleClassCount = useMemo(
    () =>
      users.filter((u) => u.role === 'student' && !isSingleStudentGrade(u.grade)).length,
    [users],
  );

  const resultsTestsDropdownOptions = useMemo(() => {
    if (resultsClassFilter === 'All') return conductedTests;
    return conductedTests.filter((t) => {
      const allowed =
        t.allowedGrades && t.allowedGrades.length > 0 ? t.allowedGrades : [t.grade];
      return allowed.some((g) => String(g).trim() === resultsClassFilter);
    });
  }, [conductedTests, resultsClassFilter]);

  const selectedTestObj = useMemo(
    () =>
      resultsTestFilter === 'all'
        ? null
        : conductedTests.find((t) => t.id === resultsTestFilter) ?? null,
    [conductedTests, resultsTestFilter],
  );

  const resultsSummary = useMemo(() => {
    const classStudents =
      selectedTestObj !== null
        ? (() => {
            const allowed =
              selectedTestObj.allowedGrades && selectedTestObj.allowedGrades.length > 0
                ? selectedTestObj.allowedGrades
                : [selectedTestObj.grade];
            const set = new Set(allowed.map((g) => String(g).trim()));
            return approvedStudents.filter((s) => {
              const sg = String(s.grade).trim();
              const matchesTest = isSingleStudentGrade(sg) && set.has(sg);
              const matchesClassFilter =
                resultsClassFilter === 'All' || sg === resultsClassFilter;
              return matchesTest && matchesClassFilter;
            }).length;
          })()
        : resultsClassFilter === 'All'
          ? approvedStudents.length
          : approvedStudents.filter(
              (s) => String(s.grade).trim() === resultsClassFilter,
            ).length;

    const matchingTests = resultsTestsDropdownOptions.filter((t) =>
      resultsTestFilter === 'all' ? true : t.id === resultsTestFilter,
    );
    const closedTestsCount = matchingTests.filter((t) => {
      const endMs = getEffectiveTestEndMs(t);
      return t.isActive && endMs !== null && nowMs > endMs;
    }).length;

    const matchingAttempts = attempts.filter((a) => {
      const matchesClass =
        resultsClassFilter === 'All' || String(a.grade).trim() === resultsClassFilter;
      const matchesTest =
        resultsTestFilter === 'all' || a.testId === resultsTestFilter;
      return matchesClass && matchesTest;
    });

    const matchingAbsents = absentRecords.filter((rec) => {
      const studentGrade = String(rec.student.grade).trim();
      const allowed =
        rec.test.allowedGrades && rec.test.allowedGrades.length > 0
          ? rec.test.allowedGrades
          : [rec.test.grade];
      const matchesClass =
        resultsClassFilter === 'All' ||
        studentGrade === resultsClassFilter ||
        allowed.some((g) => String(g).trim() === resultsClassFilter);
      const matchesTest =
        resultsTestFilter === 'all' || rec.test.id === resultsTestFilter;
      return matchesClass && matchesTest;
    });

    return {
      classStudents,
      totalTestsConducted: matchingTests.length,
      closedTestsCount,
      presentCount: matchingAttempts.filter((a) => !a.autoCancelled).length,
      cancelledCount: matchingAttempts.filter((a) => a.autoCancelled).length,
      absentCount: matchingAbsents.length,
    };
  }, [
    selectedTestObj,
    approvedStudents,
    resultsClassFilter,
    resultsTestsDropdownOptions,
    resultsTestFilter,
    nowMs,
    attempts,
    absentRecords,
  ]);

  const unifiedResultAttendanceRows = useMemo(() => {
    type AdminRow =
      | { kind: 'present' | 'cancelled'; key: string; sortMs: number; attempt: TestAttempt }
      | {
          kind: 'absent';
          key: string;
          sortMs: number;
          test: MCQTest;
          student: UserAccount;
          endMs: number;
          totalMarks: number;
        };

    const rows: AdminRow[] = [];

    if (resultsAttendanceFilter !== 'absent') {
      attempts.forEach((a) => {
        const matchesClass =
          resultsClassFilter === 'All' || String(a.grade).trim() === resultsClassFilter;
        const matchesTest =
          resultsTestFilter === 'all' || a.testId === resultsTestFilter;
        if (!matchesClass || !matchesTest) return;

        const kind = a.autoCancelled ? 'cancelled' : 'present';
        if (resultsAttendanceFilter !== 'all' && resultsAttendanceFilter !== kind) {
          return;
        }
        rows.push({
          kind,
          key: a.id,
          sortMs: parseTimestampMs(a.submittedAt) ?? 0,
          attempt: a,
        });
      });
    }

    if (resultsAttendanceFilter === 'all' || resultsAttendanceFilter === 'absent') {
      absentRecords.forEach((rec) => {
        const studentGrade = String(rec.student.grade).trim();
        const allowed =
          rec.test.allowedGrades && rec.test.allowedGrades.length > 0
            ? rec.test.allowedGrades
            : [rec.test.grade];
        const matchesClass =
          resultsClassFilter === 'All' ||
          studentGrade === resultsClassFilter ||
          allowed.some((g) => String(g).trim() === resultsClassFilter);
        const matchesTest =
          resultsTestFilter === 'all' || rec.test.id === resultsTestFilter;
        if (!matchesClass || !matchesTest) return;

        rows.push({
          kind: 'absent',
          key: rec.key,
          sortMs: rec.endMs,
          test: rec.test,
          student: rec.student,
          endMs: rec.endMs,
          totalMarks: rec.totalMarks,
        });
      });
    }

    rows.sort((a, b) => b.sortMs - a.sortMs);
    return rows;
  }, [
    attempts,
    absentRecords,
    resultsClassFilter,
    resultsTestFilter,
    resultsAttendanceFilter,
  ]);

  const selectedStudentReport = useMemo(() => {
    if (!selectedStudentId) return null;
    const matchedUser = users.find((u) => u.uid === selectedStudentId);
    const fallbackAttempt = attempts.find((a) => a.studentId === selectedStudentId);
    const studentInfo = matchedUser ?? (fallbackAttempt
      ? {
          uid: fallbackAttempt.studentId,
          fullName: fallbackAttempt.studentName,
          email: '',
          grade: fallbackAttempt.grade,
          identifier: fallbackAttempt.studentIdentifier,
        }
      : null);
    if (!studentInfo) return null;

    return buildStudentPerformanceReport({
      student: studentInfo,
      allAttempts: attempts,
      conductedTests,
      includeHeldScores: true,
      nowMs,
    });
  }, [selectedStudentId, users, attempts, conductedTests, nowMs]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    setSavingSettings(true);
    setSettingsSavedMsg(null);
    try {
      await saveSystemSettings(
        {
          resultMode,
          testAccessMode,
          allowStudentInstantPractice: false,
          allowTeacherPaperCreation,
          allowStudentAnswerKeyReview,
          defaultTimeLimitMinutes,
          passingPercentage,
        },
        firebaseUser.uid,
      );
      setSettingsSavedMsg('Examination mode and settings saved across all portals.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleQuickToggleTeacherPapers() {
    if (!firebaseUser || togglingTeacherPapers) return;
    setTogglingTeacherPapers(true);
    try {
      const nextAllowed = systemSettings.allowTeacherPaperCreation === false;
      await toggleTeacherPaperCreation(nextAllowed, firebaseUser.uid, systemSettings);
    } finally {
      setTogglingTeacherPapers(false);
    }
  }

  async function handleQuickToggleAnswerKeys() {
    if (!firebaseUser || togglingAnswerKeys) return;
    setTogglingAnswerKeys(true);
    try {
      const nextAllowed = systemSettings.allowStudentAnswerKeyReview !== true;
      await toggleStudentAnswerKeyReview(nextAllowed, firebaseUser.uid, systemSettings);
    } finally {
      setTogglingAnswerKeys(false);
    }
  }

  async function handleReleaseAllPending() {
    if (!firebaseUser) return;
    const pending = attempts.filter((a) => !a.resultReleased);
    await Promise.all(
      pending.map((a) => releaseAttemptResult(a.id, firebaseUser.uid)),
    );
  }

  async function handleDownloadProjectZip() {
    if (!firebaseUser) return;
    setZipError(null);
    setDownloadingZip(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const classQuery =
        activeEdition === 'All'
          ? 'all'
          : getClassPathSlug(activeEdition).replace(/^\//, '');
      const response = await fetch(
        `/api/admin/export-zip?class=${encodeURIComponent(classQuery)}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Failed to download project ZIP.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download =
        activeEdition === 'All'
          ? 'meritexam-complete-all-classes.zip'
          : `meritexam-${classQuery}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Unable to export ZIP.');
    } finally {
      setDownloadingZip(false);
    }
  }

  if (!firebaseUser) return null;

  if (previewTest) {
    const previewProfile: UserAccount = userProfile ?? {
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? '',
      fullName: firebaseUser.displayName ?? 'Admin Preview',
      role: 'admin',
      status: 'approved',
      grade: 'All',
      subject: 'All',
      identifier: 'ADMIN',
    };
    return (
      <TestRunner
        test={previewTest}
        studentProfile={previewProfile}
        systemSettings={systemSettings}
        previewMode
        onExit={() => setPreviewTest(null)}
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
            <span className="w-2.5 h-2.5 rounded-xs bg-gradient-to-br from-amber-500 to-orange-600 shrink-0" />
            <span>MeritExam Admin</span>
            {isSingleClassEdition && (
              <span className="px-2 py-0.5 text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 rounded">
                {activeEdition}
              </span>
            )}
            {isMainAdmin && (
              <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 rounded">
                Main Admin
              </span>
            )}
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'users'
                  ? 'border-blue-700 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Accounts ({pendingUsersCount} Pending)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'settings'
                  ? 'border-blue-700 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Examination Mode
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tests')}
              className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'tests'
                  ? 'border-blue-700 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              MCQ Tests ({tests.length})
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
              Results &amp; Attendance ({absentRecords.length > 0 ? `${absentRecords.length} Absent` : `${unreleasedAttemptsCount} Held`})
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
        {/* Mobile Section Tabs */}
        <nav aria-label="Admin sections" className="grid grid-cols-2 gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-3 py-2.5 text-xs font-semibold rounded-lg border text-center whitespace-nowrap truncate cursor-pointer transition-colors ${
              activeTab === 'users'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Accounts ({pendingUsersCount} Pending)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-2.5 text-xs font-semibold rounded-lg border text-center whitespace-nowrap truncate cursor-pointer transition-colors ${
              activeTab === 'settings'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Exam Mode
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tests')}
            className={`px-3 py-2.5 text-xs font-semibold rounded-lg border text-center whitespace-nowrap truncate cursor-pointer transition-colors ${
              activeTab === 'tests'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            MCQ Papers ({tests.length})
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
            Results ({absentRecords.length > 0 ? `${absentRecords.length} Absent` : `${unreleasedAttemptsCount} Held`})
          </button>
        </nav>

        {/* Quick Action Strip */}
        <div className="bg-gradient-to-r from-blue-50/70 via-white to-amber-50/70 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-base sm:text-lg font-bold text-slate-900">
              Examination Control Center
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Build class-wise MCQ papers (9th, 10th, 1st A, 2nd Year), verify accounts, and release results.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('tests')}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === 'tests'
                  ? 'bg-slate-900 text-white'
                  : 'bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white'
              }`}
            >
              <FilePlus2 className="w-4 h-4" />
              Create MCQ Paper
            </button>
            <button
              type="button"
              disabled={togglingTeacherPapers}
              onClick={() => void handleQuickToggleTeacherPapers()}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors disabled:opacity-60 border ${
                systemSettings.allowTeacherPaperCreation === false
                  ? 'bg-emerald-700 hover:bg-emerald-800 border-emerald-700 text-white'
                  : 'bg-orange-50 hover:bg-orange-100 border-orange-300 text-orange-800'
              }`}
            >
              {systemSettings.allowTeacherPaperCreation === false ? (
                <>
                  <PlayCircle className="w-4 h-4" />
                  Allow Teachers&apos; Papers
                </>
              ) : (
                <>
                  <PauseCircle className="w-4 h-4" />
                  Stop Teachers&apos; Papers
                </>
              )}
            </button>
            <button
              type="button"
              disabled={togglingAnswerKeys}
              onClick={() => void handleQuickToggleAnswerKeys()}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors disabled:opacity-60 border ${
                systemSettings.allowStudentAnswerKeyReview === true
                  ? 'bg-emerald-700 hover:bg-emerald-800 border-emerald-700 text-white'
                  : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-300 text-indigo-800'
              }`}
              title="Permit or lock read-only Answer Key review for students on papers they have already given"
            >
              {systemSettings.allowStudentAnswerKeyReview === true ? (
                <>
                  <Eye className="w-4 h-4" />
                  Lock Answer Key Review
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Allow Answer Key Review
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
            >
              <Settings className="w-4 h-4" />
              Exam Mode
            </button>
            <button
              type="button"
              onClick={() => setShowBrochureModal(true)}
              className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
              title="View and copy complete English & Urdu website description and capacity details"
            >
              <FileText className="w-4 h-4" />
              App Description &amp; Copy
            </button>
            <button
              type="button"
              onClick={() => setShowClassDeploymentsModal(true)}
              className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-purple-800 bg-purple-50 border border-purple-200 hover:bg-purple-100 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
              title="Get 4 separate class links & ZIPs (9th, 10th, 1st Year, 2nd Year) + 1 Complete All-Classes ZIP"
            >
              <Layers className="w-4 h-4" />
              5 Links &amp; ZIPs
            </button>
            <button
              type="button"
              disabled={downloadingZip}
              onClick={() => void handleDownloadProjectZip()}
              className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 disabled:opacity-60 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              {downloadingZip ? 'Preparing ZIP...' : 'Download ZIP'}
            </button>
          </div>
        </div>

        {zipError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            {zipError}
          </div>
        )}

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-amber-200/80 rounded-xl overflow-hidden shadow-xs">
            <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500" />
            <div className="p-4 sm:p-5">
              <p className="text-xs font-medium text-slate-500">Pending Approvals</p>
              <p className="font-display text-2xl font-bold text-amber-700 tabular-nums mt-1">
                {pendingUsersCount}
              </p>
            </div>
          </div>
          <div className="bg-white border border-emerald-200/80 rounded-xl overflow-hidden shadow-xs">
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="p-4 sm:p-5">
              <p className="text-xs font-medium text-slate-500">Verified Accounts</p>
              <p className="font-display text-2xl font-bold text-emerald-700 tabular-nums mt-1">
                {users.filter((u) => u.status === 'approved').length}
              </p>
            </div>
          </div>
          <div className="bg-white border border-blue-200/80 rounded-xl overflow-hidden shadow-xs">
            <div className="h-1 w-full bg-gradient-to-r from-blue-600 to-indigo-600" />
            <div className="p-4 sm:p-5">
              <p className="text-xs font-medium text-slate-500">Active Examination Mode</p>
              <p className="font-display text-base font-bold text-blue-800 mt-2">
                {systemSettings.resultMode === 'instant'
                  ? 'Option 1: Instant'
                  : 'Option 2: Admin Review'}
              </p>
            </div>
          </div>
          <div className="bg-white border border-indigo-200/80 rounded-xl overflow-hidden shadow-xs">
            <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-purple-500" />
            <div className="p-4 sm:p-5">
              <p className="text-xs font-medium text-slate-500">Held Submissions</p>
              <p className="font-display text-2xl font-bold text-indigo-700 tabular-nums mt-1">
                {unreleasedAttemptsCount}
              </p>
            </div>
          </div>
        </div>

        {/* TAB 1: User Verification Queue */}
        {activeTab === 'users' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-slate-700" />
                  <h2 className="font-display text-lg font-semibold text-slate-900">
                    Student &amp; Teacher Verification Queue
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Showing <span className="font-semibold text-slate-800">{filteredUsers.length}</span> accounts ·{' '}
                  <span className="font-semibold text-blue-800">
                    {filteredClassApprovedStudentCount} Approved {userClassFilter === 'All' ? 'Total Students' : `Students in ${GRADE_LABELS[userClassFilter]}`}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(['all', 'pending', 'approved', 'paused', 'rejected'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md capitalize cursor-pointer ${
                        statusFilter === st
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <select
                  value={userClassFilter}
                  onChange={(e) => setUserClassFilter(e.target.value as GradeLevel | 'All')}
                  aria-label="Filter accounts by class"
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg"
                >
                  <option value="All">All Classes</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      {GRADE_LABELS[g]}
                    </option>
                  ))}
                </select>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                  aria-label="Filter accounts by role"
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg"
                >
                  <option value="all">All Roles</option>
                  <option value="student">Students</option>
                  <option value="teacher">Teachers</option>
                  <option value="admin">Admins</option>
                </select>
              </div>
            </div>

            {studentsNeedingSingleClassCount > 0 && (
              <div className="mx-6 mt-4 p-3.5 rounded-lg bg-amber-50 border border-amber-300 flex items-start gap-2.5 text-xs text-amber-950">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">
                    {studentsNeedingSingleClassCount} legacy student account
                    {studentsNeedingSingleClassCount > 1 ? 's' : ''} currently set to All Classes:
                  </span>{' '}
                  Student accounts are restricted to a single class. Affected students will be prompted to select one class upon sign-in, or you can assign their class directly in the table below.
                </div>
              </div>
            )}

            {filteredUsers.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No accounts match the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Applicant</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Class · Subject</th>
                      <th className="py-3 px-4">ID / Roll No.</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Permission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {filteredUsers.map((account) => {
                      const isAccountMainAdmin = BOOTSTRAPPED_ADMIN_EMAILS.includes(
                        account.email.toLowerCase(),
                      );
                      return (
                      <tr key={account.uid} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          {account.role === 'student' ? (
                            <button
                              type="button"
                              onClick={() => setSelectedStudentId(account.uid)}
                              className="text-left group cursor-pointer"
                              title="Click to view full student test record & overall percentage"
                            >
                              <div className="font-semibold text-blue-800 group-hover:underline inline-flex items-center gap-1.5">
                                <span>{account.fullName}</span>
                                <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                  Record
                                </span>
                              </div>
                              <div className="text-xs text-slate-500">{account.email}</div>
                            </button>
                          ) : (
                            <>
                              <div className="font-medium text-slate-900">{account.fullName}</div>
                              <div className="text-xs text-slate-500">{account.email}</div>
                            </>
                          )}
                        </td>
                        <td className="py-3 px-4 capitalize font-medium text-slate-800">
                          {isAccountMainAdmin ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              <ShieldCheck className="w-3.5 h-3.5" /> Main Admin
                            </span>
                          ) : account.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                              Admin
                            </span>
                          ) : (
                            account.role
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {account.role === 'student' ? (
                            <div className="space-y-1">
                              <select
                                value={isSingleStudentGrade(account.grade) ? account.grade : ''}
                                aria-label={`Assigned class for ${account.fullName}`}
                                onChange={(e) => {
                                  const nextGrade = e.target.value as GradeLevel;
                                  if (isSingleStudentGrade(nextGrade)) {
                                    void updateAccountClass({
                                      uid: account.uid,
                                      grade: nextGrade,
                                      adminUid: firebaseUser.uid,
                                    });
                                  }
                                }}
                                className={`px-2 py-1 text-xs font-semibold rounded-md border cursor-pointer ${
                                  isSingleStudentGrade(account.grade)
                                    ? 'bg-white border-slate-300 text-slate-800'
                                    : 'bg-amber-50 border-amber-400 text-amber-900'
                                }`}
                              >
                                {!isSingleStudentGrade(account.grade) && (
                                  <option value="" disabled>
                                    All Classes — Select Class
                                  </option>
                                )}
                                {GRADES.map((g) => (
                                  <option key={g} value={g}>
                                    {g}
                                  </option>
                                ))}
                              </select>
                              <div className="text-[11px] text-slate-500">{account.subject}</div>
                            </div>
                          ) : (
                            <span>
                              {account.grade} · {account.subject}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700">
                          {account.identifier || '—'}
                        </td>
                        <td className="py-3 px-4">
                          {account.status === 'approved' && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                            </span>
                          )}
                          {account.status === 'pending' && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                              <Clock className="w-3.5 h-3.5" /> Pending
                            </span>
                          )}
                          {account.status === 'paused' && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700">
                              <PauseCircle className="w-3.5 h-3.5" /> Paused
                            </span>
                          )}
                          {account.status === 'rejected' && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                              <X className="w-3.5 h-3.5" /> Declined
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                          {account.role !== 'admin' && account.status !== 'approved' && (
                            <button
                              type="button"
                              disabled={account.role === 'student' && !isSingleStudentGrade(account.grade)}
                              title={
                                account.role === 'student' && !isSingleStudentGrade(account.grade)
                                  ? 'Assign a single class (9th, 10th, 1st A, or 2nd Year) before approving this student'
                                  : undefined
                              }
                              onClick={() =>
                                void updateAccountApproval({
                                  uid: account.uid,
                                  email: account.email,
                                  status: 'approved',
                                  adminUid: firebaseUser.uid,
                                })
                              }
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed rounded-md inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                          )}

                          {isMainAdmin && account.role !== 'admin' && account.status === 'approved' && (
                            <button
                              type="button"
                              onClick={() =>
                                void updateAccountApproval({
                                  uid: account.uid,
                                  email: account.email,
                                  status: 'approved',
                                  role: 'admin',
                                  adminUid: firebaseUser.uid,
                                })
                              }
                              className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-md inline-flex items-center gap-1 cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" /> Make Admin
                            </button>
                          )}

                          {account.role !== 'admin' && account.status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() =>
                                void updateAccountApproval({
                                  uid: account.uid,
                                  email: account.email,
                                  status: 'rejected',
                                  adminUid: firebaseUser.uid,
                                })
                              }
                              className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-md inline-flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" /> {account.status === 'approved' ? 'Revoke' : 'Decline'}
                            </button>
                          )}

                          {account.role === 'admin' && isAccountMainAdmin && (
                            <span className="text-xs font-medium text-amber-700">
                              Main Admin (Protected)
                            </span>
                          )}

                          {account.role === 'admin' && !isAccountMainAdmin && isMainAdmin && (
                            <>
                              {account.status === 'paused' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void pauseOrResumeAdmin({
                                      uid: account.uid,
                                      email: account.email,
                                      pause: false,
                                      mainAdminUid: firebaseUser.uid,
                                    })
                                  }
                                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <PlayCircle className="w-3.5 h-3.5" /> Resume Admin
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void pauseOrResumeAdmin({
                                      uid: account.uid,
                                      email: account.email,
                                      pause: true,
                                      mainAdminUid: firebaseUser.uid,
                                    })
                                  }
                                  className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-md inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <PauseCircle className="w-3.5 h-3.5" /> Pause Admin
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  void revokeAdminAccess({
                                    uid: account.uid,
                                    mainAdminUid: firebaseUser.uid,
                                  })
                                }
                                className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-md inline-flex items-center gap-1 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" /> Revoke
                              </button>
                            </>
                          )}

                          {account.role === 'admin' && !isAccountMainAdmin && !isMainAdmin && (
                            <span className="text-xs text-slate-400">Administrator</span>
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
        )}

        {/* TAB 2: Admin Examination Mode Selection */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-200">
              <Settings className="w-5 h-5 text-slate-700" />
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Examination Mode & Result Delivery Configuration
                </h2>
                <p className="text-xs text-slate-500">
                  Select between Instant Mode and Controlled Review Mode across the examination platform.
                </p>
              </div>
            </div>

            {/* Primary Mode Selection: Instant vs Second Option */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-900">
                1. Result Delivery Option
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setResultMode('instant')}
                  className={`text-left p-5 rounded-xl border transition-colors cursor-pointer ${
                    resultMode === 'instant'
                      ? 'bg-blue-50 border-blue-700'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-display text-base font-bold text-slate-900">
                      Option 1: Instant Mode
                    </span>
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        resultMode === 'instant' ? 'border-blue-700' : 'border-slate-400'
                      }`}
                    >
                      {resultMode === 'instant' && (
                        <span className="w-2 h-2 rounded-full bg-blue-700" />
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Scores, pass/fail status, and detailed answer explanations are released
                    immediately upon student submission.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setResultMode('admin_review')}
                  className={`text-left p-5 rounded-xl border transition-colors cursor-pointer ${
                    resultMode === 'admin_review'
                      ? 'bg-blue-50 border-blue-700'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-display text-base font-bold text-slate-900">
                      Option 2: Controlled / Admin Review Mode
                    </span>
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        resultMode === 'admin_review' ? 'border-blue-700' : 'border-slate-400'
                      }`}
                    >
                      {resultMode === 'admin_review' && (
                        <span className="w-2 h-2 rounded-full bg-blue-700" />
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Student submissions are held for administrative review. Scores and answer keys
                    remain hidden until explicitly released in the Results tab.
                  </p>
                </button>
              </div>
            </div>

            {/* Test Access Mode */}
            <div className="space-y-3 pt-2">
              <label className="block text-sm font-semibold text-slate-900">
                2. Test Availability Option
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTestAccessMode('instant_open')}
                  className={`text-left p-5 rounded-xl border transition-colors cursor-pointer ${
                    testAccessMode === 'instant_open'
                      ? 'bg-blue-50 border-blue-700'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-display text-base font-bold text-slate-900">
                      Instant Open Access
                    </span>
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        testAccessMode === 'instant_open' ? 'border-blue-700' : 'border-slate-400'
                      }`}
                    >
                      {testAccessMode === 'instant_open' && (
                        <span className="w-2 h-2 rounded-full bg-blue-700" />
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    All active tests become immediately accessible to verified students upon
                    publication.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTestAccessMode('scheduled_window')}
                  className={`text-left p-5 rounded-xl border transition-colors cursor-pointer ${
                    testAccessMode === 'scheduled_window'
                      ? 'bg-blue-50 border-blue-700'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-display text-base font-bold text-slate-900">
                      Scheduled Release Window
                    </span>
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        testAccessMode === 'scheduled_window' ? 'border-blue-700' : 'border-slate-400'
                      }`}
                    >
                      {testAccessMode === 'scheduled_window' && (
                        <span className="w-2 h-2 rounded-full bg-blue-700" />
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tests can specify a scheduled date & time before verified students are allowed
                    to start the examination.
                  </p>
                </button>
              </div>
            </div>

            {/* Additional Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200 items-center">
              <label className="flex items-center gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowTeacherPaperCreation}
                  onChange={(e) => setAllowTeacherPaperCreation(e.target.checked)}
                  className="w-4 h-4 accent-blue-700"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Allow Teachers to Create Papers
                  </div>
                  <div className="text-xs text-slate-500">
                    Turn off to immediately stop teachers from creating new papers
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowStudentAnswerKeyReview}
                  onChange={(e) => setAllowStudentAnswerKeyReview(e.target.checked)}
                  className="w-4 h-4 accent-emerald-700"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Allow Students to View Answer Key (Read-Only)
                  </div>
                  <div className="text-xs text-slate-500">
                    Keep unchecked to hide all submitted papers from students (marks &amp; record only). Check to allow read-only Answer Key review of given papers.
                  </div>
                </div>
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Default Duration (Minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={defaultTimeLimitMinutes}
                  onChange={(e) => setDefaultTimeLimitMinutes(Number(e.target.value) || 15)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Passing Score Threshold (%)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={passingPercentage}
                  onChange={(e) => setPassingPercentage(Number(e.target.value) || 50)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
            </div>

            {settingsSavedMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{settingsSavedMsg}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {savingSettings ? 'Saving Configuration...' : 'Save Examination Policy'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: MCQ Test Studio & Institution Bank */}
        {activeTab === 'tests' && (
          <div className="space-y-6">
            <TestGeneratorPanel
              creatorUid={firebaseUser.uid}
              creatorName={userProfile?.fullName || 'Administrator'}
              creatorRole="admin"
              lockedGrade={isSingleClassEdition ? activeEdition : undefined}
              systemSettings={systemSettings}
            />

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  All Institution MCQ Tests
                </h2>
              </div>

              {tests.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  No MCQ tests created yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Title</th>
                        <th className="py-3 px-4">Class · Subject</th>
                        <th className="py-3 px-4">Author</th>
                        <th className="py-3 px-4">Result Mode</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {tests.map((t) => {
                        const mcqCount = t.questions?.length ?? t.questionCount ?? 0;
                        const shortCount = t.shortQuestions?.length ?? t.shortQuestionCount ?? 0;
                        const longCount = t.longQuestions?.length ?? t.longQuestionCount ?? 0;
                        const permittedClasses =
                          t.allowedGrades && t.allowedGrades.length > 0 ? t.allowedGrades : [t.grade];
                        const startMs = t.scheduledReleaseAt ? new Date(t.scheduledReleaseAt).getTime() : NaN;
                        const effectiveEndMs = getEffectiveTestEndMs(t);
                        const now = Date.now();
                        const isExpired = effectiveEndMs !== null && effectiveEndMs < now;
                        const isScheduled = !Number.isNaN(startMs) && startMs > now;
                        return (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium text-slate-900">
                            <div>{t.title}</div>
                            <div className="text-[11px] font-normal text-slate-500 mt-0.5 tabular-nums">
                              {t.board === 'punjab_ptb' ? 'Punjab PTB' : 'Federal NBF'} · {mcqCount} MCQs
                              {shortCount > 0 ? ` · ${shortCount} Short` : ''}
                              {longCount > 0 ? ` · ${longCount} Long` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <div>{t.grade} · {t.subject}</div>
                            <div className="text-[11px] text-slate-500">
                              Permitted: {permittedClasses.join(', ')}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {t.createdByName} ({t.createdByRole})
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={t.deliveryMode}
                              onChange={(e) =>
                                void updateTestDeliveryOverride(
                                  t.id,
                                  e.target.value as TestDeliveryOverride,
                                )
                              }
                              className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-md"
                            >
                              <option value="inherit">Inherit Global</option>
                              <option value="instant">Option 1: Instant</option>
                              <option value="admin_review">Option 2: Admin Review</option>
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            {t.isActive ? (
                              isExpired ? (
                                <span className="text-xs font-semibold text-red-700">Expired (Auto-Hidden)</span>
                              ) : isScheduled ? (
                                <span className="text-xs font-semibold text-amber-700">Scheduled (Countdown Active)</span>
                              ) : (
                                <span className="text-xs font-semibold text-emerald-700">Active (Live for Students)</span>
                              )
                            ) : (
                              <span className="text-xs font-semibold text-slate-500">Inactive (Hidden)</span>
                            )}
                            {t.scheduledReleaseAt && (
                              <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                                Starts: {new Date(t.scheduledReleaseAt).toLocaleString()}
                              </div>
                            )}
                            {effectiveEndMs !== null && (
                              <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                                Closes: {new Date(effectiveEndMs).toLocaleString()}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-2.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() =>
                                setSchedulingState({
                                  test: t,
                                  expiredNotice: isExpired,
                                })
                              }
                              className="px-2.5 py-1 text-xs font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md inline-flex items-center gap-1 cursor-pointer"
                            >
                              <CalendarClock className="w-3.5 h-3.5" /> Set Time / Access
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrintingTest(t)}
                              className="text-xs font-semibold text-slate-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" /> Print Paper
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewTest(t)}
                              className="text-xs font-semibold text-blue-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" /> Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (isExpired) {
                                  setSchedulingState({
                                    test: t,
                                    initialActive: true,
                                    expiredNotice: true,
                                  });
                                } else {
                                  void toggleTestActiveStatus(t.id, !t.isActive);
                                }
                              }}
                              className="text-xs font-semibold text-slate-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              {isExpired ? (
                                <>
                                  <PlayCircle className="w-3.5 h-3.5 text-emerald-700" /> Re-Activate &amp; Set Time
                                </>
                              ) : t.isActive ? (
                                <>
                                  <PauseCircle className="w-3.5 h-3.5" /> Pause
                                </>
                              ) : (
                                <>
                                  <PlayCircle className="w-3.5 h-3.5" /> Activate
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteMCQTest(t.id)}
                              className="text-xs font-semibold text-red-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
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

        {/* TAB 4: Results, Attendance & Absent Tracking */}
        {activeTab === 'results' && (
          <div className="space-y-5">
            {/* Class & Test Attendance Summary Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-xs">
                <p className="text-xs font-medium text-slate-500">
                  {resultsClassFilter === 'All'
                    ? 'Total Approved Students'
                    : `Students in ${GRADE_LABELS[resultsClassFilter]}`}
                </p>
                <p className="font-display text-2xl font-bold text-blue-800 tabular-nums mt-1">
                  {resultsSummary.classStudents}
                </p>
              </div>
              <div className="bg-white border border-indigo-200 rounded-xl p-4 shadow-xs">
                <p className="text-xs font-medium text-slate-500">
                  {resultsClassFilter === 'All'
                    ? 'Tests Conducted (All Classes)'
                    : `Tests for ${GRADE_LABELS[resultsClassFilter]}`}
                </p>
                <p className="font-display text-2xl font-bold text-indigo-800 tabular-nums mt-1">
                  {resultsSummary.totalTestsConducted}
                  <span className="text-xs font-medium text-slate-500 ml-1.5">
                    ({resultsSummary.closedTestsCount} Closed)
                  </span>
                </p>
              </div>
              <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-xs">
                <p className="text-xs font-medium text-emerald-700">Present / Submitted</p>
                <p className="font-display text-2xl font-bold text-emerald-700 tabular-nums mt-1">
                  {resultsSummary.presentCount}
                  {resultsSummary.cancelledCount > 0 && (
                    <span className="text-xs font-semibold text-orange-700 ml-1.5">
                      (+{resultsSummary.cancelledCount} Cancelled)
                    </span>
                  )}
                </p>
              </div>
              <div className="bg-white border border-red-200 rounded-xl p-4 shadow-xs">
                <p className="text-xs font-medium text-red-700">Absent (Missed Exam)</p>
                <p className="font-display text-2xl font-bold text-red-700 tabular-nums mt-1">
                  {resultsSummary.absentCount}
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      Student Submissions, Class Attendance &amp; Absent Record
                    </h2>
                    <p className="text-xs text-slate-500">
                      Select a class or test to inspect enrolled student count, conducted exams, submissions, and auto-marked Absents.
                    </p>
                  </div>

                  {unreleasedAttemptsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleReleaseAllPending()}
                      className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      Release All Held Results ({unreleasedAttemptsCount})
                    </button>
                  )}
                </div>

                {/* Class, Test, Attendance Filters */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <select
                    value={resultsClassFilter}
                    onChange={(e) => {
                      const nextClass = e.target.value as GradeLevel | 'All';
                      setResultsClassFilter(nextClass);
                      setResultsTestFilter('all');
                    }}
                    aria-label="Filter results by class"
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="All">All Classes ({approvedStudents.length} Students)</option>
                    {GRADES.map((g) => {
                      const count = approvedStudents.filter(
                        (s) => String(s.grade).trim() === g,
                      ).length;
                      return (
                        <option key={g} value={g}>
                          {GRADE_LABELS[g]} ({count} Students)
                        </option>
                      );
                    })}
                  </select>

                  <select
                    value={resultsTestFilter}
                    onChange={(e) => setResultsTestFilter(e.target.value)}
                    aria-label="Filter results by test"
                    className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg max-w-xs"
                  >
                    <option value="all">
                      All Conducted Tests ({resultsTestsDropdownOptions.length})
                    </option>
                    {resultsTestsDropdownOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.grade} · {t.subject})
                      </option>
                    ))}
                  </select>

                  <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    {(
                      [
                        { id: 'all', label: 'All Records' },
                        { id: 'present', label: 'Present' },
                        { id: 'absent', label: 'Absent (Missed)' },
                        { id: 'cancelled', label: 'Cancelled' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setResultsAttendanceFilter(opt.id)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                          resultsAttendanceFilter === opt.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {unifiedResultAttendanceRows.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  No submissions or absent records match the selected filters yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Assessment</th>
                        <th className="py-3 px-4">Class · Subject</th>
                        <th className="py-3 px-4">Attendance</th>
                        <th className="py-3 px-4">Score</th>
                        <th className="py-3 px-4">Question Summary</th>
                        <th className="py-3 px-4">Release State</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {unifiedResultAttendanceRows.map((row) => {
                        if (row.kind === 'absent') {
                          const { student, test, endMs, totalMarks, key } = row;
                          const totalQs = test.questionCount || test.questions?.length || 0;
                          return (
                            <tr key={key} className="bg-red-50/30 hover:bg-red-50/60">
                              <td className="py-3 px-4">
                                <button
                                  type="button"
                                  onClick={() => setSelectedStudentId(student.uid)}
                                  className="text-left group cursor-pointer"
                                  title="Click to view student's full test record"
                                >
                                  <div className="font-semibold text-blue-900 group-hover:underline">
                                    {student.fullName}
                                  </div>
                                  <div className="text-xs text-slate-500 font-mono">
                                    {student.identifier || student.uid.slice(0, 8)} · Class {student.grade}
                                  </div>
                                </button>
                              </td>
                              <td className="py-3 px-4">
                                <div className="text-slate-900 font-medium">{test.title}</div>
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
                              <td className="py-3 px-4 text-xs tabular-nums text-slate-600 whitespace-nowrap">
                                <div>Attempted: <strong className="text-slate-900">0 / {totalQs}</strong></div>
                                <div className="text-[11px] mt-0.5">
                                  <span className="text-emerald-700 font-semibold">0 Correct</span> ·{' '}
                                  <span className="text-red-700 font-semibold">0 Wrong</span> ·{' '}
                                  <span className="text-amber-700 font-semibold">{totalQs} Left</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-xs font-semibold text-red-700">
                                Marked Absent
                              </td>
                              <td className="py-3 px-4 text-right text-xs text-slate-500">
                                Time Expired · Not Attempted
                              </td>
                            </tr>
                          );
                        }

                        const { attempt: a } = row;
                        const breakdown = getAttemptBreakdown(a);
                        return (
                          <tr key={a.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => setSelectedStudentId(a.studentId)}
                                className="text-left group cursor-pointer"
                                title="Click to view student's full test record"
                              >
                                <div className="font-semibold text-blue-900 group-hover:underline">
                                  {a.studentName}
                                </div>
                                <div className="text-xs text-slate-500 font-mono">
                                  {a.studentIdentifier || a.studentId.slice(0, 8)}
                                </div>
                              </button>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-slate-800">{a.testTitle}</div>
                              {a.autoCancelled && (
                                <div className="text-[11px] font-semibold text-red-700 mt-0.5">
                                  {a.terminationReason || 'Auto-Cancelled (Left Screen Lock)'}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {a.grade} · {a.subject}
                            </td>
                            <td className="py-3 px-4">
                              {a.autoCancelled ? (
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
                              {a.obtainedMarks ?? a.score} / {a.totalMarks ?? a.totalQuestions} ({a.percentage}%)
                            </td>
                            <td className="py-3 px-4 text-xs tabular-nums text-slate-600 whitespace-nowrap">
                              {breakdown.total === 0 ? (
                                <span className="text-slate-500">Subjective Paper</span>
                              ) : (
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
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-[11px] text-slate-500 mb-0.5">
                                {a.deliveryModeUsed === 'instant' ? 'Option 1: Instant' : 'Option 2: Admin Review'}
                              </div>
                              {a.resultReleased ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Released
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                                  <Clock className="w-3.5 h-3.5" /> Held
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                              {!a.resultReleased && (
                                <button
                                  type="button"
                                  onClick={() => void releaseAttemptResult(a.id, firebaseUser.uid)}
                                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md cursor-pointer"
                                >
                                  Release Result
                                </button>
                              )}
                              {!a.autoCancelled && a.resultReleased && (
                                <button
                                  type="button"
                                  disabled={systemSettings.allowStudentAnswerKeyReview === true}
                                  title={
                                    systemSettings.allowStudentAnswerKeyReview === true
                                      ? 'Answer Key review is globally enabled for all students'
                                      : 'Permit or lock read-only Answer Key view for this student attempt'
                                  }
                                  onClick={() =>
                                    void toggleAttemptAnswerKeyRelease(a.id, !a.answerKeyReleased)
                                  }
                                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-md border cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                                    systemSettings.allowStudentAnswerKeyReview === true || a.answerKeyReleased
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  {systemSettings.allowStudentAnswerKeyReview === true
                                    ? 'Key Open (Global)'
                                    : a.answerKeyReleased
                                      ? 'Lock Key'
                                      : 'Allow Key'}
                                </button>
                              )}
                              {a.autoCancelled && (
                                <button
                                  type="button"
                                  onClick={() => void deleteTestAttempt(a.id)}
                                  className="px-2.5 py-1.5 text-xs font-semibold text-orange-800 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-md cursor-pointer"
                                >
                                  Allow Retake
                                </button>
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

      {printingTest && (
        <PrintablePaperModal
          title={printingTest.title}
          board={printingTest.board}
          schoolName={printingTest.schoolName}
          examLabel={printingTest.examLabel}
          paperDate={printingTest.paperDate}
          grade={printingTest.grade}
          subject={printingTest.subject}
          topic={printingTest.topic}
          durationMinutes={printingTest.durationMinutes}
          sectionATimeMinutes={printingTest.sectionATimeMinutes}
          patternLabel={printingTest.patternLabel}
          marksPerQuestion={printingTest.marksPerQuestion}
          questions={printingTest.questions}
          shortQuestions={printingTest.shortQuestions}
          longQuestions={printingTest.longQuestions}
          shortChoiceNote={printingTest.shortChoiceNote}
          longChoiceNote={printingTest.longChoiceNote}
          onClose={() => setPrintingTest(null)}
        />
      )}

      {schedulingState && (
        <ScheduleAccessModal
          test={schedulingState.test}
          initialActive={schedulingState.initialActive}
          expiredNotice={schedulingState.expiredNotice}
          currentUser={{
            uid: firebaseUser.uid,
            name: userProfile?.fullName || 'Administrator',
            role: 'admin',
          }}
          onClose={() => setSchedulingState(null)}
        />
      )}

      {selectedStudentReport && (
        <StudentRecordModal
          report={selectedStudentReport}
          passingPercentage={systemSettings.passingPercentage}
          globalAnswerKeyEnabled={systemSettings.allowStudentAnswerKeyReview === true}
          onReleaseAttempt={(attempt) =>
            releaseAttemptResult(attempt.id, firebaseUser.uid)
          }
          onAllowRetake={(attempt) => deleteTestAttempt(attempt.id)}
          onToggleAnswerKey={(attempt, allow) =>
            toggleAttemptAnswerKeyRelease(attempt.id, allow)
          }
          onClose={() => setSelectedStudentId(null)}
        />
      )}

      {showBrochureModal && (
        <PlatformBrochureModal onClose={() => setShowBrochureModal(false)} />
      )}

      {showClassDeploymentsModal && (
        <ClassDeploymentsModal
          getIdToken={() => firebaseUser.getIdToken()}
          onClose={() => setShowClassDeploymentsModal(false)}
        />
      )}
    </div>
  );
}
