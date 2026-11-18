import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FilePlus2,
  LogOut,
  PauseCircle,
  PlayCircle,
  Printer,
  Settings,
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
  pauseOrResumeAdmin,
  releaseAttemptResult,
  revokeAdminAccess,
  saveSystemSettings,
  toggleTeacherPaperCreation,
  toggleTestActiveStatus,
  updateAccountApproval,
  updateTestDeliveryOverride,
} from '../services/mcqService';
import {
  AccountStatus,
  MCQTest,
  ResultMode,
  TestAccessMode,
  TestAttempt,
  TestDeliveryOverride,
  UserAccount,
  UserRole,
} from '../types';
import { TestGeneratorPanel } from './TestGeneratorPanel';
import { TestRunner } from './TestRunner';
import { PrintablePaperModal } from './PrintablePaperModal';
import { DeveloperFooter } from './DeveloperFooter';

export function AdminDashboard() {
  const { firebaseUser, userProfile, isMainAdmin, systemSettings, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'tests' | 'results'>('users');

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [tests, setTests] = useState<MCQTest[]>([]);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);

  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

  // Examination Mode form state
  const [resultMode, setResultMode] = useState<ResultMode>(systemSettings.resultMode);
  const [testAccessMode, setTestAccessMode] = useState<TestAccessMode>(systemSettings.testAccessMode);
  const [allowStudentInstantPractice, setAllowStudentInstantPractice] = useState<boolean>(
    systemSettings.allowStudentInstantPractice,
  );
  const [allowTeacherPaperCreation, setAllowTeacherPaperCreation] = useState<boolean>(
    systemSettings.allowTeacherPaperCreation !== false,
  );
  const [togglingTeacherPapers, setTogglingTeacherPapers] = useState(false);
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
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  useEffect(() => {
    setResultMode(systemSettings.resultMode);
    setTestAccessMode(systemSettings.testAccessMode);
    setAllowStudentInstantPractice(systemSettings.allowStudentInstantPractice);
    setAllowTeacherPaperCreation(systemSettings.allowTeacherPaperCreation !== false);
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

  const pendingUsersCount = useMemo(
    () => users.filter((u) => u.status === 'pending').length,
    [users],
  );

  const unreleasedAttemptsCount = useMemo(
    () => attempts.filter((a) => !a.resultReleased).length,
    [attempts],
  );

  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => (statusFilter === 'all' ? true : u.status === statusFilter))
      .filter((u) => (roleFilter === 'all' ? true : u.role === roleFilter));
  }, [users, statusFilter, roleFilter]);

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
          allowStudentInstantPractice,
          allowTeacherPaperCreation,
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
      const response = await fetch('/api/admin/export-zip', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Failed to download project ZIP.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'meritexam-fbise-nbf.zip';
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
              Results ({unreleasedAttemptsCount} Held)
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
            Results ({unreleasedAttemptsCount} Held)
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
              onClick={() => setActiveTab('settings')}
              className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
            >
              <Settings className="w-4 h-4" />
              Exam Mode
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
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-700" />
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Student & Teacher Verification Queue
                </h2>
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
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg"
                >
                  <option value="all">All Roles</option>
                  <option value="student">Students</option>
                  <option value="teacher">Teachers</option>
                  <option value="admin">Admins</option>
                </select>
              </div>
            </div>

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
                          <div className="font-medium text-slate-900">{account.fullName}</div>
                          <div className="text-xs text-slate-500">{account.email}</div>
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
                          {account.grade} · {account.subject}
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
                              onClick={() =>
                                void updateAccountApproval({
                                  uid: account.uid,
                                  email: account.email,
                                  status: 'approved',
                                  adminUid: firebaseUser.uid,
                                })
                              }
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md inline-flex items-center gap-1 cursor-pointer"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-200 items-center">
              <label className="flex items-center gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowStudentInstantPractice}
                  onChange={(e) => setAllowStudentInstantPractice(e.target.checked)}
                  className="w-4 h-4 accent-blue-700"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Allow Instant Subject Practice
                  </div>
                  <div className="text-xs text-slate-500">
                    Students can launch instant MCQs by class & subject
                  </div>
                </div>
              </label>

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
                            {t.grade} · {t.subject}
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
                              <span className="text-xs font-semibold text-emerald-700">Active</span>
                            ) : (
                              <span className="text-xs font-semibold text-slate-500">Inactive</span>
                            )}
                            {t.scheduledReleaseAt && (
                              <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                                Starts: {new Date(t.scheduledReleaseAt).toLocaleString()}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-3 whitespace-nowrap">
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
                              onClick={() => void toggleTestActiveStatus(t.id, !t.isActive)}
                              className="text-xs font-semibold text-slate-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              {t.isActive ? (
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

        {/* TAB 4: Results & Release Queue */}
        {activeTab === 'results' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Student Submissions & Result Publication
                </h2>
                <p className="text-xs text-slate-500">
                  Release held results when Option 2 (Controlled Review Mode) is active.
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

            {attempts.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No student test attempts recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Assessment</th>
                      <th className="py-3 px-4">Class · Subject</th>
                      <th className="py-3 px-4">Score</th>
                      <th className="py-3 px-4">Mode Used</th>
                      <th className="py-3 px-4">Release State</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {attempts.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{a.studentName}</div>
                          <div className="text-xs text-slate-500 font-mono">
                            {a.studentIdentifier || a.studentId.slice(0, 8)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-800">{a.testTitle}</td>
                        <td className="py-3 px-4 text-slate-600">
                          {a.grade} · {a.subject}
                        </td>
                        <td className="py-3 px-4 tabular-nums font-semibold text-slate-900">
                          {a.obtainedMarks ?? a.score} / {a.totalMarks ?? a.totalQuestions} ({a.percentage}%)
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {a.deliveryModeUsed === 'instant' ? 'Option 1: Instant' : 'Option 2: Admin Review'}
                        </td>
                        <td className="py-3 px-4">
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
                        <td className="py-3 px-4 text-right">
                          {!a.resultReleased && (
                            <button
                              type="button"
                              onClick={() => void releaseAttemptResult(a.id, firebaseUser.uid)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md cursor-pointer"
                            >
                              Release Result
                            </button>
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
          marksPerQuestion={printingTest.marksPerQuestion}
          questions={printingTest.questions}
          shortQuestions={printingTest.shortQuestions}
          longQuestions={printingTest.longQuestions}
          shortChoiceNote={printingTest.shortChoiceNote}
          longChoiceNote={printingTest.longChoiceNote}
          onClose={() => setPrintingTest(null)}
        />
      )}
    </div>
  );
}
