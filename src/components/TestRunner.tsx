import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flag,
  Lock,
  Monitor,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  XCircle,
} from 'lucide-react';
import {
  MCQTest,
  SystemSettings,
  TestAttempt,
  UserAccount,
} from '../types';
import { submitTestAttempt } from '../services/mcqService';

interface TestRunnerProps {
  test: MCQTest;
  studentProfile: UserAccount;
  systemSettings: SystemSettings;
  previewMode?: boolean;
  existingAttempt?: TestAttempt | null;
  onExit: () => void;
}

function getScheduledEndMs(test: MCQTest): number | null {
  if (!test.scheduledEndAt) return null;
  const ms = new Date(test.scheduledEndAt).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function TestRunner({
  test,
  studentProfile,
  systemSettings,
  previewMode = false,
  existingAttempt = null,
  onExit,
}: TestRunnerProps) {
  const shortQuestions = test.shortQuestions ?? [];
  const longQuestions = test.longQuestions ?? [];
  const hasMcqs = test.questions.length > 0;
  const hasSubjective = shortQuestions.length > 0 || longQuestions.length > 0;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>(() =>
    existingAttempt
      ? existingAttempt.answers
      : new Array(test.questions.length).fill(-1),
  );
  const [shortAnswers, setShortAnswers] = useState<string[]>(() =>
    existingAttempt?.shortAnswers
      ? existingAttempt.shortAnswers
      : new Array(shortQuestions.length).fill(''),
  );
  const [longAnswers, setLongAnswers] = useState<string[]>(() =>
    existingAttempt?.longAnswers
      ? existingAttempt.longAnswers
      : new Array(longQuestions.length).fill(''),
  );
  const [flagged, setFlagged] = useState<boolean[]>(() =>
    new Array(test.questions.length).fill(false),
  );
  const scheduledEndMs = !previewMode && !existingAttempt ? getScheduledEndMs(test) : null;
  const [windowClosedOnEntry, setWindowClosedOnEntry] = useState<boolean>(
    () => scheduledEndMs !== null && Date.now() >= scheduledEndMs,
  );
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const durationSecs = test.durationMinutes * 60;
    if (scheduledEndMs === null) return durationSecs;
    const remainingSecs = Math.max(0, Math.floor((scheduledEndMs - Date.now()) / 1000));
    return Math.min(durationSecs, remainingSecs);
  });
  const [lockAccepted, setLockAccepted] = useState<boolean>(
    () => previewMode || Boolean(existingAttempt),
  );
  const [fullscreenLocked, setFullscreenLocked] = useState(false);
  const [confirmExitCancel, setConfirmExitCancel] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedAttempt, setSubmittedAttempt] = useState<TestAttempt | null>(
    existingAttempt,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isMobileDevice =
    typeof window !== 'undefined' &&
    (/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth < 1024));

  // Refs for latest answers & lock lifecycle so event listeners never read stale state
  const answersRef = useRef(answers);
  const shortAnswersRef = useRef(shortAnswers);
  const longAnswersRef = useRef(longAnswers);
  const submittingRef = useRef(submitting);
  const submittedAttemptRef = useRef(submittedAttempt);
  const fullscreenEngagedRef = useRef(false);
  const isExitingNormallyRef = useRef(false);
  const violationTriggeredRef = useRef(false);
  const lockStartedAtRef = useRef<number>(0);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  answersRef.current = answers;
  shortAnswersRef.current = shortAnswers;
  longAnswersRef.current = longAnswers;
  submittingRef.current = submitting;
  submittedAttemptRef.current = submittedAttempt;

  const releaseScreenLock = useCallback(async () => {
    isExitingNormallyRef.current = true;
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {
      // Ignore wake lock release errors
    }
    try {
      const docWithWebkit = document as Document & {
        webkitFullscreenElement?: Element | null;
        webkitExitFullscreen?: () => Promise<void> | void;
      };
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (docWithWebkit.webkitFullscreenElement && docWithWebkit.webkitExitFullscreen) {
        await docWithWebkit.webkitExitFullscreen();
      }
    } catch {
      // Ignore fullscreen exit errors
    }
    fullscreenEngagedRef.current = false;
    setFullscreenLocked(false);
  }, []);

  useEffect(() => {
    return () => {
      void releaseScreenLock();
    };
  }, [releaseScreenLock]);

  const performSubmit = useCallback(
    async (options?: { autoCancelled?: boolean; terminationReason?: string }) => {
      if (submittingRef.current || submittedAttemptRef.current) return;
      setErrorMsg(null);

      if (previewMode) {
        let score = 0;
        test.questions.forEach((q, idx) => {
          if (answersRef.current[idx] === q.correctIndex) score += 1;
        });
        const percentage =
          test.questions.length > 0
            ? Math.round((score / test.questions.length) * 1000) / 10
            : 100;
        const marksPerQuestion = test.marksPerQuestion ?? 1;
        const obtainedMarks = Math.round(score * marksPerQuestion * 100) / 100;
        const totalMarks = Math.round(test.questions.length * marksPerQuestion * 100) / 100;
        setSubmittedAttempt({
          id: 'preview',
          testId: test.id,
          testTitle: test.title,
          testCreatorId: test.createdBy,
          grade: test.grade,
          subject: test.subject,
          studentId: studentProfile.uid,
          studentName: studentProfile.fullName,
          studentIdentifier: studentProfile.identifier,
          answers: answersRef.current,
          shortAnswers: shortAnswersRef.current,
          longAnswers: longAnswersRef.current,
          score,
          totalQuestions: test.questions.length,
          marksPerQuestion,
          obtainedMarks,
          totalMarks,
          percentage,
          deliveryModeUsed: 'instant',
          resultReleased: true,
          status: 'reviewed',
          releasedBy: 'preview',
        });
        return;
      }

      submittingRef.current = true;
      setSubmitting(true);
      await releaseScreenLock();

      try {
        const attempt = await submitTestAttempt({
          test,
          studentId: studentProfile.uid,
          studentName: studentProfile.fullName,
          studentIdentifier: studentProfile.identifier,
          answers: answersRef.current,
          shortAnswers: shortAnswersRef.current,
          longAnswers: longAnswersRef.current,
          globalSettings: systemSettings,
          autoCancelled: options?.autoCancelled,
          terminationReason: options?.terminationReason,
        });
        submittedAttemptRef.current = attempt;
        setSubmittedAttempt(attempt);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to submit test.');
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
        setConfirmSubmit(false);
        setConfirmExitCancel(false);
      }
    },
    [previewMode, releaseScreenLock, studentProfile, systemSettings, test],
  );

  const triggerAutoCancelViolation = useCallback(
    (reason: string) => {
      if (
        previewMode ||
        existingAttempt ||
        submittedAttemptRef.current ||
        violationTriggeredRef.current
      ) {
        return;
      }
      violationTriggeredRef.current = true;
      void performSubmit({
        autoCancelled: true,
        terminationReason: reason,
      });
    },
    [existingAttempt, performSubmit, previewMode],
  );

  async function handleActivateLockAndStart() {
    setErrorMsg(null);
    if (scheduledEndMs !== null && Date.now() >= scheduledEndMs) {
      setWindowClosedOnEntry(true);
      return;
    }

    isExitingNormallyRef.current = false;
    violationTriggeredRef.current = false;

    // Request Fullscreen (works on Desktop, Laptop, and Android/Mobile browsers)
    try {
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      };
      if (el.requestFullscreen) {
        try {
          await el.requestFullscreen({ navigationUI: 'hide' });
        } catch {
          await el.requestFullscreen();
        }
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      }
      const docWithWebkit = document as Document & { webkitFullscreenElement?: Element | null };
      if (document.fullscreenElement || docWithWebkit.webkitFullscreenElement) {
        fullscreenEngagedRef.current = true;
        setFullscreenLocked(true);
      }
    } catch {
      // Fullscreen may be blocked on some iOS Safari / restricted webviews; active viewport & tab/app lock still runs
      fullscreenEngagedRef.current = false;
    }

    // Request Screen Wake Lock to keep mobile/laptop screen awake during paper
    try {
      const navWithWake = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      };
      if (navWithWake.wakeLock) {
        wakeLockRef.current = await navWithWake.wakeLock.request('screen');
      }
    } catch {
      // WakeLock optional
    }

    // Guard browser / mobile back navigation
    try {
      window.history.pushState({ meritExamLocked: true }, '', window.location.href);
    } catch {
      // Ignore history push failures
    }

    if (scheduledEndMs !== null) {
      const remainingSecs = Math.max(1, Math.floor((scheduledEndMs - Date.now()) / 1000));
      setSecondsLeft(Math.min(test.durationMinutes * 60, remainingSecs));
    }
    lockStartedAtRef.current = Date.now();
    setLockAccepted(true);
  }

  // Countdown timer runs only after Screen Lock is activated
  useEffect(() => {
    if (!lockAccepted || submittedAttempt || previewMode || windowClosedOnEntry) return;
    const timer = window.setInterval(() => {
      const hitCutoff = scheduledEndMs !== null && Date.now() >= scheduledEndMs;
      setSecondsLeft((prev) => {
        if (hitCutoff || prev <= 1) {
          window.clearInterval(timer);
          void performSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockAccepted, submittedAttempt, previewMode, windowClosedOnEntry, scheduledEndMs, performSubmit]);

  // Strict Anti-Cheat Screen Lock Listeners during active locked exam
  useEffect(() => {
    if (!lockAccepted || submittedAttempt || previewMode || windowClosedOnEntry) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerAutoCancelViolation(
          'Screen Lock Violation: Switched tab, minimized browser, or left exam app.',
        );
      }
    };

    const handleFullscreenChange = () => {
      if (isExitingNormallyRef.current || !fullscreenEngagedRef.current) return;
      const docWithWebkit = document as Document & { webkitFullscreenElement?: Element | null };
      const stillFullscreen = Boolean(
        document.fullscreenElement || docWithWebkit.webkitFullscreenElement,
      );
      if (!stillFullscreen) {
        triggerAutoCancelViolation(
          'Screen Lock Violation: Exited Fullscreen mode before submitting the paper.',
        );
      }
    };

    const handlePopState = () => {
      triggerAutoCancelViolation(
        'Screen Lock Violation: Attempted to press Back or leave the locked paper.',
      );
    };

    const handlePageHide = () => {
      triggerAutoCancelViolation(
        'Screen Lock Violation: Closed or navigated away from the locked paper.',
      );
    };

    let blurTimer: number | undefined;
    const handleWindowBlur = () => {
      // Enforce window blur on top-level windows after a 2.5s grace so brief OS message/toast banners do not false-cancel
      if (window !== window.top) return;
      if (Date.now() - lockStartedAtRef.current < 450) return;
      blurTimer = window.setTimeout(() => {
        if (!document.hasFocus() && !document.hidden) {
          triggerAutoCancelViolation(
            'Screen Lock Violation: Switched focus to another window or application.',
          );
        }
      }, 2500);
    };

    const handleWindowFocus = () => {
      if (blurTimer !== undefined) {
        window.clearTimeout(blurTimer);
        blurTimer = undefined;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleClipboardBlock = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && ['c', 'x', 'v', 'u', 'p', 's'].includes(key)) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(key))
      ) {
        e.preventDefault();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleClipboardBlock);
    document.addEventListener('cut', handleClipboardBlock);
    document.addEventListener('paste', handleClipboardBlock);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (blurTimer !== undefined) window.clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleClipboardBlock);
      document.removeEventListener('cut', handleClipboardBlock);
      document.removeEventListener('paste', handleClipboardBlock);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lockAccepted, submittedAttempt, previewMode, windowClosedOnEntry, triggerAutoCancelViolation]);

  function selectOption(optIdx: number) {
    if (submittedAttempt) return;
    setAnswers((prev) => prev.map((v, i) => (i === currentIdx ? optIdx : v)));
  }

  function toggleFlag() {
    setFlagged((prev) => prev.map((v, i) => (i === currentIdx ? !v : v)));
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const answeredCount = answers.filter((a) => a !== -1).length;
  const shortAnsweredCount = shortAnswers.filter((a) => a.trim().length > 0).length;
  const longAnsweredCount = longAnswers.filter((a) => a.trim().length > 0).length;

  if (windowClosedOnEntry && !submittedAttempt) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between">
          <span className="font-display font-bold text-slate-900">MeritExam</span>
          <button
            type="button"
            onClick={onExit}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Return to Dashboard
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white border border-red-200 rounded-xl p-8 max-w-md w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="font-display text-xl font-bold text-slate-900">
              Paper Time Window Closed
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              The permitted window for <span className="font-semibold text-slate-900">{test.title}</span>{' '}
              closed at{' '}
              <span className="font-semibold text-slate-900">
                {scheduledEndMs !== null ? new Date(scheduledEndMs).toLocaleString() : 'cutoff time'}
              </span>
              . Expired papers are no longer accessible.
            </p>
            <button
              type="button"
              onClick={onExit}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!previewMode && !existingAttempt && !lockAccepted && !submittedAttempt) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 font-display font-bold text-slate-900">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>MeritExam Screen Lock</span>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Back to Dashboard
          </button>
        </header>

        <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white border-2 border-emerald-200 rounded-2xl overflow-hidden max-w-lg w-full shadow-sm">
            <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
            <div className="p-6 sm:p-8 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {isMobileDevice ? (
                    <>
                      <Smartphone className="w-3.5 h-3.5" />
                      Mobile / Tablet Mode
                    </>
                  ) : (
                    <>
                      <Monitor className="w-3.5 h-3.5" />
                      Desktop / Laptop Mode
                    </>
                  )}
                </span>
              </div>

              <div>
                <h1 className="font-display text-xl font-bold text-slate-900">
                  Activate Green Screen Lock & Start Paper
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  {test.title} · <span className="font-semibold text-slate-800">{test.grade} {test.subject}</span> · {test.durationMinutes} Minutes
                </p>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2.5 text-xs sm:text-sm text-emerald-950">
                <div className="font-bold text-emerald-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Exam Screen Lock Rules (Mobile, Desktop & Laptop)</span>
                </div>
                <ul className="space-y-1.5 text-xs text-emerald-900 list-disc pl-5 leading-relaxed">
                  <li>
                    Starting this paper engages <strong>Green Screen Lock</strong> (Fullscreen + Screen Wake Lock) until you finish and submit.
                  </li>
                  <li>
                    <strong>Turn ON Do Not Disturb (DND):</strong> A small top message banner will not cancel your paper unless you tap/open it, but answering a call or a full-screen call screen switching you out of the browser will break Screen Lock.
                  </li>
                  <li>
                    Do <strong>not</strong> switch tabs, open another app/message, minimize the browser, press Back, or exit Fullscreen.
                  </li>
                  <li>
                    If you leave the locked exam screen, your paper will be{' '}
                    <strong className="text-red-700">automatically submitted and cancelled (ended)</strong> immediately.
                  </li>
                </ul>
              </div>

              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-1.5">
                <div className="font-bold text-amber-900">
                  Mobile Phone Exam Protection (Block Calls &amp; Notifications):
                </div>
                <p className="leading-relaxed">
                  For phone OS security, a website cannot turn off SIM calls automatically. Before starting on a phone:
                </p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>
                    Swipe down your phone bar and turn ON <strong>Do Not Disturb (DND)</strong> so calls &amp; message popups stay blocked.
                  </li>
                  <li>
                    For full kiosk lock: enable <strong>App Pinning / Screen Pinning</strong> (Android Settings → Security) or <strong>Guided Access</strong> (iPhone) on the browser.
                  </li>
                </ol>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => void handleActivateLockAndStart()}
                  className="flex-1 py-3 px-4 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Activate Green Screen Lock & Start
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="py-3 px-4 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Post-Submission View
  if (submittedAttempt) {
    if (submittedAttempt.autoCancelled) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
          <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between">
            <span className="font-display font-bold text-slate-900">MeritExam</span>
            <button
              type="button"
              onClick={onExit}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Return to Dashboard
            </button>
          </header>

          <div className="flex-1 flex items-center justify-center p-6">
            <div className="bg-white border-2 border-red-200 rounded-2xl p-8 max-w-lg w-full space-y-5">
              <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-700">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-red-800">
                  Paper Auto-Submitted & Cancelled
                </h1>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  You navigated away from the locked exam screen during{' '}
                  <span className="font-semibold text-slate-900">{test.title}</span>. Your current answers were automatically submitted and this paper has been terminated.
                </p>
              </div>

              {submittedAttempt.terminationReason && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                  <span>{submittedAttempt.terminationReason}</span>
                </div>
              )}

              <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 text-sm bg-slate-50">
                <div className="px-4 py-2.5 flex justify-between">
                  <span className="text-slate-500">Class & Subject</span>
                  <span className="font-medium text-slate-900">
                    {test.grade} · {test.subject}
                  </span>
                </div>
                {hasMcqs && (
                  <div className="px-4 py-2.5 flex justify-between">
                    <span className="text-slate-500">MCQs Recorded</span>
                    <span className="font-medium text-slate-900 tabular-nums">
                      {answeredCount} / {test.questions.length}
                    </span>
                  </div>
                )}
                <div className="px-4 py-2.5 flex justify-between">
                  <span className="text-slate-500">Final Status</span>
                  <span className="font-semibold text-red-700">Auto-Cancelled (Screen Lock Broken)</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onExit}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Back to Student Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Option 2: Admin Controlled / Delayed Result Release
    if (!submittedAttempt.resultReleased) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
          <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between">
            <span className="font-display font-bold text-slate-900">MeritExam</span>
            <button
              type="button"
              onClick={onExit}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Return to Dashboard
            </button>
          </header>

          <div className="flex-1 flex items-center justify-center p-6">
            <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-lg w-full">
              <div className="w-11 h-11 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mb-5">
                <Lock className="w-5 h-5" />
              </div>
              <h1 className="font-display text-2xl font-bold text-slate-900">
                Test Submitted — Result Held for Review
              </h1>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Your responses for <span className="font-semibold text-slate-900">{test.title}</span>{' '}
                have been recorded. The administrator has enabled Controlled Result Release, so
                scores and answer explanations will appear in your Results tab once published.
              </p>

              <div className="mt-6 border border-slate-200 rounded-lg divide-y divide-slate-200 text-sm bg-slate-50">
                <div className="px-4 py-2.5 flex justify-between">
                  <span className="text-slate-500">Class & Subject</span>
                  <span className="font-medium text-slate-900">
                    {test.grade} · {test.subject}
                  </span>
                </div>
                {hasMcqs && (
                  <div className="px-4 py-2.5 flex justify-between">
                    <span className="text-slate-500">MCQs Answered</span>
                    <span className="font-medium text-slate-900 tabular-nums">
                      {answeredCount} / {test.questions.length}
                    </span>
                  </div>
                )}
                {shortQuestions.length > 0 && (
                  <div className="px-4 py-2.5 flex justify-between">
                    <span className="text-slate-500">Short Questions Answered</span>
                    <span className="font-medium text-slate-900 tabular-nums">
                      {shortAnsweredCount} / {shortQuestions.length}
                    </span>
                  </div>
                )}
                {longQuestions.length > 0 && (
                  <div className="px-4 py-2.5 flex justify-between">
                    <span className="text-slate-500">Long Questions Answered</span>
                    <span className="font-medium text-slate-900 tabular-nums">
                      {longAnsweredCount} / {longQuestions.length}
                    </span>
                  </div>
                )}
                <div className="px-4 py-2.5 flex justify-between">
                  <span className="text-slate-500">Result Status</span>
                  <span className="font-semibold text-amber-700">Awaiting Admin Release</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onExit}
                className="mt-6 w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
              >
                Back to Student Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Option 1: Instant Mode OR Released Result Review
    const passed = submittedAttempt.percentage >= (systemSettings.passingPercentage || 50);

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onExit}
              className="p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="truncate">
              <h1 className="font-display font-semibold text-slate-900 truncate">
                {test.title} — Answer Review
              </h1>
              <p className="text-xs text-slate-500">
                {test.grade} · {test.subject}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onExit}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shrink-0 cursor-pointer"
          >
            Done
          </button>
        </header>

        <main className="max-w-4xl w-full mx-auto px-6 py-8 space-y-6">
          {/* Score Summary Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-slate-500">
                {hasMcqs ? 'Objective (MCQ) Marks' : 'Submission Status'}
              </p>
              <p className="font-display text-3xl font-bold text-slate-900 tabular-nums mt-1">
                {hasMcqs
                  ? `${submittedAttempt.obtainedMarks ?? submittedAttempt.score} / ${submittedAttempt.totalMarks ?? submittedAttempt.totalQuestions}`
                  : 'Submitted'}
              </p>
              {hasMcqs && (
                <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                  {submittedAttempt.score} of {submittedAttempt.totalQuestions} correct
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">MCQ Percentage</p>
              <p className="font-display text-3xl font-bold text-slate-900 tabular-nums mt-1">
                {hasMcqs ? `${submittedAttempt.percentage}%` : 'Subjective'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Outcome</p>
              <p
                className={`font-display text-lg font-bold mt-2 inline-flex items-center gap-1.5 ${
                  passed ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {passed ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                {hasMcqs ? (passed ? 'Passed' : 'Below Threshold') : 'Recorded'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Result Mode</p>
              <p className="text-sm font-semibold text-slate-800 mt-2">
                {submittedAttempt.deliveryModeUsed === 'instant'
                  ? 'Option 1: Instant Mode'
                  : 'Option 2: Admin Released'}
              </p>
            </div>
          </div>

          {/* Question-by-question MCQ key */}
          {hasMcqs && (
            <div className="space-y-4">
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-700">
                Section A — Multiple Choice Questions
              </h2>
              {test.questions.map((q, idx) => {
                const chosen = submittedAttempt.answers[idx] ?? -1;
                const isCorrect = chosen === q.correctIndex;
                return (
                  <div key={idx} className="bg-white border border-slate-200 rounded-xl p-6">
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <span className="text-xs font-semibold text-slate-500 tabular-nums">
                        Question {idx + 1} · {q.topicTag}
                      </span>
                      <span
                        className={`text-xs font-semibold inline-flex items-center gap-1 ${
                          isCorrect ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {isCorrect ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" /> Correct
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" /> {chosen === -1 ? 'Unanswered' : 'Incorrect'}
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-base font-medium text-slate-900 mb-4">{q.prompt}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                      {q.options.map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        const isRightOption = optIdx === q.correctIndex;
                        const isUserChoice = optIdx === chosen;
                        return (
                          <div
                            key={optIdx}
                            className={`px-3.5 py-2.5 rounded-lg border text-sm flex items-start gap-2 ${
                              isRightOption
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium'
                                : isUserChoice
                                  ? 'bg-red-50 border-red-300 text-red-900'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="font-mono font-semibold">{letter}.</span>
                            <span>{opt}</span>
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5">
                        <span className="font-semibold text-slate-800">Explanation: </span>
                        {q.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Short Questions Review */}
          {shortQuestions.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-teal-800">
                Question {hasMcqs ? 2 : 1} — Short Answer Questions
              </h2>
              {shortQuestions.map((sq, idx) => (
                <div key={idx} className="bg-white border border-teal-200 rounded-xl p-6 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold text-teal-800 tabular-nums">
                      Part {idx + 1} · {sq.topicTag}
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-600">
                      [{sq.marks} Marks]
                    </span>
                  </div>
                  <p className="text-base font-medium text-slate-900">{sq.prompt}</p>
                  {sq.orPrompt?.trim() && (
                    <div className="pt-1 border-t border-teal-100">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-teal-700">OR</span>
                      <p className="text-base font-medium text-slate-900 mt-0.5">{sq.orPrompt.trim()}</p>
                    </div>
                  )}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 block mb-1">
                      Your Answer
                    </span>
                    {(submittedAttempt.shortAnswers?.[idx] || '').trim() || 'No written answer submitted.'}
                  </div>
                  {(sq.suggestedAnswer || sq.orSuggestedAnswer) && (
                    <div className="bg-teal-50/70 border border-teal-200 rounded-lg px-3.5 py-2.5 text-xs text-teal-950 space-y-1.5">
                      {sq.suggestedAnswer && (
                        <div>
                          <span className="font-semibold block mb-0.5">Model Answer / Key Points:</span>
                          {sq.suggestedAnswer}
                        </div>
                      )}
                      {sq.orSuggestedAnswer?.trim() && (
                        <div className="pt-1 border-t border-teal-200/70">
                          <span className="font-semibold block mb-0.5">OR Alternative Model Answer:</span>
                          {sq.orSuggestedAnswer.trim()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Long Questions Review */}
          {longQuestions.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-indigo-800">
                Question {(hasMcqs ? 1 : 0) + (shortQuestions.length > 0 ? 1 : 0) + 1} — Long / Descriptive Questions
              </h2>
              {longQuestions.map((lq, idx) => (
                <div key={idx} className="bg-white border border-indigo-200 rounded-xl p-6 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold text-indigo-800 tabular-nums">
                      Part {idx + 1} · {lq.topicTag}
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-600">
                      [{lq.marks} Marks]
                    </span>
                  </div>
                  <p className="text-base font-medium text-slate-900">{lq.prompt}</p>
                  {lq.orPrompt?.trim() && (
                    <div className="pt-1 border-t border-indigo-100">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-700">OR</span>
                      <p className="text-base font-medium text-slate-900 mt-0.5">{lq.orPrompt.trim()}</p>
                    </div>
                  )}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 whitespace-pre-line">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 block mb-1">
                      Your Answer
                    </span>
                    {(submittedAttempt.longAnswers?.[idx] || '').trim() || 'No written answer submitted.'}
                  </div>
                  {(lq.suggestedAnswer || lq.orSuggestedAnswer) && (
                    <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg px-3.5 py-2.5 text-xs text-indigo-950 whitespace-pre-line space-y-1.5">
                      {lq.suggestedAnswer && (
                        <div>
                          <span className="font-semibold block mb-0.5">Solution Outline / Marking Points:</span>
                          {lq.suggestedAnswer}
                        </div>
                      )}
                      {lq.orSuggestedAnswer?.trim() && (
                        <div className="pt-1 border-t border-indigo-200/70">
                          <span className="font-semibold block mb-0.5">OR Alternative Solution Outline:</span>
                          {lq.orSuggestedAnswer.trim()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  const activeQ = hasMcqs ? test.questions[currentIdx] : null;

  return (
    <div
      className={`min-h-screen bg-slate-50 flex flex-col ${
        !previewMode ? 'fixed inset-0 z-50 overflow-y-auto border-t-4 border-emerald-500 select-none overscroll-none' : ''
      }`}
    >
      {/* Exam Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (previewMode) {
                onExit();
              } else {
                setConfirmExitCancel(true);
              }
            }}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Exit
          </button>
          <span className="text-slate-300">|</span>
          <div className="truncate">
            <h1 className="font-display font-semibold text-slate-900 truncate">
              {test.examLabel ? `${test.examLabel} — ` : ''}
              {test.title}
            </h1>
            <p className="text-xs text-slate-500 truncate">
              {test.schoolName ? `${test.schoolName} · ` : ''}
              {test.board === 'punjab_ptb' ? 'Punjab Board' : 'Federal NBF'} · {test.grade} · {test.subject}
              {test.paperDate ? ` · ${test.paperDate}` : ''} · {previewMode ? 'Faculty Preview' : 'Locked Live Assessment'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {!previewMode && (
            <span
              title="Screen is locked until paper submission. Leaving this screen will auto-submit and cancel the paper."
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 px-2.5 sm:px-3 py-1.5 rounded-lg shadow-xs whitespace-nowrap"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-200 animate-pulse" />
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {fullscreenLocked ? 'Screen Locked (Fullscreen)' : 'Green Screen Lock ON'}
              </span>
              <span className="sm:hidden">Locked</span>
            </span>
          )}
          {!previewMode && scheduledEndMs !== null && (
            <span className="hidden md:inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg tabular-nums">
              Closes: {new Date(scheduledEndMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {!previewMode && (
            <div
              className={`inline-flex items-center gap-1.5 text-sm font-mono font-semibold tabular-nums px-3 py-1.5 rounded-lg border ${
                secondsLeft < 60
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              {formattedTime}
            </div>
          )}

          <button
            type="button"
            onClick={() => setConfirmSubmit(true)}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Submit Test
          </button>
        </div>
      </header>

      {errorMsg && (
        <div className="max-w-6xl mx-auto w-full px-6 pt-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            {errorMsg}
          </div>
        </div>
      )}

      {/* Exam Workspace */}
      <main className="max-w-6xl w-full mx-auto px-6 py-8 flex-1 space-y-8">
        {hasMcqs && activeQ && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Active MCQ Stage */}
            <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-200">
                <div className="text-xs font-semibold text-slate-600 tabular-nums">
                  MCQ {currentIdx + 1} of {test.questions.length}
                  {activeQ.topicTag ? ` · ${activeQ.topicTag}` : ''}
                </div>

                <button
                  type="button"
                  onClick={toggleFlag}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    flagged[currentIdx]
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  {flagged[currentIdx] ? 'Flagged' : 'Flag for Review'}
                </button>
              </div>

              <h2 className="text-lg sm:text-xl font-medium text-slate-900 leading-relaxed mb-6">
                {activeQ.prompt}
              </h2>

              <div className="space-y-3 mb-8">
                {activeQ.options.map((opt, optIdx) => {
                  const letter = String.fromCharCode(65 + optIdx);
                  const selected = answers[currentIdx] === optIdx;
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => selectOption(optIdx)}
                      className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors flex items-start gap-3 cursor-pointer ${
                        selected
                          ? 'bg-blue-50 border-blue-600 text-slate-900'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-md font-mono text-xs font-semibold flex items-center justify-center shrink-0 border ${
                          selected
                            ? 'bg-blue-700 border-blue-700 text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-600'
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="text-sm sm:text-base pt-0.5">{opt}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-5 border-t border-slate-200">
                <button
                  type="button"
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Previous
                </button>

                {currentIdx < test.questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentIdx((i) => Math.min(test.questions.length - 1, i + 1))
                    }
                    className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmSubmit(true)}
                    className="px-5 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
                  >
                    Finish & Submit
                  </button>
                )}
              </div>
            </section>

            {/* Navigator Sidebar */}
            <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  MCQ Navigator
                </h3>
                <p className="text-xs text-slate-500 mt-1 tabular-nums">
                  {answeredCount} of {test.questions.length} answered
                </p>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {test.questions.map((_, idx) => {
                  const isCurrent = idx === currentIdx;
                  const isAnswered = answers[idx] !== -1;
                  const isFlagged = flagged[idx];
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentIdx(idx)}
                      className={`h-10 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer tabular-nums ${
                        isCurrent
                          ? 'border-blue-700 bg-blue-700 text-white'
                          : isFlagged
                            ? 'border-amber-400 bg-amber-50 text-amber-800'
                            : isAnswered
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1.5">
                <div>Blue: Current Question</div>
                <div>Green: Answered</div>
                <div>Amber: Flagged for Review</div>
              </div>
            </aside>
          </div>
        )}

        {/* Section B: Short Questions */}
        {shortQuestions.length > 0 && (
          <section className="bg-white border border-teal-200 rounded-xl p-6 sm:p-8 space-y-5">
            <div className="pb-3 border-b border-slate-200 space-y-1">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-display text-lg font-bold text-teal-900">
                  Question {hasMcqs ? 2 : 1} — Short Answer Questions ({shortQuestions.length})
                </h2>
                <span className="text-xs font-mono text-slate-500">
                  {shortAnsweredCount} / {shortQuestions.length} answered
                </span>
              </div>
              {test.shortChoiceNote && (
                <p className="text-xs font-semibold text-teal-800">{test.shortChoiceNote}</p>
              )}
            </div>

            <div className="space-y-5">
              {shortQuestions.map((sq, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm sm:text-base font-medium text-slate-900">
                        <span className="font-mono font-semibold mr-2">{idx + 1}.</span>
                        {sq.prompt}
                      </p>
                      {sq.orPrompt?.trim() && (
                        <>
                          <div className="pl-6 text-[11px] font-bold uppercase tracking-widest text-teal-700">
                            — OR —
                          </div>
                          <p className="text-sm sm:text-base font-medium text-slate-900 pl-6">
                            {sq.orPrompt.trim()}
                          </p>
                        </>
                      )}
                    </div>
                    <span className="text-xs font-mono font-semibold text-teal-700 shrink-0">
                      [{sq.marks} Marks]
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={shortAnswers[idx] ?? ''}
                    onChange={(e) =>
                      setShortAnswers((prev) =>
                        prev.map((val, i) => (i === idx ? e.target.value : val)),
                      )
                    }
                    placeholder={
                      sq.orPrompt?.trim()
                        ? 'Write your concise short answer for either choice...'
                        : 'Write your concise short answer here...'
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section C: Long Questions */}
        {longQuestions.length > 0 && (
          <section className="bg-white border border-indigo-200 rounded-xl p-6 sm:p-8 space-y-5">
            <div className="pb-3 border-b border-slate-200 space-y-1">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-display text-lg font-bold text-indigo-900">
                  Question {(hasMcqs ? 1 : 0) + (shortQuestions.length > 0 ? 1 : 0) + 1} — Long / Descriptive Questions ({longQuestions.length})
                </h2>
                <span className="text-xs font-mono text-slate-500">
                  {longAnsweredCount} / {longQuestions.length} answered
                </span>
              </div>
              {test.longChoiceNote && (
                <p className="text-xs font-semibold text-indigo-800">{test.longChoiceNote}</p>
              )}
            </div>

            <div className="space-y-6">
              {longQuestions.map((lq, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm sm:text-base font-medium text-slate-900">
                        <span className="font-mono font-semibold mr-2">{idx + 1}.</span>
                        {lq.prompt}
                      </p>
                      {lq.orPrompt?.trim() && (
                        <>
                          <div className="pl-6 text-[11px] font-bold uppercase tracking-widest text-indigo-700">
                            — OR —
                          </div>
                          <p className="text-sm sm:text-base font-medium text-slate-900 pl-6">
                            {lq.orPrompt.trim()}
                          </p>
                        </>
                      )}
                    </div>
                    <span className="text-xs font-mono font-semibold text-indigo-700 shrink-0">
                      [{lq.marks} Marks]
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={longAnswers[idx] ?? ''}
                    onChange={(e) =>
                      setLongAnswers((prev) =>
                        prev.map((val, i) => (i === idx ? e.target.value : val)),
                      )
                    }
                    placeholder={
                      lq.orPrompt?.trim()
                        ? 'Write your detailed answer for either choice...'
                        : 'Write your detailed answer here...'
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {hasSubjective && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setConfirmSubmit(true)}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
            >
              Finish & Submit Paper
            </button>
          </div>
        )}
      </main>

      {/* Confirm Submit Modal */}
      {confirmSubmit && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full shadow-lg">
            <h3 className="font-display text-lg font-bold text-slate-900">
              Submit Assessment Paper?
            </h3>
            <p className="text-sm text-slate-600 mt-2">
              {hasMcqs && (
                <>
                  You have answered{' '}
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {answeredCount} of {test.questions.length}
                  </span>{' '}
                  MCQs.{' '}
                </>
              )}
              {shortQuestions.length > 0 && (
                <>
                  Short Questions:{' '}
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {shortAnsweredCount} / {shortQuestions.length}
                  </span>
                  .{' '}
                </>
              )}
              {longQuestions.length > 0 && (
                <>
                  Long Questions:{' '}
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {longAnsweredCount} / {longQuestions.length}
                  </span>
                  .{' '}
                </>
              )}
              Once submitted, responses cannot be edited and Screen Lock will unlock.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmSubmit(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Continue Test
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void performSubmit()}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Confirm Submission'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Exit / Auto-Cancel Modal */}
      {confirmExitCancel && !previewMode && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-200 rounded-xl p-6 max-w-md w-full shadow-lg space-y-4">
            <div className="flex items-center gap-2.5 text-red-700">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-display text-lg font-bold text-slate-900">
                Leave Locked Paper?
              </h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Screen Lock is active. Exiting before finishing will{' '}
              <strong className="text-red-700">automatically submit and cancel</strong> your paper immediately.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmExitCancel(false)}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
              >
                Stay in Exam
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() =>
                  triggerAutoCancelViolation(
                    'Screen Lock Violation: Exited locked exam before normal submission.',
                  )
                }
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {submitting ? 'Cancelling...' : 'Auto-Submit & Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
