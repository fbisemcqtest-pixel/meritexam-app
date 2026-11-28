import React, { useState } from 'react';
import { CalendarClock, Check, CopyPlus, X } from 'lucide-react';
import { GRADE_LABELS, GradeLevel, MCQTest } from '../types';
import { getActiveEditionClass, getEditionAllowedGrades } from '../config/appEdition';
import { useAuth } from '../context/AuthContext';
import {
  publishMCQTest,
  recordTeacherActivity,
  updateTestScheduleAndAccess,
} from '../services/mcqService';

interface ScheduleAccessModalProps {
  test: MCQTest;
  initialActive?: boolean;
  expiredNotice?: boolean;
  currentUser?: {
    uid: string;
    name: string;
    role: 'admin' | 'teacher';
  };
  onClose: () => void;
}

function isoToLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleAccessModal({
  test,
  initialActive,
  expiredNotice = false,
  currentUser,
  onClose,
}: ScheduleAccessModalProps) {
  const { firebaseUser, userProfile } = useAuth();
  const [isActive, setIsActive] = useState(initialActive ?? test.isActive);
  const [allowedGrades, setAllowedGrades] = useState<GradeLevel[]>(
    test.allowedGrades && test.allowedGrades.length > 0 ? test.allowedGrades : [test.grade],
  );
  const [startAt, setStartAt] = useState(() =>
    expiredNotice ? '' : isoToLocalInput(test.scheduledReleaseAt),
  );
  const [endAt, setEndAt] = useState(() =>
    expiredNotice ? '' : isoToLocalInput(test.scheduledEndAt),
  );
  const [createFreshReTest, setCreateFreshReTest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function applyEndPreset(minutesToAdd: number) {
    const base = startAt ? new Date(startAt) : new Date();
    const baseMs = Number.isNaN(base.getTime()) ? Date.now() : base.getTime();
    const next = new Date(baseMs + minutesToAdd * 60_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    setEndAt(
      `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`,
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    let startIso = '';
    if (startAt.trim()) {
      const parsedStart = new Date(startAt);
      if (Number.isNaN(parsedStart.getTime())) {
        setErrorMsg('Please select a valid Start Date & Time.');
        return;
      }
      startIso = parsedStart.toISOString();
    }

    let endIso = '';
    if (endAt.trim()) {
      const parsedEnd = new Date(endAt);
      if (Number.isNaN(parsedEnd.getTime())) {
        setErrorMsg('Please select a valid Closing / End Date & Time.');
        return;
      }
      if (startIso && parsedEnd.getTime() <= new Date(startIso).getTime()) {
        setErrorMsg('Closing / End Date & Time must be after Start Date & Time.');
        return;
      }
      if (isActive && parsedEnd.getTime() <= Date.now()) {
        setErrorMsg('Closing / End Date & Time cannot already be in the past while Active is checked.');
        return;
      }
      endIso = parsedEnd.toISOString();
    }

    const nextAllowedGrades = allowedGrades.length > 0 ? allowedGrades : [test.grade];

    setSaving(true);
    try {
      if (createFreshReTest && currentUser) {
        const created = await publishMCQTest({
          title: test.title.includes('(Re-Test)') ? test.title : `${test.title} (Re-Test)`,
          board: test.board,
          schoolName: test.schoolName,
          examLabel: test.examLabel,
          paperDate: test.paperDate,
          grade: test.grade,
          subject: test.subject,
          topic: test.topic,
          difficulty: test.difficulty,
          durationMinutes: test.durationMinutes,
          marksPerQuestion: test.marksPerQuestion,
          questions: test.questions,
          shortQuestions: test.shortQuestions,
          longQuestions: test.longQuestions,
          shortChoiceNote: test.shortChoiceNote,
          longChoiceNote: test.longChoiceNote,
          sectionATimeMinutes: test.sectionATimeMinutes,
          patternLabel: test.patternLabel,
          deliveryMode: currentUser.role === 'admin' ? test.deliveryMode : 'inherit',
          isActive,
          scheduledReleaseAt: startIso,
          scheduledEndAt: endIso,
          allowedGrades: nextAllowedGrades,
          createdBy: currentUser.uid,
          createdByName: currentUser.name,
          createdByRole: currentUser.role,
        });
        const teacherEmail = firebaseUser?.email || userProfile?.email || '';
        if (currentUser.role === 'teacher' && teacherEmail) {
          void recordTeacherActivity({
            teacherId: currentUser.uid,
            teacherName: currentUser.name,
            teacherEmail,
            action: isActive ? 'paper_published' : 'paper_saved_draft',
            paperTitle: created.title,
            grade: test.grade,
            subject: test.subject,
            board: test.board,
            mcqCount: test.questionCount ?? test.questions?.length ?? 0,
            shortCount: test.shortQuestions?.length ?? test.shortQuestionCount ?? 0,
            longCount: test.longQuestions?.length ?? test.longQuestionCount ?? 0,
            testId: created.id,
          }).catch(() => {});
        }
      } else {
        await updateTestScheduleAndAccess(test.id, {
          isActive,
          scheduledReleaseAt: startIso,
          scheduledEndAt: endIso,
          allowedGrades: nextAllowedGrades,
          fallbackGrade: test.grade,
        });
        const teacherEmail = firebaseUser?.email || userProfile?.email || '';
        if (currentUser?.role === 'teacher' && !test.isActive && isActive && teacherEmail) {
          void recordTeacherActivity({
            teacherId: currentUser.uid,
            teacherName: currentUser.name,
            teacherEmail,
            action: 'paper_published',
            paperTitle: test.title,
            grade: test.grade,
            subject: test.subject,
            board: test.board,
            mcqCount: test.questionCount ?? test.questions?.length ?? 0,
            shortCount: test.shortQuestions?.length ?? test.shortQuestionCount ?? 0,
            longCount: test.longQuestions?.length ?? test.longQuestionCount ?? 0,
            testId: test.id,
          }).catch(() => {});
        }
      }
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update schedule & permissions.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-xl overflow-hidden max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarClock className="w-5 h-5 text-blue-700 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold text-slate-900 truncate">
                Set Paper Time &amp; Class Access
              </h3>
              <p className="text-xs text-slate-500 truncate">{test.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {expiredNotice && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              This paper&apos;s previous time window has already ended. Set the new Start Date &amp;
              Time and Closing Time below to take it again.
            </div>
          )}

          <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-blue-700"
            />
            <div>
              <div className="text-xs font-bold text-slate-900">
                Active &amp; Permitted for Student Portal
              </div>
              <div className="text-[11px] text-slate-500">
                Uncheck to pause/hide this paper from all students while keeping it for printing.
              </div>
            </div>
          </label>

          {currentUser && (
            <label className="flex items-start gap-2.5 p-3 rounded-lg bg-indigo-50/70 border border-indigo-200 cursor-pointer">
              <input
                type="checkbox"
                checked={createFreshReTest}
                onChange={(e) => setCreateFreshReTest(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-indigo-700"
              />
              <div>
                <div className="text-xs font-bold text-indigo-950 inline-flex items-center gap-1.5">
                  <CopyPlus className="w-3.5 h-3.5 text-indigo-700" />
                  Re-Conduct as Fresh Re-Test (Allow Previous Students Again)
                </div>
                <div className="text-[11px] text-indigo-800 mt-0.5">
                  Check this if students already submitted this paper earlier and you want them to
                  attempt it again while keeping previous results intact.
                </div>
              </div>
            </label>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Permitted Classes (Only selected classes see this paper)
            </label>
            <div className="flex flex-wrap gap-2">
              {getEditionAllowedGrades(getActiveEditionClass()).map((g) => {
                const selected = allowedGrades.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setAllowedGrades((prev) => {
                        if (prev.includes(g)) {
                          return prev.length > 1 ? prev.filter((item) => item !== g) : prev;
                        }
                        return [...prev, g];
                      });
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md border inline-flex items-center gap-1 cursor-pointer transition-colors ${
                      selected
                        ? 'bg-blue-700 border-blue-700 text-white'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {selected && <Check className="w-3 h-3" />}
                    {GRADE_LABELS[g]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Start Date &amp; Time</label>
                {startAt && (
                  <button
                    type="button"
                    onClick={() => setStartAt('')}
                    className="text-[11px] font-medium text-blue-700 hover:underline cursor-pointer"
                  >
                    Start Now
                  </button>
                )}
              </div>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Closing Time (Auto-Hide)
                </label>
                {endAt && (
                  <button
                    type="button"
                    onClick={() => setEndAt('')}
                    className="text-[11px] font-medium text-blue-700 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {[
                  { label: `+${test.durationMinutes}m`, mins: test.durationMinutes },
                  { label: '+1 Hr', mins: 60 },
                  { label: '+3 Hrs', mins: 180 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyEndPreset(preset.mins)}
                    className="px-2 py-0.5 text-[10.5px] font-semibold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200 rounded cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {endAt
                  ? `Auto-hides from students after ${new Date(endAt).toLocaleString()}.`
                  : 'If left blank: scheduled papers auto-close after Start + Duration, and immediate papers auto-close after 12 hours.'}
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {errorMsg}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg cursor-pointer"
            >
              {saving
                ? 'Saving...'
                : createFreshReTest
                  ? 'Publish Fresh Re-Test Schedule'
                  : 'Save Schedule & Access'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
