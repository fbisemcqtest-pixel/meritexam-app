import React, { useState } from 'react';
import { Printer, X } from 'lucide-react';
import {
  BOARD_PRINT_LABELS,
  EXAM_TYPE_PRESETS,
  ExamBoard,
  GradeLevel,
  GRADE_LABELS,
  MCQQuestion,
  SubjectName,
  SubjectiveQuestion,
} from '../types';

interface PrintablePaperModalProps {
  title: string;
  board?: ExamBoard;
  schoolName?: string;
  examLabel?: string;
  paperDate?: string;
  grade: GradeLevel;
  subject: SubjectName;
  topic?: string;
  durationMinutes: number;
  marksPerQuestion?: number;
  questions: MCQQuestion[];
  shortQuestions?: SubjectiveQuestion[];
  longQuestions?: SubjectiveQuestion[];
  onClose: () => void;
}

export function PrintablePaperModal({
  title,
  board = 'fbise_nbf',
  schoolName = '',
  examLabel = '',
  paperDate = '',
  grade,
  subject,
  topic,
  durationMinutes,
  marksPerQuestion = 1,
  questions,
  shortQuestions = [],
  longQuestions = [],
  onClose,
}: PrintablePaperModalProps) {
  const [includeAnswerKey, setIncludeAnswerKey] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editSchoolName, setEditSchoolName] = useState(schoolName);
  const [editExamLabel, setEditExamLabel] = useState(examLabel);
  const [editPaperDate, setEditPaperDate] = useState(paperDate);

  const mcqTotalMarks = Math.round(questions.length * marksPerQuestion * 100) / 100;
  const shortTotalMarks = Math.round(
    shortQuestions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0) * 100,
  ) / 100;
  const longTotalMarks = Math.round(
    longQuestions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0) * 100,
  ) / 100;
  const totalMarks = Math.round((mcqTotalMarks + shortTotalMarks + longTotalMarks) * 100) / 100;

  const formattedDate = (() => {
    const trimmed = editPaperDate.trim();
    if (!trimmed) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const parsed = new Date(`${trimmed}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      }
    }
    return trimmed;
  })();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex flex-col overflow-y-auto print-only-sheet">
      {/* Toolbar (hidden in print) */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="font-display font-semibold text-slate-900">
              Paper Print Preview
            </h2>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAnswerKey}
                onChange={(e) => setIncludeAnswerKey(e.target.checked)}
                className="w-4 h-4 accent-blue-700"
              />
              Include Answer Key & Marking Scheme
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg inline-flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print / Save as PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              aria-label="Close print preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick-edit header bar (hidden in print) */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
                School / Academy Name
              </label>
              <input
                type="text"
                maxLength={140}
                value={editSchoolName}
                onChange={(e) => setEditSchoolName(e.target.value)}
                placeholder="School / Academy Name"
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
                Paper / Exam Type (Editable)
              </label>
              <input
                type="text"
                maxLength={80}
                list="print-exam-presets"
                value={editExamLabel}
                onChange={(e) => setEditExamLabel(e.target.value)}
                placeholder="Type Term, Send-Up, Monthly Test..."
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <datalist id="print-exam-presets">
                {EXAM_TYPE_PRESETS.map((preset) => (
                  <option key={preset} value={preset} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
                Paper Title (Editable)
              </label>
              <input
                type="text"
                maxLength={160}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Paper Title"
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
                Paper Date
              </label>
              <input
                type="date"
                value={editPaperDate}
                onChange={(e) => setEditPaperDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-500">Quick Exam Type:</span>
            {['First Term', 'Second Term', 'Send-Up', 'Pre-Board', 'Monthly Assessment'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setEditExamLabel(tag)}
                className={`px-2 py-0.5 text-[11px] rounded border cursor-pointer ${
                  editExamLabel === tag
                    ? 'bg-blue-700 border-blue-700 text-white font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tag}
              </button>
            ))}
            {editExamLabel && (
              <button
                type="button"
                onClick={() => setEditExamLabel('')}
                className="px-2 py-0.5 text-[11px] text-slate-500 hover:text-red-600 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Printable Paper Sheet */}
      <div className="max-w-4xl w-full mx-auto my-6 bg-white border border-slate-200 p-6 sm:p-10 print:border-none print:my-0 print:p-2 space-y-6 print:space-y-5">
        <div className="border-b-2 border-slate-900 pb-4">
          {(editSchoolName.trim() || editExamLabel.trim()) && (
            <div className="text-center mb-3 pb-2.5 border-b border-slate-200">
              {editSchoolName.trim() && (
                <div className="font-display text-xl sm:text-2xl font-bold uppercase tracking-wide text-slate-950">
                  {editSchoolName.trim()}
                </div>
              )}
              {editExamLabel.trim() && (
                <div className="text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-800 mt-0.5">
                  {editExamLabel.trim()}
                </div>
              )}
            </div>
          )}

          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            {BOARD_PRINT_LABELS[board]}
          </p>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {editTitle.trim() || title}
            </h1>
            <span className="text-xs font-mono text-slate-700 font-semibold tabular-nums">
              Total Marks: {totalMarks} · Time: {durationMinutes} Minutes
              {formattedDate ? ` · Date: ${formattedDate}` : ''}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
            <span>Class: <strong>{GRADE_LABELS[grade]}</strong></span>
            <span>·</span>
            <span>Subject: <strong>{subject}</strong></span>
            {topic && (
              <>
                <span>·</span>
                <span>Syllabus: <strong>{topic}</strong></span>
              </>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-6 text-xs text-slate-600 pt-3 border-t border-slate-200">
            <div>Student Name: ______________________________________</div>
            <div>
              Roll No.: _____________________ {formattedDate ? `Date: ${formattedDate}` : 'Date: ____________'}
            </div>
          </div>
        </div>

        {/* Section A: Objective MCQs */}
        {questions.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-slate-300 pb-2">
              <h2 className="font-display text-base font-bold uppercase tracking-wide text-slate-900">
                Section A — Multiple Choice Questions (Objective)
              </h2>
              <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums">
                ({questions.length} × {marksPerQuestion} = {mcqTotalMarks} Marks)
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-700">
              Note: Choose the single best option (A, B, C, or D) for each multiple-choice question.
            </p>
            <ol className="space-y-3 print:space-y-2.5">
              {questions.map((q, idx) => (
                <li key={idx} className="break-inside-avoid">
                  <p className="text-sm font-medium text-slate-900 leading-snug mb-1.5">
                    <span className="font-mono font-semibold mr-2 tabular-nums">Q{idx + 1}.</span>
                    {q.prompt}
                  </p>
                  <div className="grid grid-cols-2 print:grid-cols-2 gap-x-5 gap-y-1 pl-6 text-sm text-slate-800">
                    {q.options.map((opt, optIdx) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      return (
                        <div key={optIdx} className="leading-snug">
                          <span className="font-mono font-semibold mr-1.5">({letter})</span>
                          {opt}
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Section B: Short Answer Questions */}
        {shortQuestions.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-slate-300 pb-2">
              <h2 className="font-display text-base font-bold uppercase tracking-wide text-slate-900">
                {questions.length > 0 ? 'Section B' : 'Section A'} — Short Answer Questions
              </h2>
              <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums">
                ({shortQuestions.length} Questions · {shortTotalMarks} Marks)
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-700">
              Note: Write concise, to-the-point answers for all short questions.
            </p>
            <ol className="space-y-4">
              {shortQuestions.map((sq, idx) => (
                <li key={idx} className="break-inside-avoid flex items-start justify-between gap-4">
                  <p className="text-sm font-medium text-slate-900 leading-relaxed">
                    <span className="font-mono font-semibold mr-2 tabular-nums">Q{idx + 1}.</span>
                    {sq.prompt}
                  </p>
                  <span className="text-xs font-mono font-semibold text-slate-600 shrink-0 tabular-nums">
                    [{sq.marks} Marks]
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Section C: Long / Descriptive Questions */}
        {longQuestions.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-slate-300 pb-2">
              <h2 className="font-display text-base font-bold uppercase tracking-wide text-slate-900">
                {questions.length > 0 && shortQuestions.length > 0
                  ? 'Section C'
                  : questions.length > 0 || shortQuestions.length > 0
                    ? 'Section B'
                    : 'Section A'}{' '}
                — Long / Descriptive Questions
              </h2>
              <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums">
                ({longQuestions.length} {longQuestions.length === 1 ? 'Question' : 'Questions'} · {longTotalMarks} Marks)
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-700">
              Note: Attempt detailed answers with diagrams, equations, or headings where applicable.
            </p>
            <ol className="space-y-5">
              {longQuestions.map((lq, idx) => (
                <li key={idx} className="break-inside-avoid flex items-start justify-between gap-4">
                  <p className="text-sm font-medium text-slate-900 leading-relaxed">
                    <span className="font-mono font-semibold mr-2 tabular-nums">Q{idx + 1}.</span>
                    {lq.prompt}
                  </p>
                  <span className="text-xs font-mono font-semibold text-slate-600 shrink-0 tabular-nums">
                    [{lq.marks} Marks]
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {includeAnswerKey && (
          <div className="mt-10 pt-6 border-t-2 border-slate-900 break-before-page space-y-6">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Answer Key & Marking Scheme — {title}
            </h2>

            {questions.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  MCQ Answer Key
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                  {questions.map((q, idx) => (
                    <div key={idx} className="p-2 border border-slate-200 rounded">
                      Q{idx + 1}: <strong>{String.fromCharCode(65 + q.correctIndex)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {shortQuestions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Short Questions — Key Points
                </h3>
                {shortQuestions.map((sq, idx) => (
                  <div key={idx} className="text-xs text-slate-800 border-l-2 border-slate-300 pl-3 py-0.5 break-inside-avoid">
                    <p className="font-semibold text-slate-900">
                      Q{idx + 1} ({sq.marks} Marks): {sq.prompt}
                    </p>
                    <p className="text-slate-600 mt-1">{sq.suggestedAnswer}</p>
                  </div>
                ))}
              </div>
            )}

            {longQuestions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Long Questions — Solution Outline
                </h3>
                {longQuestions.map((lq, idx) => (
                  <div key={idx} className="text-xs text-slate-800 border-l-2 border-slate-300 pl-3 py-0.5 break-inside-avoid">
                    <p className="font-semibold text-slate-900">
                      Q{idx + 1} ({lq.marks} Marks): {lq.prompt}
                    </p>
                    <p className="text-slate-600 mt-1 whitespace-pre-line">{lq.suggestedAnswer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
