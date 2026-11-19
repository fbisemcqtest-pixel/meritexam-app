import React, { useEffect, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  LogOut,
  PauseCircle,
  PlayCircle,
  Printer,
  Trash2,
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
  deleteMCQTest,
  releaseAttemptResult,
  toggleTestActiveStatus,
} from '../services/mcqService';
import { MCQTest, TestAttempt } from '../types';
import { TestGeneratorPanel } from './TestGeneratorPanel';
import { TestRunner } from './TestRunner';
import { PrintablePaperModal } from './PrintablePaperModal';
import { ScheduleAccessModal } from './ScheduleAccessModal';
import { DeveloperFooter } from './DeveloperFooter';

export function TeacherDashboard() {
  const { userProfile, systemSettings, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'create' | 'bank' | 'submissions'>('create');
  const [myTests, setMyTests] = useState<MCQTest[]>([]);
  const [submissions, setSubmissions] = useState<TestAttempt[]>([]);
  const [previewTest, setPreviewTest] = useState<MCQTest | null>(null);
  const [printingTest, setPrintingTest] = useState<MCQTest | null>(null);
  const [schedulingTest, setSchedulingTest] = useState<MCQTest | null>(null);

  useEffect(() => {
    if (!userProfile) return;

    const testsQuery = query(
      collection(db, 'tests'),
      where('createdBy', '==', userProfile.uid),
    );
    const unsubTests = onSnapshot(
      testsQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as MCQTest);
        list.sort((a, b) => {
          const aSec = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
          const bSec = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
          return bSec - aSec;
        });
        setMyTests(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tests');
      },
    );

    const attemptsQuery = query(
      collection(db, 'attempts'),
      where('testCreatorId', '==', userProfile.uid),
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
        setSubmissions(list);
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

  const teacherPaperCreationAllowed = systemSettings.allowTeacherPaperCreation !== false;

  if (!userProfile) return null;

  if (previewTest) {
    return (
      <TestRunner
        test={previewTest}
        studentProfile={userProfile}
        systemSettings={systemSettings}
        previewMode
        onExit={() => setPreviewTest(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="h-1 w-full bg-gradient-to-r from-teal-600 via-blue-600 to-amber-500" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-4 md:gap-8">
          <div className="font-display text-base sm:text-lg font-bold text-slate-900 whitespace-nowrap shrink-0 inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-gradient-to-br from-teal-600 to-emerald-600 shrink-0" />
            <span>MeritExam Teacher</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'create'
                  ? 'border-blue-700 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Create MCQ Test
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bank')}
              className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'bank'
                  ? 'border-blue-700 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              My Tests ({myTests.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('submissions')}
              className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'submissions'
                  ? 'border-blue-700 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Submissions ({submissions.length})
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
        <nav aria-label="Teacher sections" className="grid grid-cols-3 gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-2.5 py-2.5 text-xs font-semibold rounded-lg border text-center whitespace-nowrap truncate cursor-pointer transition-colors ${
              activeTab === 'create'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Create Paper
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bank')}
            className={`px-2.5 py-2.5 text-xs font-semibold rounded-lg border text-center whitespace-nowrap truncate cursor-pointer transition-colors ${
              activeTab === 'bank'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            My Tests ({myTests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            className={`px-2.5 py-2.5 text-xs font-semibold rounded-lg border text-center whitespace-nowrap truncate cursor-pointer transition-colors ${
              activeTab === 'submissions'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Results ({submissions.length})
          </button>
        </nav>

        <div className="bg-white border border-teal-200/80 rounded-xl overflow-hidden shadow-xs">
          <div className="h-1.5 w-full bg-gradient-to-r from-teal-600 to-emerald-600" />
          <div className="bg-gradient-to-r from-teal-50/60 via-white to-emerald-50/40 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">
                {userProfile.fullName}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Verified Teacher · Subject: <span className="font-semibold text-teal-800">{userProfile.subject}</span> · Class Focus: <span className="font-semibold text-slate-800">{userProfile.grade}</span>
              </p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-xs text-slate-500">Admin Examination Policy</p>
              <p className="text-sm font-semibold text-teal-800 mt-0.5">
                {systemSettings.resultMode === 'instant'
                  ? 'Option 1: Instant Result Mode'
                  : 'Option 2: Controlled / Admin Review Mode'}
              </p>
              {!teacherPaperCreationAllowed && (
                <p className="text-xs font-semibold text-orange-700 mt-1 inline-flex items-center gap-1">
                  <PauseCircle className="w-3.5 h-3.5" />
                  New Paper Creation Paused by Admin
                </p>
              )}
            </div>
          </div>
        </div>

        {activeTab === 'create' && (
          teacherPaperCreationAllowed ? (
            <TestGeneratorPanel
              creatorUid={userProfile.uid}
              creatorName={userProfile.fullName}
              creatorRole="teacher"
              defaultGrade={userProfile.grade}
              defaultSubject={userProfile.subject}
              systemSettings={systemSettings}
              onPublished={() => setActiveTab('bank')}
            />
          ) : (
            <div className="bg-white border border-orange-200 rounded-xl p-8 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 flex items-center justify-center mx-auto">
                <PauseCircle className="w-6 h-6" />
              </div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Paper Creation Paused by Administrator
              </h2>
              <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                The Administrator has temporarily turned off new paper generation for teachers. You can still view, preview, or print your existing saved tests until the Administrator re-enables paper creation.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('bank')}
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Open My Existing Papers ({myTests.length})
                </button>
              </div>
            </div>
          )
        )}

        {activeTab === 'bank' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Published MCQ Assessments
              </h2>
              {teacherPaperCreationAllowed && (
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                >
                  New Test
                </button>
              )}
            </div>

            {myTests.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                You have not published any MCQ tests yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Title</th>
                      <th className="py-3 px-4">Class · Subject</th>
                      <th className="py-3 px-4">Questions</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {myTests.map((t) => {
                      const permittedClasses =
                        t.allowedGrades && t.allowedGrades.length > 0 ? t.allowedGrades : [t.grade];
                      const endMs = t.scheduledEndAt ? new Date(t.scheduledEndAt).getTime() : NaN;
                      const isExpired = !Number.isNaN(endMs) && endMs < Date.now();
                      return (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium text-slate-900">{t.title}</td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{t.grade} · {t.subject}</div>
                          <div className="text-[11px] text-slate-500">
                            {t.board === 'punjab_ptb' ? 'Punjab Board (PTB)' : 'Federal Board (NBF)'} · Permitted: {permittedClasses.join(', ')}
                          </div>
                        </td>
                        <td className="py-3 px-4 tabular-nums text-slate-700">
                          {t.questionCount} MCQs
                          {(t.shortQuestions?.length ?? 0) > 0 ? ` · ${t.shortQuestions!.length} Short` : ''}
                          {(t.longQuestions?.length ?? 0) > 0 ? ` · ${t.longQuestions!.length} Long` : ''}{' '}
                          ({t.marksPerQuestion ?? 1} mk/MCQ) · {t.durationMinutes} min
                        </td>
                        <td className="py-3 px-4">
                          {t.isActive ? (
                            isExpired ? (
                              <span className="text-xs font-semibold text-red-700">Expired (Hidden)</span>
                            ) : (
                              <span className="text-xs font-semibold text-emerald-700">Active</span>
                            )
                          ) : (
                            <span className="text-xs font-semibold text-slate-500">Paused</span>
                          )}
                          {t.scheduledReleaseAt && (
                            <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                              Starts: {new Date(t.scheduledReleaseAt).toLocaleString()}
                            </div>
                          )}
                          {t.scheduledEndAt && (
                            <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                              Closes: {new Date(t.scheduledEndAt).toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSchedulingTest(t)}
                            className="text-xs font-semibold text-indigo-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <CalendarClock className="w-3.5 h-3.5" /> Access / Time
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
        )}

        {activeTab === 'submissions' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Student Test Submissions
              </h2>
            </div>

            {submissions.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No student submissions received yet.
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
                      <th className="py-3 px-4">Release Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{sub.studentName}</div>
                          <div className="text-xs text-slate-500 font-mono">
                            {sub.studentIdentifier || sub.studentId.slice(0, 8)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800">{sub.testTitle}</div>
                          {sub.autoCancelled && (
                            <div className="text-[11px] font-semibold text-red-700 mt-0.5">
                              Auto-Cancelled (Left Screen Lock)
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {sub.grade} · {sub.subject}
                        </td>
                        <td className="py-3 px-4 tabular-nums font-semibold text-slate-900">
                          {sub.obtainedMarks ?? sub.score} / {sub.totalMarks ?? sub.totalQuestions} ({sub.percentage}%)
                        </td>
                        <td className="py-3 px-4">
                          {sub.resultReleased ? (
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
                          {!sub.resultReleased && (
                            <button
                              type="button"
                              onClick={() => void releaseAttemptResult(sub.id, userProfile.uid)}
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

      {schedulingTest && (
        <ScheduleAccessModal
          test={schedulingTest}
          onClose={() => setSchedulingTest(null)}
        />
      )}
    </div>
  );
}
