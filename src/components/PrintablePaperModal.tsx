import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileDown, FileText, Loader2, Printer, X } from 'lucide-react';
import { exportPaperToPdf, exportPaperToWord } from '../utils/paperExport';
import {
  estimateSectionATimeMinutes,
  formatDurationHoursMin,
  formatRomanPart,
  getBoardLevelCode,
} from '../data/fbisePatterns';
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
  sectionATimeMinutes?: number;
  patternLabel?: string;
  marksPerQuestion?: number;
  questions: MCQQuestion[];
  shortQuestions?: SubjectiveQuestion[];
  longQuestions?: SubjectiveQuestion[];
  shortChoiceNote?: string;
  longChoiceNote?: string;
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
  sectionATimeMinutes,
  patternLabel = '',
  marksPerQuestion = 1,
  questions,
  shortQuestions = [],
  longQuestions = [],
  shortChoiceNote = '',
  longChoiceNote = '',
  onClose,
}: PrintablePaperModalProps) {
  const isFbiseInitial = board === 'fbise_nbf';
  const [includeAnswerKey, setIncludeAnswerKey] = useState(false);
  const [compactLayout, setCompactLayout] = useState(true);
  const [paperSize, setPaperSize] = useState<'a4' | 'legal'>('a4');
  const [sideBySideOr, setSideBySideOr] = useState(true);
  const [twoColumnMcqs, setTwoColumnMcqs] = useState(!isFbiseInitial && questions.length >= 10);
  const [showOmrGrid, setShowOmrGrid] = useState(true);
  const [paperStyle, setPaperStyle] = useState<'fbise_official' | 'standard'>(
    isFbiseInitial ? 'fbise_official' : 'standard',
  );
  const [separateSectionA, setSeparateSectionA] = useState(
    isFbiseInitial && questions.length > 0 && (shortQuestions.length > 0 || longQuestions.length > 0),
  );
  const [editTitle, setEditTitle] = useState(title);
  const [editSchoolName, setEditSchoolName] = useState(schoolName);
  const [editExamLabel, setEditExamLabel] = useState(examLabel);
  const [editPaperDate, setEditPaperDate] = useState(paperDate);
  const [editShortChoiceNote, setEditShortChoiceNote] = useState(shortChoiceNote);
  const [editLongChoiceNote, setEditLongChoiceNote] = useState(longChoiceNote);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  const mcqQuestionNum = questions.length > 0 ? 1 : 0;
  const shortQuestionNum = shortQuestions.length > 0 ? mcqQuestionNum + 1 : 0;
  const longStartNum = (shortQuestionNum || mcqQuestionNum) + 1;
  const boardLevelCode = getBoardLevelCode(grade);

  const hasShortOr = shortQuestions.some((q) => Boolean(q.orPrompt?.trim()));
  const hasLongOr = longQuestions.some((q) => Boolean(q.orPrompt?.trim()));

  const mcqTotalMarks = Math.round(questions.length * marksPerQuestion * 100) / 100;
  const shortTotalMarks = Math.round(
    shortQuestions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0) * 100,
  ) / 100;
  const longTotalMarks = Math.round(
    longQuestions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0) * 100,
  ) / 100;
  const subjectiveTotalMarks = Math.round((shortTotalMarks + longTotalMarks) * 100) / 100;
  const totalMarks = Math.round((mcqTotalMarks + subjectiveTotalMarks) * 100) / 100;

  const resolvedSectionATime = estimateSectionATimeMinutes(
    grade,
    questions.length,
    sectionATimeMinutes,
  );
  const resolvedSubjectiveTime =
    questions.length > 0 && (shortQuestions.length > 0 || longQuestions.length > 0)
      ? Math.max(15, durationMinutes - resolvedSectionATime)
      : durationMinutes;

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

  const activeTitle = editTitle.trim() || title;

  async function handleDownloadPdf() {
    if (!sheetRef.current) return;
    setExportError(null);
    setExportingPdf(true);
    try {
      await exportPaperToPdf(sheetRef.current, activeTitle, compactLayout, paperSize);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'PDF export failed. Please try Print.');
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleDownloadWord() {
    setExportError(null);
    setExportingWord(true);
    try {
      await exportPaperToWord({
        title: activeTitle,
        board,
        schoolName: editSchoolName,
        examLabel: editExamLabel,
        formattedDate,
        grade,
        subject,
        topic,
        durationMinutes,
        sectionATimeMinutes: resolvedSectionATime,
        patternLabel,
        marksPerQuestion,
        totalMarks,
        mcqTotalMarks,
        shortTotalMarks,
        longTotalMarks,
        questions,
        shortQuestions,
        longQuestions,
        shortChoiceNote: editShortChoiceNote,
        longChoiceNote: editLongChoiceNote,
        paperStyle,
        paperSize,
        compactLayout,
        sideBySideOr,
        twoColumnMcqs,
        showOmrGrid,
        separateSectionA,
        includeAnswerKey,
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Word export failed.');
    } finally {
      setExportingWord(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex flex-col overflow-y-auto print-only-sheet">
      <style>{`@media print { @page { size: ${paperSize === 'legal' ? 'legal' : 'A4'} portrait; margin: ${compactLayout ? '7mm 9mm' : '10mm 12mm'}; } }`}</style>
      {/* Toolbar (hidden in print) */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <h2 className="font-display font-semibold text-slate-900">
              Paper Print Preview
            </h2>
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setPaperStyle('fbise_official');
                  setTwoColumnMcqs(false);
                  setSeparateSectionA(
                    questions.length > 0 && (shortQuestions.length > 0 || longQuestions.length > 0),
                  );
                }}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  paperStyle === 'fbise_official'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                FBISE Official Format
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaperStyle('standard');
                  setSeparateSectionA(false);
                }}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  paperStyle === 'standard'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Standard School Sheet
              </button>
            </div>
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPaperSize('a4')}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  paperSize === 'a4'
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                A4 Page
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('legal')}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  paperSize === 'legal'
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Legal (8.5×14)
              </button>
            </div>
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={compactLayout}
                onChange={(e) => setCompactLayout(e.target.checked)}
                className="w-4 h-4 accent-blue-700"
              />
              Compact (2-Page Fit)
            </label>
            {(hasShortOr || hasLongOr) && (
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sideBySideOr}
                  onChange={(e) => setSideBySideOr(e.target.checked)}
                  className="w-4 h-4 accent-blue-700"
                />
                Side-by-Side OR (Left | Right)
              </label>
            )}
            {questions.length > 0 && (
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={twoColumnMcqs}
                  onChange={(e) => setTwoColumnMcqs(e.target.checked)}
                  className="w-4 h-4 accent-blue-700"
                />
                2-Col MCQs
              </label>
            )}
            {paperStyle === 'fbise_official' && (
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOmrGrid}
                  onChange={(e) => setShowOmrGrid(e.target.checked)}
                  className="w-4 h-4 accent-blue-700"
                />
                OMR Circles (Roll/Version)
              </label>
            )}
            {paperStyle === 'fbise_official' && questions.length > 0 && (shortQuestions.length > 0 || longQuestions.length > 0) && (
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={separateSectionA}
                  onChange={(e) => setSeparateSectionA(e.target.checked)}
                  className="w-4 h-4 accent-blue-700"
                />
                FBISE Page Split (Sec-A Page 1, B &amp; C Page 2+)
              </label>
            )}
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAnswerKey}
                onChange={(e) => setIncludeAnswerKey(e.target.checked)}
                className="w-4 h-4 accent-blue-700"
              />
              Include Answer Key
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={exportingPdf || exportingWord}
              className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              {exportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              {exportingPdf ? 'Generating PDF...' : 'Download PDF'}
            </button>
            <button
              type="button"
              onClick={handleDownloadWord}
              disabled={exportingWord || exportingPdf}
              className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-60 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              {exportingWord ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {exportingWord ? 'Creating Word...' : 'Download Word (.docx)'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print
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
        {exportError && (
          <div className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md">
            {exportError}
          </div>
        )}

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

          {(shortQuestions.length > 0 || longQuestions.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {shortQuestions.length > 0 && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
                    Short Questions Note / Attempt Instruction
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={editShortChoiceNote}
                    onChange={(e) => setEditShortChoiceNote(e.target.value)}
                    placeholder="e.g. Attempt any 6 short questions (or attempt either OR part)."
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}
              {longQuestions.length > 0 && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
                    Long Questions Note / Attempt Instruction
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={editLongChoiceNote}
                    onChange={(e) => setEditLongChoiceNote(e.target.value)}
                    placeholder="e.g. Attempt any 3 long questions (each carries equal marks)."
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}
            </div>
          )}

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
      <div className="w-full overflow-x-auto px-2 sm:px-4 py-4 print:overflow-visible print:p-0">
      <div
        ref={sheetRef}
        className={`${paperSize === 'legal' ? 'w-[816px] max-w-[816px]' : 'w-[794px] max-w-[794px]'} mx-auto bg-white border border-slate-200 print:w-full print:max-w-none print:border-none print:my-0 print:p-0 ${
          compactLayout
            ? 'p-3 space-y-1.5 print:space-y-1.5'
            : 'p-6 sm:p-9 space-y-5 print:space-y-4'
        }`}
      >
        {paperStyle === 'fbise_official' ? (
          <div data-pdf-block="true" className={`border-2 border-slate-900 ${compactLayout ? 'p-2 space-y-1' : 'p-3 space-y-2'}`}>
            {/* Official Board Header */}
            <div className={`text-center border-b border-slate-900 ${compactLayout ? 'pb-1' : 'pb-1.5'}`}>
              {editSchoolName.trim() && (
                <div className={`font-display font-bold uppercase tracking-wide text-slate-950 ${compactLayout ? 'text-sm' : 'text-base'}`}>
                  {editSchoolName.trim()}
                </div>
              )}
              <div className={`${compactLayout ? 'text-[11px]' : 'text-xs'} font-bold uppercase tracking-wider text-slate-950`}>
                {board === 'punjab_ptb'
                  ? `Punjab Board (BISE · PTB) ${boardLevelCode} Examination`
                  : 'Federal Board of Intermediate and Secondary Education, Islamabad'}
              </div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-900 mt-0.5">
                {subject.toUpperCase()} {boardLevelCode}
                {editExamLabel.trim() ? ` · ${editExamLabel.trim()}` : ' · Model Question Paper'}
                {patternLabel ? ` (${patternLabel})` : ''}
              </div>
              {editTitle.trim() && editTitle.trim() !== `${grade} ${subject}` && (
                <div className="text-[10px] font-medium text-slate-600 mt-0.5">
                  {editTitle.trim()}
                </div>
              )}
            </div>

            {/* Official Version No., Roll No. OMR Circles & Candidate / Invigilator Details */}
            {showOmrGrid ? (
              <div className={`grid grid-cols-[auto_auto_1fr] gap-2 border-b border-slate-300 ${compactLayout ? 'pb-1.5' : 'pb-2'} text-[11px] text-slate-900`}>
                {/* Version No. 4-Digit Box + 0-9 OMR Circles */}
                <div className={`border border-slate-800 ${compactLayout ? 'px-1.5 py-1' : 'px-2 py-1.5'}`}>
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-center mb-0.5">
                    Version No.
                  </div>
                  <div className="grid grid-cols-4 gap-0.5 mb-0.5">
                    {[0, 1, 2, 3].map((col) => (
                      <div
                        key={col}
                        className={`${compactLayout ? 'w-3.5 h-3.5' : 'w-4 h-4'} border border-slate-900 mx-auto`}
                      />
                    ))}
                  </div>
                  <div className={compactLayout ? 'space-y-[1px]' : 'space-y-0.5'}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                      <div key={digit} className="grid grid-cols-4 gap-0.5">
                        {[0, 1, 2, 3].map((col) => (
                          <span
                            key={col}
                            className={`${compactLayout ? 'w-[11px] h-[11px] text-[6.5px]' : 'w-3.5 h-3.5 text-[7.5px]'} rounded-full border border-slate-800 font-mono font-semibold flex items-center justify-center mx-auto leading-none`}
                          >
                            {digit}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Roll No. 6-Digit Box + 0-9 OMR Circles */}
                <div className={`border border-slate-800 ${compactLayout ? 'px-1.5 py-1' : 'px-2 py-1.5'}`}>
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-center mb-0.5">
                    ROLL NO.
                  </div>
                  <div className="grid grid-cols-6 gap-0.5 mb-0.5">
                    {[0, 1, 2, 3, 4, 5].map((col) => (
                      <div
                        key={col}
                        className={`${compactLayout ? 'w-3.5 h-3.5' : 'w-4 h-4'} border border-slate-900 mx-auto`}
                      />
                    ))}
                  </div>
                  <div className={compactLayout ? 'space-y-[1px]' : 'space-y-0.5'}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                      <div key={digit} className="grid grid-cols-6 gap-0.5">
                        {[0, 1, 2, 3, 4, 5].map((col) => (
                          <span
                            key={col}
                            className={`${compactLayout ? 'w-[11px] h-[11px] text-[6.5px]' : 'w-3.5 h-3.5 text-[7.5px]'} rounded-full border border-slate-800 font-mono font-semibold flex items-center justify-center mx-auto leading-none`}
                          >
                            {digit}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Answer Sheet No., Candidate Name, Signatures, Date & OMR Bubble Instructions */}
                <div className="flex flex-col justify-between gap-1 pl-0.5">
                  <div className={`${compactLayout ? 'space-y-1 text-[10.5px]' : 'space-y-1.5 text-[11px]'} font-medium`}>
                    <div className="flex items-baseline gap-1.5">
                      <span className="shrink-0 font-semibold">Answer Sheet No.</span>
                      <span className="flex-1 border-b border-slate-800 h-3" />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="shrink-0 font-semibold">Name of Candidate:</span>
                      <span className="flex-1 border-b border-slate-800 h-3" />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="shrink-0 font-semibold">Sign. of Candidate:</span>
                      <span className="flex-1 border-b border-slate-800 h-3" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-baseline gap-1">
                        <span className="shrink-0 font-semibold">Sign. of Invigilator:</span>
                        <span className="flex-1 border-b border-slate-800 h-3" />
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="shrink-0 font-semibold">Date:</span>
                        <span className="flex-1 border-b border-slate-800 text-center font-mono text-[10px]">
                          {formattedDate || ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="border border-slate-400 bg-slate-50 px-2 py-1 text-[9px] leading-tight text-slate-800 space-y-0.5">
                    <div className="font-bold uppercase tracking-wide text-slate-950">
                      Instructions for Filling OMR Circles:
                    </div>
                    <div>
                      1. Use <strong>Blue / Black Ballpoint Pen</strong> only (Lead pencil is strictly prohibited).
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>2. Fill circle completely:</span>
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-900 inline-block" /> Correct
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full border border-slate-700 inline-flex items-center justify-center text-[7px]">✕</span>
                        <span className="w-2.5 h-2.5 rounded-full border border-slate-700 inline-flex items-center justify-center text-[7px]">✓</span>
                        Wrong
                      </span>
                      <span>· Do not cut/overwrite.</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-[11px] text-slate-900 border-b border-slate-300 pb-1.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold uppercase">Version No.</span>
                    <div className="inline-flex">
                      {[0, 1, 2, 3].map((box) => (
                        <span
                          key={box}
                          className="w-4 h-4 border border-slate-900 -ml-px first:ml-0 inline-block"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold uppercase">ROLL NO.</span>
                    <div className="inline-flex">
                      {[0, 1, 2, 3, 4, 5].map((box) => (
                        <span
                          key={box}
                          className="w-4 h-4 border border-slate-900 -ml-px first:ml-0 inline-block"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="font-medium">
                    Answer Sheet No.: ______________
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 font-medium">
                  <div>Name of Candidate: _______________</div>
                  <div>Sign. of Candidate: _______________</div>
                  <div>
                    Sign. Invigilator: ________ · Date: {formattedDate || '_______'}
                  </div>
                </div>
              </div>
            )}

            {/* Paper Metadata Grid (No chapter names printed) */}
            <div className="grid grid-cols-4 gap-x-2 text-[11.5px] text-slate-800">
              <div>
                Examination: <strong className="text-slate-950">{boardLevelCode} ({GRADE_LABELS[grade]})</strong>
              </div>
              <div>
                Subject: <strong className="text-slate-950">{subject}</strong>
              </div>
              <div className="tabular-nums">
                Total Marks: <strong className="text-slate-950">{totalMarks}</strong>
              </div>
              <div className="tabular-nums text-right">
                Total Time: <strong className="text-slate-950">{formatDurationHoursMin(durationMinutes)}</strong>
                {formattedDate ? ` · ${formattedDate}` : ''}
              </div>
            </div>
          </div>
        ) : (
          <div data-pdf-block="true" className={`border-b-2 border-slate-900 ${compactLayout ? 'pb-2.5' : 'pb-4'}`}>
            {(editSchoolName.trim() || editExamLabel.trim()) && (
              <div className={`text-center border-b border-slate-200 ${compactLayout ? 'mb-2 pb-1.5' : 'mb-3 pb-2.5'}`}>
                {editSchoolName.trim() && (
                  <div className={`font-display font-bold uppercase tracking-wide text-slate-950 ${compactLayout ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>
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

            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-0.5">
              {BOARD_PRINT_LABELS[board]}
            </p>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className={`font-display font-bold text-slate-900 ${compactLayout ? 'text-lg sm:text-xl' : 'text-2xl'}`}>
                {editTitle.trim() || title}
              </h1>
              <span className="text-xs font-mono text-slate-700 font-semibold tabular-nums">
                Total Marks: {totalMarks} · Time: {durationMinutes} Minutes
                {formattedDate ? ` · Date: ${formattedDate}` : ''}
              </span>
            </div>
            <div className={`${compactLayout ? 'mt-1 text-xs' : 'mt-2 text-sm'} flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-700`}>
              <span>Class: <strong>{GRADE_LABELS[grade]}</strong></span>
              <span>·</span>
              <span>Subject: <strong>{subject}</strong></span>
            </div>
            <div className={`${compactLayout ? 'mt-2.5 pt-2' : 'mt-4 pt-3'} grid grid-cols-2 gap-6 text-xs text-slate-600 border-t border-slate-200`}>
              <div>Student Name: ______________________________________</div>
              <div>
                Roll No.: _____________________ {formattedDate ? `Date: ${formattedDate}` : 'Date: ____________'}
              </div>
            </div>
          </div>
        )}

        {/* Question 1: Objective MCQs (SECTION — A) */}
        {questions.length > 0 && (
          <section className={compactLayout ? 'space-y-1' : 'space-y-4'}>
            <div data-pdf-block="true" data-pdf-keep-with-next="true" className="space-y-0.5">
              {paperStyle === 'fbise_official' ? (
                <div className={`bg-slate-100 border-y-2 border-slate-900 px-2.5 ${compactLayout ? 'py-0.5' : 'py-1'} flex items-center justify-between gap-2`}>
                  <h2 className="font-display text-xs font-bold uppercase tracking-wide text-slate-950">
                    Section – A (Marks {mcqTotalMarks})
                  </h2>
                  <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">
                    Time allowed: {resolvedSectionATime} minutes
                  </span>
                </div>
              ) : (
                <div className={`flex items-baseline justify-between border-b border-slate-300 ${compactLayout ? 'pb-1' : 'pb-2'}`}>
                  <h2 className={`font-display font-bold uppercase tracking-wide text-slate-900 ${compactLayout ? 'text-sm' : 'text-base'}`}>
                    Question {mcqQuestionNum}: Multiple Choice Questions (Objective)
                  </h2>
                  <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums">
                    ({questions.length} × {marksPerQuestion} = {mcqTotalMarks} Marks)
                  </span>
                </div>
              )}
              {paperStyle === 'fbise_official' ? (
                <>
                  <p className={`${compactLayout ? 'text-[9.5px] leading-tight' : 'text-[10px] leading-snug'} font-medium text-slate-700`}>
                    <strong>Note:</strong> Section – A is compulsory. All parts of this section are to be answered on the separately provided OMR Answer Sheet / question paper itself. It should be completed in the first {resolvedSectionATime} minutes and handed over to the Centre Superintendent. Deleting/overwriting is not allowed. Do not use lead pencil.
                  </p>
                  <p className={`${compactLayout ? 'text-[10.5px]' : 'text-[11px]'} font-bold text-slate-900 leading-tight`}>
                    Q.{mcqQuestionNum} Fill the relevant bubble / circle against each question according to curriculum. Each part carries {marksPerQuestion === 1 ? 'one mark' : `${marksPerQuestion} marks`}.
                  </p>
                </>
              ) : (
                <p className="text-[11px] font-semibold text-slate-700 leading-snug">
                  Note: Choose the correct option (A, B, C, or D) for each statement below.
                </p>
              )}
            </div>
            {paperStyle === 'fbise_official' && !twoColumnMcqs ? (
              <div className="border border-slate-400 divide-y divide-slate-300">
                <div
                  data-pdf-block="true"
                  data-pdf-keep-with-next="true"
                  className="grid grid-cols-[1fr_7.2rem] bg-slate-100/90 border-b border-slate-400 text-[9.5px] font-bold uppercase tracking-wider text-slate-700"
                >
                  <div className="px-2 py-1">Questions &amp; Options</div>
                  <div className="px-1.5 py-1 border-l border-slate-400 text-center">
                    Bubbles (A B C D)
                  </div>
                </div>
                {questions.map((q, idx) => {
                  const hasLongOption = q.options.some((opt) => opt.trim().length > 20);
                  return (
                    <div
                      key={idx}
                      data-pdf-block="true"
                      className="break-inside-avoid grid grid-cols-[1fr_7.2rem] items-stretch"
                    >
                      <div className={compactLayout ? 'px-2 py-[2.5px]' : 'px-3 py-2'}>
                        <p className={`${compactLayout ? 'text-[10.5px] leading-[1.22] mb-0.5' : 'text-[13px] leading-snug mb-1'} font-medium text-slate-950`}>
                          <span className="font-mono font-bold mr-1.5 tabular-nums">({idx + 1})</span>
                          {q.prompt}
                        </p>
                        <div
                          className={`grid ${hasLongOption ? 'grid-cols-2' : 'grid-cols-4'} gap-x-2.5 ${
                            compactLayout ? 'gap-y-0 pl-5 text-[10px]' : 'gap-y-1 pl-6 text-xs'
                          } text-slate-800`}
                        >
                          {q.options.map((opt, optIdx) => {
                            const letter = String.fromCharCode(65 + optIdx);
                            return (
                              <div key={optIdx} className="leading-tight flex items-baseline gap-1">
                                <span className="font-mono font-semibold text-slate-900 shrink-0">
                                  ({letter})
                                </span>
                                <span>{opt}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="border-l border-slate-300 bg-slate-50/40 px-1.5 py-1 flex items-center justify-center gap-1.5">
                        {[0, 1, 2, 3].map((optIdx) => {
                          const letter = String.fromCharCode(65 + optIdx);
                          return (
                            <span
                              key={optIdx}
                              className={`${compactLayout ? 'w-4 h-4 text-[8px]' : 'w-[18px] h-[18px] text-[9px]'} rounded-full border border-slate-900 bg-white font-mono font-bold text-slate-900 flex items-center justify-center leading-none shrink-0`}
                            >
                              {letter}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <ol
                className={
                  twoColumnMcqs
                    ? `grid grid-cols-2 gap-x-4 ${compactLayout ? 'gap-y-1' : 'gap-y-3'}`
                    : compactLayout
                      ? 'space-y-1'
                      : 'space-y-3 print:space-y-2.5'
                }
              >
                {questions.map((q, idx) => (
                  <li key={idx} data-pdf-block="true" className="break-inside-avoid">
                    <p className={`${compactLayout ? 'text-[11px] leading-[1.25] mb-0.5' : 'text-sm leading-snug mb-1.5'} font-medium text-slate-900`}>
                      <span className="font-mono font-semibold mr-1 tabular-nums">{idx + 1}.</span>
                      {q.prompt}
                    </p>
                    <div className={`grid grid-cols-2 gap-x-3 ${compactLayout ? 'gap-y-0 pl-3.5 text-[10.5px]' : 'gap-y-1 pl-6 text-sm'} text-slate-800`}>
                      {q.options.map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        return (
                          <div key={optIdx} className="leading-tight flex items-start gap-1">
                            {paperStyle === 'fbise_official' ? (
                              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate-900 text-[8px] font-mono font-bold shrink-0 mt-px">
                                {letter}
                              </span>
                            ) : (
                              <span className="font-mono font-semibold mr-0.5 shrink-0">({letter})</span>
                            )}
                            <span>{opt}</span>
                          </div>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {/* Subjective Part Header (Sections B & C) */}
        {paperStyle === 'fbise_official' &&
          (shortQuestions.length > 0 || longQuestions.length > 0) && (
            <div
              {...(separateSectionA && questions.length > 0 ? { 'data-pdf-page-break': 'true' } : { 'data-pdf-block': 'true' })}
              data-pdf-keep-with-next="true"
              className={`${separateSectionA && questions.length > 0 ? 'break-before-page ' : ''}border-2 border-slate-900 bg-slate-50 px-2.5 ${compactLayout ? 'py-1 space-y-0.5' : 'py-1.5 space-y-1'}`}
            >
              {separateSectionA && questions.length > 0 && (
                <div className="text-center border-b border-slate-400 pb-0.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-950">
                    {board === 'punjab_ptb'
                      ? `Punjab Board (BISE · PTB) ${boardLevelCode} Examination`
                      : 'Federal Board of Intermediate and Secondary Education, Islamabad'}
                  </div>
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-900">
                    {subject.toUpperCase()} {boardLevelCode} — Subjective Part
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 text-[11.5px] font-bold text-slate-950">
                <span>
                  Time allowed: {formatDurationHoursMin(resolvedSubjectiveTime)}
                </span>
                <span className="uppercase tracking-wide">
                  {boardLevelCode} {subject} — Sections B &amp; C
                </span>
                <span className="font-mono tabular-nums">
                  Total Marks Section B &amp; C: {subjectiveTotalMarks}
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-700 leading-tight">
                Note: Answer all parts from Section &lsquo;B&rsquo; and all questions from Section &lsquo;C&rsquo; on the E-sheet. Write your answers on the allotted / given spaces.
              </p>
            </div>
          )}

        {/* Question 2: Short Answer Questions (SECTION — B) */}
        {shortQuestions.length > 0 && (
          <section className={compactLayout ? 'space-y-1' : 'space-y-4'}>
            <div data-pdf-block="true" data-pdf-keep-with-next="true" className="space-y-0.5">
              {paperStyle === 'fbise_official' ? (
                <div className={`bg-slate-100 border-y-2 border-slate-900 px-2.5 ${compactLayout ? 'py-0.5' : 'py-1'} flex items-center justify-between gap-2`}>
                  <h2 className="font-display text-xs font-bold uppercase tracking-wide text-slate-950">
                    SECTION – B (Marks {shortTotalMarks})
                  </h2>
                  <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">
                    Q.{shortQuestionNum} ({shortQuestions.length} Parts · {shortTotalMarks} Marks)
                  </span>
                </div>
              ) : (
                <div className={`flex items-baseline justify-between border-b border-slate-300 ${compactLayout ? 'pb-1' : 'pb-2'}`}>
                  <h2 className={`font-display font-bold uppercase tracking-wide text-slate-900 ${compactLayout ? 'text-sm' : 'text-base'}`}>
                    Q.{shortQuestionNum}: Short Answer Questions
                  </h2>
                  <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums">
                    ({shortQuestions.length} Parts · {shortTotalMarks} Marks)
                  </span>
                </div>
              )}
              <p className={`${compactLayout ? 'text-[10.5px]' : 'text-[11px]'} font-semibold text-slate-700 leading-tight`}>
                {editShortChoiceNote.trim()
                  ? `Q.${shortQuestionNum}: ${editShortChoiceNote.trim()}`
                  : hasShortOr
                    ? `Q.${shortQuestionNum}: Attempt the following parts on the E-sheet (internal OR choice provided).`
                    : `Q.${shortQuestionNum}: Write concise, to-the-point answers for the short parts below.`}
              </p>
            </div>
            {sideBySideOr && hasShortOr ? (
              <div className="border-t border-slate-300 divide-y divide-slate-300">
                {shortQuestions.map((sq, idx) => (
                  <div
                    key={idx}
                    data-pdf-block="true"
                    className={`break-inside-avoid grid grid-cols-[2rem_1fr_2.4rem_1fr] items-stretch ${
                      compactLayout ? 'text-[11px] leading-[1.28]' : 'text-sm leading-relaxed'
                    }`}
                  >
                    <div className={`${compactLayout ? 'py-[3px] pr-1' : 'py-2 pr-1.5'} font-mono font-bold text-slate-900 tabular-nums border-r border-slate-200 flex items-start justify-center`}>
                      {formatRomanPart(idx)}
                    </div>
                    <div className={`${compactLayout ? 'py-[3px] px-1.5' : 'py-2 px-2.5'} font-medium text-slate-900`}>
                      {sq.prompt}
                    </div>
                    <div className="border-x border-slate-300 flex flex-col items-center justify-center bg-slate-50/70 text-[9px] font-bold uppercase tracking-wider text-slate-700 px-0.5 tabular-nums">
                      <span>{sq.orPrompt?.trim() ? 'OR' : '—'}</span>
                      <span className="text-[8.5px] font-mono text-slate-500 font-semibold">[{sq.marks}]</span>
                    </div>
                    <div className={`${compactLayout ? 'py-[3px] pl-1.5' : 'py-2 pl-2.5'} flex items-start justify-between gap-1.5 font-medium text-slate-900`}>
                      <span className="flex-1">{sq.orPrompt?.trim() || ''}</span>
                      <span className="text-[10px] font-mono font-semibold text-slate-600 shrink-0 tabular-nums">
                        [{sq.marks}]
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ol className={compactLayout ? 'space-y-1' : 'space-y-4'}>
                {shortQuestions.map((sq, idx) => (
                  <li key={idx} data-pdf-block="true" className="break-inside-avoid flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-0.5">
                      <p className={`${compactLayout ? 'text-[11px] leading-[1.28]' : 'text-sm leading-relaxed'} font-medium text-slate-900`}>
                        <span className="font-mono font-semibold mr-1.5 tabular-nums">{formatRomanPart(idx)}</span>
                        {sq.prompt}
                      </p>
                      {sq.orPrompt?.trim() && (
                        <>
                          <div className="pl-5 text-[9.5px] font-bold uppercase tracking-widest text-slate-700">
                            — OR —
                          </div>
                          <p className={`${compactLayout ? 'text-[11px] leading-[1.28]' : 'text-sm leading-relaxed'} font-medium text-slate-900 pl-5`}>
                            {sq.orPrompt.trim()}
                          </p>
                        </>
                      )}
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-600 shrink-0 tabular-nums">
                      [{sq.marks} Marks]
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {/* Section C: Long / Extended Questions (Q.3, Q.4, Q.5, Q.6...) */}
        {longQuestions.length > 0 && (
          <section className={compactLayout ? 'space-y-1' : 'space-y-4'}>
            <div data-pdf-block="true" data-pdf-keep-with-next="true" className="space-y-0.5">
              {paperStyle === 'fbise_official' ? (
                <div className={`bg-slate-100 border-y-2 border-slate-900 px-2.5 ${compactLayout ? 'py-0.5' : 'py-1'} flex items-center justify-between gap-2`}>
                  <h2 className="font-display text-xs font-bold uppercase tracking-wide text-slate-950">
                    SECTION – C (Marks {longTotalMarks})
                  </h2>
                  <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">
                    Q.{longStartNum}{longQuestions.length > 1 ? `–Q.${longStartNum + longQuestions.length - 1}` : ''} ({longQuestions.length} {longQuestions.length === 1 ? 'Question' : 'Questions'})
                  </span>
                </div>
              ) : (
                <div className={`flex items-baseline justify-between border-b border-slate-300 ${compactLayout ? 'pb-1' : 'pb-2'}`}>
                  <h2 className={`font-display font-bold uppercase tracking-wide text-slate-900 ${compactLayout ? 'text-sm' : 'text-base'}`}>
                    SECTION – C: Long / Extended Questions
                  </h2>
                  <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums">
                    ({longQuestions.length} {longQuestions.length === 1 ? 'Question' : 'Questions'} · {longTotalMarks} Marks)
                  </span>
                </div>
              )}
              <p className={`${compactLayout ? 'text-[10.5px]' : 'text-[11px]'} font-semibold text-slate-700 leading-tight`}>
                {editLongChoiceNote.trim()
                  ? `Note: ${editLongChoiceNote.trim()}`
                  : hasLongOr
                    ? 'Note: Attempt all questions. Marks of each question are given along with each question (internal OR choice provided).'
                    : 'Note: Attempt all questions below with detailed explanations, diagrams, or equations where applicable.'}
              </p>
            </div>
            {sideBySideOr && hasLongOr ? (
              <div className="border-t border-slate-300 divide-y divide-slate-300">
                {longQuestions.map((lq, idx) => (
                  <div
                    key={idx}
                    data-pdf-block="true"
                    className={`break-inside-avoid grid grid-cols-[2.2rem_1fr_2.4rem_1fr] items-stretch ${
                      compactLayout ? 'text-[11px] leading-[1.28]' : 'text-sm leading-relaxed'
                    }`}
                  >
                    <div className={`${compactLayout ? 'py-1 pr-1' : 'py-2.5 pr-1.5'} font-mono font-bold text-slate-900 tabular-nums border-r border-slate-200 flex items-start justify-center`}>
                      Q.{longStartNum + idx}
                    </div>
                    <div className={`${compactLayout ? 'py-1 px-1.5' : 'py-2.5 px-2.5'} font-medium text-slate-900`}>
                      {lq.prompt}
                    </div>
                    <div className="border-x border-slate-300 flex flex-col items-center justify-center bg-slate-50/70 text-[9px] font-bold uppercase tracking-wider text-slate-700 px-0.5 tabular-nums">
                      <span>{lq.orPrompt?.trim() ? 'OR' : '—'}</span>
                      <span className="text-[8.5px] font-mono text-slate-500 font-semibold">[{lq.marks}]</span>
                    </div>
                    <div className={`${compactLayout ? 'py-1 pl-1.5' : 'py-2.5 pl-2.5'} flex items-start justify-between gap-1.5 font-medium text-slate-900`}>
                      <span className="flex-1">{lq.orPrompt?.trim() || ''}</span>
                      <span className="text-[10px] font-mono font-semibold text-slate-600 shrink-0 tabular-nums">
                        [{lq.marks}]
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ol className={compactLayout ? 'space-y-1' : 'space-y-5'}>
                {longQuestions.map((lq, idx) => (
                  <li key={idx} data-pdf-block="true" className="break-inside-avoid flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-0.5">
                      <p className={`${compactLayout ? 'text-[11px] leading-[1.28]' : 'text-sm leading-relaxed'} font-medium text-slate-900`}>
                        <span className="font-mono font-bold mr-1.5 tabular-nums">Q.{longStartNum + idx}</span>
                        {lq.prompt}
                      </p>
                      {lq.orPrompt?.trim() && (
                        <>
                          <div className="pl-5 text-[9.5px] font-bold uppercase tracking-widest text-slate-700">
                            — OR —
                          </div>
                          <p className={`${compactLayout ? 'text-[11px] leading-[1.28]' : 'text-sm leading-relaxed'} font-medium text-slate-900 pl-5`}>
                            {lq.orPrompt.trim()}
                          </p>
                        </>
                      )}
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-600 shrink-0 tabular-nums">
                      [{lq.marks} Marks]
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {/* End of Exam Paper Footer */}
        <footer data-pdf-block="true" className={`${compactLayout ? 'pt-2 mt-2 text-[11px]' : 'pt-4 mt-8 text-xs'} border-t border-slate-400 flex items-center justify-between gap-2 text-slate-700 break-inside-avoid`}>
          <span className="font-semibold uppercase tracking-wider text-slate-600">
            *** End of Question Paper ***
          </span>
          <span>
            Developed by <strong className="font-semibold text-slate-900">Muhammad Asim Khan</strong>{' '}
            <span aria-hidden="true" className="mx-1 text-slate-400">·</span>{' '}
            <span className="font-mono font-semibold text-slate-900 tabular-nums">03165552001</span>
          </span>
        </footer>

        {includeAnswerKey && (
          <div data-pdf-page-break="true" className="mt-10 pt-6 border-t-2 border-slate-900 break-before-page space-y-6">
            <h2 data-pdf-block="true" className="font-display text-lg font-bold text-slate-900">
              Answer Key & Marking Scheme — {editTitle.trim() || title}
            </h2>

            {questions.length > 0 && (
              <div data-pdf-block="true">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Question {mcqQuestionNum} — MCQ Answer Key
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                  {questions.map((q, idx) => (
                    <div key={idx} className="p-2 border border-slate-200 rounded">
                      {idx + 1}: <strong>{String.fromCharCode(65 + q.correctIndex)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {shortQuestions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Q.{shortQuestionNum} — Short Questions Key Points (Section B)
                </h3>
                {shortQuestions.map((sq, idx) => (
                  <div key={idx} data-pdf-block="true" className="text-xs text-slate-800 border-l-2 border-slate-300 pl-3 py-0.5 break-inside-avoid space-y-1">
                    <p className="font-semibold text-slate-900">
                      {formatRomanPart(idx)} ({sq.marks} Marks): {sq.prompt}
                    </p>
                    <p className="text-slate-600">{sq.suggestedAnswer}</p>
                    {sq.orPrompt?.trim() && (
                      <div className="pt-1 border-t border-slate-200 mt-1">
                        <p className="font-semibold text-slate-900">OR: {sq.orPrompt.trim()}</p>
                        {sq.orSuggestedAnswer?.trim() && (
                          <p className="text-slate-600">{sq.orSuggestedAnswer.trim()}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {longQuestions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Q.{longStartNum}{longQuestions.length > 1 ? `–Q.${longStartNum + longQuestions.length - 1}` : ''} — Long Questions Solution Outline (Section C)
                </h3>
                {longQuestions.map((lq, idx) => (
                  <div key={idx} data-pdf-block="true" className="text-xs text-slate-800 border-l-2 border-slate-300 pl-3 py-0.5 break-inside-avoid space-y-1">
                    <p className="font-semibold text-slate-900">
                      Q.{longStartNum + idx} ({lq.marks} Marks): {lq.prompt}
                    </p>
                    <p className="text-slate-600 whitespace-pre-line">{lq.suggestedAnswer}</p>
                    {lq.orPrompt?.trim() && (
                      <div className="pt-1 border-t border-slate-200 mt-1">
                        <p className="font-semibold text-slate-900">OR: {lq.orPrompt.trim()}</p>
                        {lq.orSuggestedAnswer?.trim() && (
                          <p className="text-slate-600 whitespace-pre-line">{lq.orSuggestedAnswer.trim()}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <footer data-pdf-block="true" className="pt-3 mt-6 border-t border-slate-300 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 break-inside-avoid">
              <span className="font-semibold uppercase tracking-wider text-slate-600">
                MeritExam · Marking Scheme
              </span>
              <span>
                Developed by <strong className="font-semibold text-slate-900">Muhammad Asim Khan</strong>{' '}
                <span aria-hidden="true" className="mx-1 text-slate-400">·</span>{' '}
                <span className="font-mono font-semibold text-slate-900 tabular-nums">03165552001</span>
              </span>
            </footer>
          </div>
        )}
      </div>
      </div>
    </div>,
    document.body,
  );
}
