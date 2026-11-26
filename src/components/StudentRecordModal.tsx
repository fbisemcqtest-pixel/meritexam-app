import React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Clock, Lock, ShieldAlert, UserCheck, X } from 'lucide-react';
import { TestAttempt } from '../types';
import { StudentPerformanceReport } from '../utils/studentRecord';

interface StudentRecordModalProps {
  report: StudentPerformanceReport;
  passingPercentage: number;
  globalAnswerKeyEnabled?: boolean;
  onReleaseAttempt?: (attempt: TestAttempt) => Promise<void> | void;
  onAllowRetake?: (attempt: TestAttempt) => Promise<void> | void;
  onToggleAnswerKey?: (attempt: TestAttempt, allow: boolean) => Promise<void> | void;
  onClose: () => void;
}

export function StudentRecordModal({
  report,
  passingPercentage,
  globalAnswerKeyEnabled = false,
  onReleaseAttempt,
  onAllowRetake,
  onToggleAnswerKey,
  onClose,
}: StudentRecordModalProps) {
  const isPassing =
    report.totalPossibleMarks > 0 && report.overallPercentage >= passingPercentage;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Student Record for ${report.studentName}`}
        className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-teal-500 to-indigo-600 shrink-0" />

        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 shrink-0 bg-slate-50/70">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0 mt-0.5">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                {report.studentName}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Class <strong className="text-slate-900">{report.studentGrade}</strong> · Roll ID:{' '}
                <span className="font-mono font-semibold text-slate-800">
                  {report.studentIdentifier}
                </span>
                {report.studentEmail ? ` · ${report.studentEmail}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
            aria-label="Close student record"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* 5 Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Total Tests
              </p>
              <p className="font-display text-2xl font-bold text-slate-900 tabular-nums mt-1">
                {report.totalTestsCount}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Recorded for class</p>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5">
              <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">
                Tests Given
              </p>
              <p className="font-display text-2xl font-bold text-emerald-700 tabular-nums mt-1">
                {report.givenCount}
              </p>
              <p className="text-[11px] text-emerald-700/90 mt-0.5 tabular-nums">
                {report.cancelledCount > 0
                  ? `+${report.cancelledCount} Cancelled`
                  : 'Submitted'}
              </p>
            </div>

            <div className="bg-red-50/70 border border-red-200 rounded-xl p-3.5">
              <p className="text-[11px] font-semibold text-red-800 uppercase tracking-wide">
                Not Given (Missed)
              </p>
              <p className="font-display text-2xl font-bold text-red-700 tabular-nums mt-1">
                {report.missedCount}
              </p>
              <p className="text-[11px] text-red-700/90 mt-0.5">Marked Absent (0)</p>
            </div>

            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5">
              <p className="text-[11px] font-semibold text-blue-800 uppercase tracking-wide">
                Total Marks
              </p>
              <p className="font-display text-xl sm:text-2xl font-bold text-blue-900 tabular-nums mt-1">
                {report.totalObtainedMarks} / {report.totalPossibleMarks}
              </p>
              <p className="text-[11px] text-blue-700 mt-0.5 tabular-nums">
                {report.missedCount > 0
                  ? `Attempted Only: ${report.givenObtainedMarks}/${report.givenPossibleMarks}`
                  : 'All MCQ Assessments'}
              </p>
            </div>

            <div
              className={`border rounded-xl p-3.5 col-span-2 sm:col-span-1 ${
                report.totalPossibleMarks === 0
                  ? 'bg-slate-50 border-slate-200'
                  : isPassing
                    ? 'bg-teal-50/70 border-teal-200'
                    : 'bg-amber-50/70 border-amber-200'
              }`}
            >
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                Overall %
              </p>
              <p
                className={`font-display text-2xl font-bold tabular-nums mt-1 ${
                  report.totalPossibleMarks === 0
                    ? 'text-slate-700'
                    : isPassing
                      ? 'text-teal-800'
                      : 'text-amber-800'
                }`}
              >
                {report.overallPercentage}%
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5 tabular-nums">
                {report.missedCount > 0
                  ? `Attempted Avg: ${report.givenPercentage}%`
                  : report.heldCount > 0
                    ? `${report.heldCount} Held for Review`
                    : `Pass Threshold: ${passingPercentage}%`}
              </p>
            </div>
          </div>

          {/* Detailed Per-Test Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-slate-900">
                Complete MCQ Test History ({report.rows.length})
              </h3>
              <span className="text-xs text-slate-500">
                Every submitted, cancelled, and missed assessment with marks &amp; question breakdown
              </span>
            </div>

            {report.rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No tests recorded for this student yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Test / Assessment</th>
                      <th className="py-2.5 px-4">Subject</th>
                      <th className="py-2.5 px-4">Attendance</th>
                      <th className="py-2.5 px-4">Marks (%)</th>
                      <th className="py-2.5 px-4">MCQ Summary</th>
                      <th className="py-2.5 px-4">Status</th>
                      {(onReleaseAttempt || onAllowRetake || onToggleAnswerKey) && (
                        <th className="py-2.5 px-4 text-right">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {report.rows.map((row) => (
                      <tr
                        key={row.key}
                        className={
                          row.kind === 'absent'
                            ? 'bg-red-50/35 hover:bg-red-50/60'
                            : 'hover:bg-slate-50'
                        }
                      >
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-slate-900">{row.title}</div>
                          {row.sortMs > 0 && (
                            <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                              {row.kind === 'absent' ? 'Closed: ' : 'Submitted: '}
                              {new Date(row.sortMs).toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 text-xs whitespace-nowrap">
                          {row.grade} · {row.subject}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {row.kind === 'absent' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold bg-red-100 text-red-800 border border-red-200 rounded">
                              <ShieldAlert className="w-3 h-3" />
                              Absent (Missed)
                            </span>
                          ) : row.kind === 'cancelled' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200 rounded">
                              <ShieldAlert className="w-3 h-3" />
                              Cancelled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 rounded">
                              <CheckCircle2 className="w-3 h-3" />
                              Present
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-2.5 px-4 tabular-nums font-semibold whitespace-nowrap ${
                            row.kind === 'absent' ? 'text-red-700' : 'text-slate-900'
                          }`}
                        >
                          {row.obtainedMarks} / {row.totalMarks}{' '}
                          <span className="text-xs font-bold text-slate-600">
                            ({row.percentage}%)
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-xs tabular-nums text-slate-600 whitespace-nowrap">
                          {row.breakdown.total === 0 ? (
                            <span className="text-slate-500">Subjective</span>
                          ) : (
                            <>
                              <div>
                                Attempted:{' '}
                                <strong className="text-slate-900">
                                  {row.breakdown.attempted} / {row.breakdown.total}
                                </strong>
                              </div>
                              <div className="text-[11px] mt-0.5">
                                <span className="text-emerald-700 font-semibold">
                                  {row.breakdown.correct} Correct
                                </span>{' '}
                                ·{' '}
                                <span className="text-red-700 font-semibold">
                                  {row.breakdown.wrong} Wrong
                                </span>{' '}
                                ·{' '}
                                <span className="text-amber-700 font-semibold">
                                  {row.breakdown.skipped} Left
                                </span>
                              </div>
                            </>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-xs whitespace-nowrap">
                          {row.kind === 'absent' ? (
                            <span className="text-red-700 font-semibold inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Time Expired
                            </span>
                          ) : row.resultReleased ? (
                            <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Released
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> Held
                            </span>
                          )}
                        </td>
                        {(onReleaseAttempt || onAllowRetake || onToggleAnswerKey) && (
                          <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-2">
                            {row.attempt && !row.resultReleased && onReleaseAttempt && (
                              <button
                                type="button"
                                onClick={() => void onReleaseAttempt(row.attempt!)}
                                className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded cursor-pointer"
                              >
                                Release
                              </button>
                            )}
                            {row.attempt &&
                              !row.autoCancelled &&
                              row.resultReleased &&
                              onToggleAnswerKey && (
                                <button
                                  type="button"
                                  disabled={globalAnswerKeyEnabled}
                                  title={
                                    globalAnswerKeyEnabled
                                      ? 'Global Answer Key Review is currently enabled for all students'
                                      : undefined
                                  }
                                  onClick={() =>
                                    void onToggleAnswerKey(
                                      row.attempt!,
                                      !row.attempt!.answerKeyReleased,
                                    )
                                  }
                                  className={`px-2.5 py-1 text-xs font-semibold rounded border cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                                    globalAnswerKeyEnabled || row.attempt.answerKeyReleased
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  {globalAnswerKeyEnabled
                                    ? 'Key Open (Global)'
                                    : row.attempt.answerKeyReleased
                                      ? 'Lock Key'
                                      : 'Allow Key'}
                                </button>
                              )}
                            {row.attempt && row.autoCancelled && onAllowRetake && (
                              <button
                                type="button"
                                onClick={() => void onAllowRetake(row.attempt!)}
                                className="px-2.5 py-1 text-xs font-semibold text-orange-800 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded cursor-pointer"
                              >
                                Allow Retake
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
