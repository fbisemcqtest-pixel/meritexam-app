import React, { useRef, useState } from 'react';
import { Check, Pencil, Plus, Printer, RefreshCw, Trash2 } from 'lucide-react';
import {
  CURRICULUM_BOARD_LABEL,
  DIFFICULTIES,
  DifficultyTier,
  EXAM_BOARDS,
  EXAM_TYPE_PRESETS,
  ExamBoard,
  GRADES,
  GRADE_LABELS,
  GradeLevel,
  MAX_TOPIC_LENGTH,
  MCQQuestion,
  SUBJECT_GROUPS,
  SubjectName,
  SubjectiveQuestion,
  SystemSettings,
  TestDeliveryOverride,
  getSyllabusChapters,
} from '../types';
import { getActiveEditionClass } from '../config/appEdition';
import { generateMCQsFromServer, publishMCQTest } from '../services/mcqService';
import {
  FBISE_PATTERN_MODES,
  FbisePatternMode,
  formatDurationHoursMin,
  getOfficialPattern,
} from '../data/fbisePatterns';
import {
  buildFbiseExclusionPromptBlock,
  getFbiseExclusionProfile,
  getSummativeFbiseChapters,
  isFbiseExcludedChapter,
} from '../data/fbiseExclusions';
import { PrintablePaperModal } from './PrintablePaperModal';

interface TestGeneratorPanelProps {
  creatorUid: string;
  creatorName: string;
  creatorRole: 'teacher' | 'admin';
  defaultSubject?: SubjectName | 'All';
  defaultGrade?: GradeLevel | 'All';
  lockedGrade?: GradeLevel;
  systemSettings: SystemSettings;
  onPublished?: () => void;
}

export function TestGeneratorPanel({
  creatorUid,
  creatorName,
  creatorRole,
  defaultSubject,
  defaultGrade,
  lockedGrade,
  systemSettings,
  onPublished,
}: TestGeneratorPanelProps) {
  const activeEdition = getActiveEditionClass();
  const effectiveLockedGrade: GradeLevel | undefined =
    lockedGrade ?? (activeEdition !== 'All' ? activeEdition : undefined);
  const initialGrade: GradeLevel =
    effectiveLockedGrade ?? (defaultGrade && defaultGrade !== 'All' ? defaultGrade : '9th');
  const initialSubject: SubjectName =
    defaultSubject && defaultSubject !== 'All' ? defaultSubject : 'Physics';
  const initialPattern = getOfficialPattern('fbise_nbf', initialGrade, initialSubject, 'reformed_50_50');

  const [board, setBoard] = useState<ExamBoard>('fbise_nbf');
  const [patternMode, setPatternMode] = useState<FbisePatternMode>('reformed_50_50');
  const [paperHeaderStyle, setPaperHeaderStyle] = useState<
    'fbise_official' | 'apsacs_official' | 'standard'
  >('fbise_official');
  const [schoolName, setSchoolName] = useState('');
  const [examLabel, setExamLabel] = useState('');
  const examLabelInputRef = useRef<HTMLInputElement | null>(null);
  const [paperDate, setPaperDate] = useState('');
  const [grade, setGrade] = useState<GradeLevel>(initialGrade);
  const [subject, setSubject] = useState<SubjectName>(initialSubject);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyTier>('Standard');
  const [questionCount, setQuestionCount] = useState<number>(initialPattern.mcqCount);
  const [shortQuestionCount, setShortQuestionCount] = useState<number>(initialPattern.shortCount);
  const [longQuestionCount, setLongQuestionCount] = useState<number>(initialPattern.longCount);
  const [includeShortOr, setIncludeShortOr] = useState(initialPattern.shortHasOr);
  const [includeLongOr, setIncludeLongOr] = useState(initialPattern.longHasOr);
  const [shortChoiceNote, setShortChoiceNote] = useState(initialPattern.shortChoiceNote);
  const [longChoiceNote, setLongChoiceNote] = useState(initialPattern.longChoiceNote);
  const [marksPerQuestion, setMarksPerQuestion] = useState<number>(initialPattern.mcqMarks);
  const [marksPerShort, setMarksPerShort] = useState<number>(initialPattern.shortMarks);
  const [marksPerLong, setMarksPerLong] = useState<number>(initialPattern.longMarks);
  const [longMarksList, setLongMarksList] = useState<number[] | undefined>(
    initialPattern.longMarksList,
  );
  const [includePbaChapters, setIncludePbaChapters] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<number>(initialPattern.totalTimeMinutes);
  const [sectionATimeMinutes, setSectionATimeMinutes] = useState<number>(
    initialPattern.sectionATimeMinutes,
  );
  const [patternLabel, setPatternLabel] = useState<string>(initialPattern.titleTag);
  const [title, setTitle] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<TestDeliveryOverride>('inherit');
  const [scheduledReleaseAt, setScheduledReleaseAt] = useState('');
  const [scheduledEndAt, setScheduledEndAt] = useState('');
  const [allowedGrades, setAllowedGrades] = useState<GradeLevel[]>([initialGrade]);
  const [publishToStudents, setPublishToStudents] = useState(true);
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [shortQuestions, setShortQuestions] = useState<SubjectiveQuestion[]>([]);
  const [longQuestions, setLongQuestions] = useState<SubjectiveQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const activeOfficialPattern = getOfficialPattern(board, grade, subject, patternMode);

  function applyPatternToForm(
    targetBoard: ExamBoard,
    targetGrade: GradeLevel,
    targetSubject: SubjectName,
    targetMode: FbisePatternMode,
  ) {
    const p = getOfficialPattern(targetBoard, targetGrade, targetSubject, targetMode);
    setQuestionCount(p.mcqCount);
    setMarksPerQuestion(p.mcqMarks);
    setShortQuestionCount(p.shortCount);
    setMarksPerShort(p.shortMarks);
    setIncludeShortOr(p.shortHasOr);
    setShortChoiceNote(p.shortChoiceNote);
    setLongQuestionCount(p.longCount);
    setMarksPerLong(p.longMarks);
    setLongMarksList(p.longMarksList);
    setIncludeLongOr(p.longHasOr);
    setLongChoiceNote(p.longChoiceNote);
    setDurationMinutes(p.totalTimeMinutes);
    setSectionATimeMinutes(p.sectionATimeMinutes);
    setPatternLabel(p.titleTag);
    setErrorMsg(null);
  }

  const chaptersForSelection = getSyllabusChapters(board, grade, subject);
  const exclusionProfile = board === 'fbise_nbf' ? getFbiseExclusionProfile(grade, subject) : null;
  const summativeChapters = getSummativeFbiseChapters(board, grade, subject, chaptersForSelection);
  const excludedWholeChapterCount = chaptersForSelection.length - summativeChapters.length;
  const visibleChapters =
    board === 'fbise_nbf' && !includePbaChapters && excludedWholeChapterCount > 0
      ? summativeChapters
      : chaptersForSelection;

  const activeBoardMeta = EXAM_BOARDS.find((b) => b.value === board) ?? EXAM_BOARDS[0];
  const hasAnyPaperContent =
    questions.length > 0 || shortQuestions.length > 0 || longQuestions.length > 0;

  const activeLongMarksList =
    longMarksList && longMarksList.length === longQuestionCount ? longMarksList : undefined;
  const plannedLongTotalMarks = activeLongMarksList
    ? activeLongMarksList.reduce((acc, m) => acc + m, 0)
    : longQuestionCount * marksPerLong;

  const plannedTotalMarks =
    Math.round(
      (questionCount * marksPerQuestion +
        shortQuestionCount * marksPerShort +
        plannedLongTotalMarks) *
        100,
    ) / 100;

  async function handleGenerate() {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (questionCount + shortQuestionCount + longQuestionCount < 1) {
      setErrorMsg('Please set at least 1 MCQ, Short Question, or Long Question.');
      return;
    }

    const fbiseExclusionClause =
      board === 'fbise_nbf'
        ? buildFbiseExclusionPromptBlock(board, grade, subject, selectedChapters)
        : undefined;

    setGenerating(true);
    setGenerationProgress(null);
    try {
      const res = await generateMCQsFromServer(
        {
          board,
          grade,
          subject,
          topic: topic.trim(),
          selectedChapters: selectedChapters.length > 0 ? selectedChapters : undefined,
          syllabusChapters: visibleChapters,
          difficulty,
          questionCount,
          shortQuestionCount,
          longQuestionCount,
          includeShortOr,
          includeLongOr,
          shortMarks: marksPerShort,
          longMarks: marksPerLong,
          ...(activeLongMarksList ? { longMarksList: activeLongMarksList } : {}),
          ...(fbiseExclusionClause ? { fbiseExclusionClause } : {}),
        },
        (done, total, stageLabel) => {
          if (stageLabel) {
            setGenerationProgress(stageLabel);
          } else if (total > 8) {
            setGenerationProgress(`${done} / ${total} ready...`);
          }
        },
      );
      setTitle(res.title);
      setQuestions(res.questions);
      setShortQuestions(res.shortQuestions);
      setLongQuestions(
        activeLongMarksList
          ? res.longQuestions.map((lq, i) => ({
              ...lq,
              marks: activeLongMarksList[i] ?? lq.marks,
            }))
          : res.longQuestions,
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate paper.');
    } finally {
      setGenerating(false);
      setGenerationProgress(null);
    }
  }

  function handleUpdateQuestion(idx: number, patch: Partial<MCQQuestion>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    );
  }

  function handleUpdateOption(qIdx: number, optIdx: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const nextOpts = [...q.options] as [string, string, string, string];
        nextOpts[optIdx] = value;
        return { ...q, options: nextOpts };
      }),
    );
  }

  function handleAddManualQuestion() {
    if (questions.length >= 200) return;
    setQuestions((prev) => [
      ...prev,
      {
        prompt: '',
        options: ['', '', '', ''],
        correctIndex: 0,
        explanation: '',
        topicTag: topic.trim() || subject,
      },
    ]);
    if (!title.trim()) {
      setTitle(`${grade} ${subject} Paper`);
    }
  }

  function handleRemoveQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAddManualShortQuestion() {
    if (shortQuestions.length >= 50) return;
    setShortQuestions((prev) => [
      ...prev,
      {
        prompt: '',
        suggestedAnswer: '',
        marks: marksPerShort,
        topicTag: topic.trim() || subject,
      },
    ]);
    if (!title.trim()) {
      setTitle(`${grade} ${subject} Paper`);
    }
  }

  function handleUpdateShortQuestion(idx: number, patch: Partial<SubjectiveQuestion>) {
    setShortQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    );
  }

  function handleRemoveShortQuestion(idx: number) {
    setShortQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAddManualLongQuestion() {
    if (longQuestions.length >= 25) return;
    setLongQuestions((prev) => [
      ...prev,
      {
        prompt: '',
        suggestedAnswer: '',
        marks: marksPerLong,
        topicTag: topic.trim() || subject,
      },
    ]);
    if (!title.trim()) {
      setTitle(`${grade} ${subject} Paper`);
    }
  }

  function handleUpdateLongQuestion(idx: number, patch: Partial<SubjectiveQuestion>) {
    setLongQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    );
  }

  function handleRemoveLongQuestion(idx: number) {
    setLongQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!hasAnyPaperContent) {
      setErrorMsg('Generate or add at least one MCQ, Short Question, or Long Question before publishing.');
      return;
    }

    const incompleteMcq = questions.some(
      (q) => !q.prompt.trim() || q.options.some((opt) => !opt.trim()),
    );
    if (incompleteMcq) {
      setErrorMsg('Every MCQ must have a question stem and four non-empty options.');
      return;
    }

    const incompleteShort = shortQuestions.some((q) => !q.prompt.trim());
    if (incompleteShort) {
      setErrorMsg('Every Short Question must have a non-empty question prompt.');
      return;
    }

    const incompleteLong = longQuestions.some((q) => !q.prompt.trim());
    if (incompleteLong) {
      setErrorMsg('Every Long Question must have a non-empty question prompt.');
      return;
    }

    let scheduledIso = '';
    if (scheduledReleaseAt.trim()) {
      const parsedStart = new Date(scheduledReleaseAt);
      if (Number.isNaN(parsedStart.getTime())) {
        setErrorMsg('Please select a valid Start Date & Time or clear it to start immediately.');
        return;
      }
      scheduledIso = parsedStart.toISOString();
    }

    let scheduledEndIso = '';
    if (scheduledEndAt.trim()) {
      const parsedEnd = new Date(scheduledEndAt);
      if (Number.isNaN(parsedEnd.getTime())) {
        setErrorMsg('Please select a valid Closing / End Date & Time or clear it.');
        return;
      }
      if (scheduledIso && parsedEnd.getTime() <= new Date(scheduledIso).getTime()) {
        setErrorMsg('Closing / End Date & Time must be later than the Start Date & Time.');
        return;
      }
      if (publishToStudents && parsedEnd.getTime() <= Date.now()) {
        setErrorMsg('Closing / End Date & Time cannot already be in the past when publishing to students.');
        return;
      }
      scheduledEndIso = parsedEnd.toISOString();
    }

    const effectiveAllowedGrades: GradeLevel[] =
      allowedGrades.length > 0 ? allowedGrades : [grade];

    setPublishing(true);
    try {
      const effectiveSchoolName =
        schoolName.trim() ||
        (paperHeaderStyle === 'apsacs_official'
          ? 'Army Public Schools & Colleges System'
          : '');
      await publishMCQTest({
        title: title.trim() || `${grade} ${subject} Assessment`,
        board,
        schoolName: effectiveSchoolName,
        examLabel: examLabel.trim(),
        paperDate: paperDate.trim(),
        grade,
        subject,
        topic: topic.trim(),
        difficulty,
        durationMinutes,
        marksPerQuestion,
        questions,
        shortQuestions,
        longQuestions,
        shortChoiceNote: shortChoiceNote.trim(),
        longChoiceNote: longChoiceNote.trim(),
        sectionATimeMinutes,
        patternLabel,
        deliveryMode: creatorRole === 'admin' ? deliveryMode : 'inherit',
        isActive: publishToStudents,
        scheduledReleaseAt: scheduledIso,
        scheduledEndAt: scheduledEndIso,
        allowedGrades: effectiveAllowedGrades,
        createdBy: creatorUid,
        createdByName: creatorName,
        createdByRole: creatorRole,
      });
      const summaryParts: string[] = [];
      if (questions.length > 0) summaryParts.push(`${questions.length} MCQs`);
      if (shortQuestions.length > 0) summaryParts.push(`${shortQuestions.length} Short`);
      if (longQuestions.length > 0) summaryParts.push(`${longQuestions.length} Long`);
      const summaryLabel = summaryParts.join(' + ');
      const classLabel = effectiveAllowedGrades.join(', ');

      setSuccessMsg(
        !publishToStudents
          ? `Saved "${title.trim() || `${grade} ${subject}`}" (${summaryLabel}) as Paused / Print-Only (hidden from students).`
          : scheduledIso
            ? `Published "${title.trim() || `${grade} ${subject}`}" (${summaryLabel}) for ${classLabel} — Starts ${new Date(scheduledIso).toLocaleString()}${scheduledEndIso ? `, closes ${new Date(scheduledEndIso).toLocaleString()}` : ''}.`
            : `Published "${title.trim() || `${grade} ${subject}`}" (${summaryLabel}) for ${classLabel}${scheduledEndIso ? ` — Active until ${new Date(scheduledEndIso).toLocaleString()}` : ' — Active immediately'}.`,
      );
      setQuestions([]);
      setShortQuestions([]);
      setLongQuestions([]);
      setTitle('');
      setSelectedChapters([]);
      setTopic('');
      setScheduledReleaseAt('');
      setScheduledEndAt('');
      onPublished?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to publish test.');
    } finally {
      setPublishing(false);
    }
  }

  const effectiveModeLabel =
    (creatorRole === 'admin' && deliveryMode !== 'inherit'
      ? deliveryMode
      : systemSettings.resultMode) === 'instant'
      ? 'Instant Result & Explanation'
      : 'Admin Controlled Result Release';

  const generateButtonSummary = (() => {
    const parts: string[] = [];
    if (questionCount > 0) parts.push(`${questionCount} MCQs`);
    if (shortQuestionCount > 0) parts.push(`${shortQuestionCount} Short`);
    if (longQuestionCount > 0) parts.push(`${longQuestionCount} Long`);
    if (shortQuestionCount === 0 && longQuestionCount === 0) {
      return `Generate ${grade} ${subject} Paper`;
    }
    return `Generate Paper (${parts.join(' · ')})`;
  })();

  const publishButtonSummary = (() => {
    const parts: string[] = [];
    if (questions.length > 0) parts.push(`${questions.length} MCQs`);
    if (shortQuestions.length > 0) parts.push(`${shortQuestions.length} Short`);
    if (longQuestions.length > 0) parts.push(`${longQuestions.length} Long`);
    return parts.join(' + ');
  })();

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-200">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Paper &amp; Assessment Builder ({board === 'punjab_ptb' ? 'Punjab Board · PTB / PCTB' : 'Federal Board · FBISE / NBF'})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {board === 'punjab_ptb'
                ? 'Punjab Curriculum & Textbook Board (PTB / PCTB / PECTAA) books loaded — select chapters below.'
                : 'National Book Foundation (NBF / FBISE) books loaded — selecting Class & Subject auto-syncs Section A, B & C.'}
            </p>
          </div>
          <div className="text-xs text-slate-600 tabular-nums">
            Active Policy: <span className="font-semibold text-slate-900">{effectiveModeLabel}</span>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Examination Board / Textbook Syllabus
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EXAM_BOARDS.map((b) => {
              const isSelected = board === b.value;
              return (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => {
                    setBoard(b.value);
                    setSelectedChapters([]);
                    setTopic('');
                    setPaperHeaderStyle((prev) => {
                      if (prev === 'apsacs_official') return prev;
                      return b.value === 'fbise_nbf' ? 'fbise_official' : 'standard';
                    });
                    applyPatternToForm(b.value, grade, subject, patternMode);
                  }}
                  className={`text-left px-4 py-3 rounded-lg border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-50 border-blue-700 text-blue-950'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold">{b.shortLabel}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{b.label}</div>
                  </div>
                  <span
                    className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      isSelected ? 'border-blue-700' : 'border-slate-400'
                    }`}
                  >
                    {isSelected && <span className="w-2 h-2 rounded-full bg-blue-700" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Official Federal Board (FBISE / APSACS Unified) Pattern Selector + Auto-Synced Breakdown */}
        <div className="mb-5 p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-slate-900">
                {board === 'punjab_ptb'
                  ? 'Punjab Board (PTB / PCTB) Pattern Track (Auto-Applied on Class / Subject Change)'
                  : 'Official FBISE / APSACS Pattern Track (Same Marks & Sections for Both)'}
              </span>
              <span className="ml-2 text-[11px] text-slate-500">
                {board === 'punjab_ptb'
                  ? 'Punjab BISE / PCTB Textbook Alignment'
                  : 'Verified from fbise.edu.pk — APSACS uses the exact same FBISE pattern (only first-page logo/header changes below)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => applyPatternToForm(board, grade, subject, patternMode)}
                className="text-[11px] font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded cursor-pointer transition-colors"
              >
                Reset to {grade} {subject} Official ({activeOfficialPattern.totalMarks} Marks)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {FBISE_PATTERN_MODES.map((m) => {
              const isActive = patternMode === m.value;
              const previewPattern = getOfficialPattern(board, grade, subject, m.value);
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    setPatternMode(m.value);
                    applyPatternToForm(board, grade, subject, m.value);
                  }}
                  className={`text-left px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-blue-800 text-white border-blue-900 shadow-xs'
                      : 'bg-white text-slate-800 border-slate-300 hover:bg-blue-50 hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold leading-tight">{m.shortLabel}</span>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded tabular-nums ${
                        isActive ? 'bg-blue-950/60 text-blue-100' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {previewPattern.totalMarks} Marks
                    </span>
                  </div>
                  <div
                    className={`text-[10px] mt-1 tabular-nums ${
                      isActive ? 'text-blue-100' : 'text-slate-500'
                    }`}
                  >
                    Sec-A: {previewPattern.mcqCount}×{previewPattern.mcqMarks} · Sec-B: {previewPattern.shortCount}×{previewPattern.shortMarks} · Sec-C: {previewPattern.longMarksList ? previewPattern.longMarksList.join('+') : `${previewPattern.longCount}×${previewPattern.longMarks}`}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-slate-700">
            <div className="bg-white border border-slate-200 rounded px-2.5 py-1.5">
              <div className="text-[10px] uppercase font-semibold text-slate-500">Section-A (Q.1)</div>
              <div className="font-bold text-slate-900 tabular-nums">
                {activeOfficialPattern.mcqCount} MCQs = {activeOfficialPattern.sectionAMarks} Marks ({activeOfficialPattern.sectionATimeMinutes} Min)
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded px-2.5 py-1.5">
              <div className="text-[10px] uppercase font-semibold text-slate-500">Section-B (Q.2)</div>
              <div className="font-bold text-slate-900 tabular-nums">
                {activeOfficialPattern.shortCount} × {activeOfficialPattern.shortMarks} = {activeOfficialPattern.sectionBMarks} Marks (with OR)
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded px-2.5 py-1.5">
              <div className="text-[10px] uppercase font-semibold text-slate-500">
                Section-C (Q.3{activeOfficialPattern.longCount > 1 ? `–Q.${2 + activeOfficialPattern.longCount}` : ''})
              </div>
              <div className="font-bold text-slate-900 tabular-nums">
                {activeOfficialPattern.longMarksList
                  ? `${activeOfficialPattern.longMarksList.join('+')} = ${activeOfficialPattern.sectionCMarks} Marks`
                  : `${activeOfficialPattern.longCount} × ${activeOfficialPattern.longMarks} = ${activeOfficialPattern.sectionCMarks} Marks`}{' '}
                (with OR)
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded px-2.5 py-1.5">
              <div className="text-[10px] uppercase font-semibold text-slate-500">B &amp; C Subjective Time</div>
              <div className="font-bold text-slate-900 tabular-nums">
                {formatDurationHoursMin(activeOfficialPattern.subjectiveTimeMinutes)} ({activeOfficialPattern.sectionBMarks + activeOfficialPattern.sectionCMarks} Marks)
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-5">
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Class / Grade
            </label>
            <select
              value={effectiveLockedGrade ?? grade}
              disabled={Boolean(effectiveLockedGrade)}
              onChange={(e) => {
                if (effectiveLockedGrade) return;
                const nextGrade = e.target.value as GradeLevel;
                setGrade(nextGrade);
                setAllowedGrades([nextGrade]);
                setSelectedChapters([]);
                setTopic('');
                applyPatternToForm(board, nextGrade, subject, patternMode);
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-700"
            >
              {(effectiveLockedGrade ? [effectiveLockedGrade] : GRADES).map((g) => (
                <option key={g} value={g}>
                  {GRADE_LABELS[g]}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => {
                const nextSubject = e.target.value as SubjectName;
                setSubject(nextSubject);
                setSelectedChapters([]);
                setTopic('');
                applyPatternToForm(board, grade, nextSubject, patternMode);
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {SUBJECT_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Difficulty Tier
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as DifficultyTier)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              MCQs (Up to 200)
            </label>
            <input
              type="number"
              min={0}
              max={200}
              value={questionCount}
              onChange={(e) => {
                if (e.target.value === '') {
                  setQuestionCount(0);
                  return;
                }
                const val = Number(e.target.value);
                setQuestionCount(Number.isNaN(val) ? 0 : Math.min(200, Math.max(0, Math.floor(val))));
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Short Questions (Up to 50)
            </label>
            <input
              type="number"
              min={0}
              max={50}
              value={shortQuestionCount}
              onChange={(e) => {
                if (e.target.value === '') {
                  setShortQuestionCount(0);
                  return;
                }
                const val = Number(e.target.value);
                setShortQuestionCount(Number.isNaN(val) ? 0 : Math.min(50, Math.max(0, Math.floor(val))));
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Long Questions (Up to 25)
            </label>
            <input
              type="number"
              min={0}
              max={25}
              value={longQuestionCount}
              onChange={(e) => {
                if (e.target.value === '') {
                  setLongQuestionCount(0);
                  setLongMarksList(undefined);
                  return;
                }
                const val = Number(e.target.value);
                setLongQuestionCount(Number.isNaN(val) ? 0 : Math.min(25, Math.max(0, Math.floor(val))));
                setLongMarksList(undefined);
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
            />
          </div>
        </div>

        {/* Official FBISE Assessment Framework Compliance Notice */}
        {board === 'fbise_nbf' && exclusionProfile && (
          <div className="mb-5 p-3 rounded-lg bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-emerald-900">
                FBISE Official Assessment Framework Active ({grade} {subject})
              </div>
              {excludedWholeChapterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !includePbaChapters;
                    setIncludePbaChapters(nextVal);
                    if (!nextVal) {
                      setSelectedChapters((prev) =>
                        prev.filter((ch) => !isFbiseExcludedChapter(board, grade, subject, ch)),
                      );
                    }
                  }}
                  className="text-[11px] font-semibold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded cursor-pointer transition-colors"
                >
                  {includePbaChapters
                    ? `Hide ${excludedWholeChapterCount} Lab/PBA-Only Units`
                    : `Show ${excludedWholeChapterCount} Lab/PBA-Only Units`}
                </button>
              )}
            </div>
            <p className="text-[11px] text-emerald-900 leading-relaxed">
              Only <strong>Summative for Written Theory</strong> SLOs are included. Formative &amp; Practical-Only (PBA / Domain N/G/X) topics are automatically excluded from generated MCQs &amp; subjective questions.
              {excludedWholeChapterCount > 0 && !includePbaChapters && (
                <span>
                  {' '}
                  Excluded non-exam units hidden from theory list:{' '}
                  <strong>{exclusionProfile.excludedWholeChapters.join(', ')}</strong>.
                </span>
              )}
            </p>
          </div>
        )}

        {/* Multi-Chapter Selector */}
        <div className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label className="text-xs font-semibold text-slate-700">
              {activeBoardMeta.shortLabel} · {grade} {subject} Chapters ({board === 'punjab_ptb' ? 'PTB / PCTB Textbook Units' : 'NBF Written Theory Units'} — click to select)
              {selectedChapters.length > 0 && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold tabular-nums">
                  {selectedChapters.length} Selected
                </span>
              )}
            </label>
            <div className="flex items-center gap-3">
              {selectedChapters.length < visibleChapters.length && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChapters([...visibleChapters]);
                    setTopic(
                      excludedWholeChapterCount > 0 && !includePbaChapters
                        ? `All ${visibleChapters.length} Summative Theory Chapters`
                        : `All ${visibleChapters.length} Chapters (Full Book)`,
                    );
                  }}
                  className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                >
                  Select All
                </button>
              )}
              {(selectedChapters.length > 0 || topic) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChapters([]);
                    setTopic('');
                  }}
                  className="text-xs font-medium text-slate-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  Clear (Full Syllabus)
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {visibleChapters.map((ch) => {
              const originalIdx = chaptersForSelection.indexOf(ch);
              const selected = selectedChapters.includes(ch);
              const isPbaOnlyUnit = isFbiseExcludedChapter(board, grade, subject, ch);
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => {
                    const isAlreadySelected = selectedChapters.includes(ch);
                    const nextSelected = isAlreadySelected
                      ? selectedChapters.filter((item) => item !== ch)
                      : visibleChapters.filter(
                          (item) => item === ch || selectedChapters.includes(item),
                        );
                    setSelectedChapters(nextSelected);
                    if (nextSelected.length === 0) {
                      setTopic('');
                    } else if (nextSelected.length === visibleChapters.length) {
                      setTopic(
                        excludedWholeChapterCount > 0 && !includePbaChapters
                          ? `All ${visibleChapters.length} Summative Theory Chapters`
                          : `All ${visibleChapters.length} Chapters (Full Book)`,
                      );
                    } else {
                      const formatted = nextSelected
                        .map((item) => `Ch ${chaptersForSelection.indexOf(item) + 1}: ${item}`)
                        .join(', ');
                      if (formatted.length <= MAX_TOPIC_LENGTH) {
                        setTopic(formatted);
                      } else {
                        const shortNums = nextSelected
                          .map((item) => `Ch ${chaptersForSelection.indexOf(item) + 1}`)
                          .join(', ');
                        const combined = `${shortNums} (${nextSelected.join(', ')})`;
                        setTopic(combined.slice(0, MAX_TOPIC_LENGTH));
                      }
                    }
                  }}
                  aria-pressed={selected}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer inline-flex items-center gap-1 ${
                    selected
                      ? 'bg-blue-700 border-blue-700 text-white shadow-xs'
                      : isPbaOnlyUnit
                        ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {selected && <Check className="w-3 h-3 shrink-0" />}
                  <span>
                    Ch {originalIdx + 1}: {ch}
                    {isPbaOnlyUnit ? ' (PBA/Formative)' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Selected Chapters / Custom Topic Focus
            </label>
            <input
              type="text"
              maxLength={MAX_TOPIC_LENGTH}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={`Full ${grade} ${subject} syllabus or click chapters above...`}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Marks per MCQ
            </label>
            <select
              value={marksPerQuestion}
              onChange={(e) => setMarksPerQuestion(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
            >
              <option value={0.5}>0.5 Mark / MCQ</option>
              <option value={0.75}>0.75 Mark / MCQ</option>
              <option value={1}>1 Mark / MCQ</option>
              <option value={1.5}>1.5 Marks / MCQ</option>
              <option value={2}>2 Marks / MCQ</option>
              <option value={3}>3 Marks / MCQ</option>
              <option value={5}>5 Marks / MCQ</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Time Limit (Minutes) · Total: {plannedTotalMarks} Marks
            </label>
            <input
              type="number"
              min={1}
              max={180}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value) || 15)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
            />
          </div>
        </div>

        {(shortQuestionCount > 0 || longQuestionCount > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 p-4 bg-blue-50/60 border border-blue-200/80 rounded-lg">
            {shortQuestionCount > 0 && (
              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Marks per Short Question ({shortQuestionCount} × {marksPerShort} = {shortQuestionCount * marksPerShort} Marks)
                  </label>
                  <select
                    value={marksPerShort}
                    onChange={(e) => setMarksPerShort(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
                  >
                    <option value={2}>2 Marks / Short Q</option>
                    <option value={3}>3 Marks / Short Q</option>
                    <option value={4}>4 Marks / Short Q</option>
                    <option value={5}>5 Marks / Short Q</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-teal-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeShortOr}
                    onChange={(e) => setIncludeShortOr(e.target.checked)}
                    className="w-4 h-4 accent-teal-700"
                  />
                  Include &ldquo;OR&rdquo; Choice on Short Questions (Ya Yeh / Ya Woh)
                </label>

                <input
                  type="text"
                  maxLength={200}
                  value={shortChoiceNote}
                  onChange={(e) => setShortChoiceNote(e.target.value)}
                  placeholder="Optional note (e.g. Attempt any 6 out of 9 short questions)"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}

            {longQuestionCount > 0 && (
              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Marks per Long Question (
                    {activeLongMarksList
                      ? `${activeLongMarksList.join(' + ')} = ${plannedLongTotalMarks} Marks`
                      : `${longQuestionCount} × ${marksPerLong} = ${plannedLongTotalMarks} Marks`}
                    )
                  </label>
                  <select
                    value={marksPerLong}
                    onChange={(e) => {
                      setMarksPerLong(Number(e.target.value));
                      setLongMarksList(undefined);
                    }}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
                  >
                    <option value={5}>5 Marks / Long Q</option>
                    <option value={6}>6 Marks / Long Q</option>
                    <option value={7}>7 Marks / Long Q</option>
                    <option value={8}>8 Marks / Long Q</option>
                    <option value={10}>10 Marks / Long Q</option>
                    <option value={11}>11 Marks / Long Q</option>
                    <option value={12}>12 Marks / Long Q</option>
                    <option value={13}>13 Marks / Long Q</option>
                    <option value={15}>15 Marks / Long Q</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-indigo-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeLongOr}
                    onChange={(e) => setIncludeLongOr(e.target.checked)}
                    className="w-4 h-4 accent-indigo-700"
                  />
                  Include &ldquo;OR&rdquo; Choice on Long Questions (Ya Yeh / Ya Woh)
                </label>

                <input
                  type="text"
                  maxLength={200}
                  value={longChoiceNote}
                  onChange={(e) => setLongChoiceNote(e.target.value)}
                  placeholder="Optional note (e.g. Attempt any 3 long questions)"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}
          </div>
        )}

        {/* Paper Header Metadata (First-Page Logo Style, School Name, Exam Term/Type, Paper Date) */}
        <div className="mb-5 pt-4 border-t border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="block text-xs font-semibold text-slate-700">
              First-Page Logo / Header Style &amp; Details (Same Pattern — Only Header / Logo Changes)
            </label>
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => {
                  setPaperHeaderStyle('fbise_official');
                  if (examLabel === 'Pre-Board Examination (Cold & Warm Region)') {
                    setExamLabel('');
                  }
                }}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  paperHeaderStyle === 'fbise_official'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                FBISE Official Header
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaperHeaderStyle('apsacs_official');
                  if (!examLabel.trim()) {
                    setExamLabel('Pre-Board Examination (Cold & Warm Region)');
                  }
                }}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  paperHeaderStyle === 'apsacs_official'
                    ? 'bg-emerald-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                APSACS Monogram &amp; First Page
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaperHeaderStyle('standard');
                  if (examLabel === 'Pre-Board Examination (Cold & Warm Region)') {
                    setExamLabel('');
                  }
                }}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  paperHeaderStyle === 'standard'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Standard School Header
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                {paperHeaderStyle === 'apsacs_official' ? 'APSACS Campus / System Name' : 'School / Academy Name'}
              </label>
              <input
                type="text"
                maxLength={140}
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder={
                  paperHeaderStyle === 'apsacs_official'
                    ? 'Army Public Schools & Colleges System'
                    : 'e.g. City Grammar High School'
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="block text-[11px] font-semibold text-slate-600">
                  Paper / Exam Type (Term, Send-Up, Test)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      examLabelInputRef.current?.focus();
                      examLabelInputRef.current?.select();
                    }}
                    className="text-[11px] font-semibold text-blue-700 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>
                  {examLabel && (
                    <button
                      type="button"
                      onClick={() => {
                        setExamLabel('');
                        examLabelInputRef.current?.focus();
                      }}
                      className="text-[11px] font-medium text-slate-500 hover:text-red-600 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={examLabelInputRef}
                type="text"
                maxLength={80}
                list="exam-type-presets-list"
                value={examLabel}
                onChange={(e) => setExamLabel(e.target.value)}
                placeholder="Type or edit any Exam / Test name..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <datalist id="exam-type-presets-list">
                {EXAM_TYPE_PRESETS.map((preset) => (
                  <option key={preset} value={preset} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {['First Term', 'Second Term', 'Send-Up', 'Pre-Board', 'Monthly Assessment'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setExamLabel(tag)}
                    className={`px-2 py-0.5 text-[11px] rounded border cursor-pointer transition-colors ${
                      examLabel === tag
                        ? 'bg-blue-700 border-blue-700 text-white font-medium'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    examLabelInputRef.current?.focus();
                    examLabelInputRef.current?.select();
                  }}
                  className="px-2 py-0.5 text-[11px] rounded border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100 font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Pencil className="w-2.5 h-2.5" />
                  Custom / Edit
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="block text-[11px] font-semibold text-slate-600">
                  Paper Date
                </label>
                <button
                  type="button"
                  onClick={() => setPaperDate(new Date().toISOString().slice(0, 10))}
                  className="text-[11px] font-medium text-blue-700 hover:underline cursor-pointer"
                >
                  Today
                </button>
              </div>
              <input
                type="date"
                value={paperDate}
                onChange={(e) => setPaperDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Student Class Permission, Scheduled Window & Admin Delivery Override */}
        <div className="space-y-4 mb-5 pt-4 border-t border-slate-100">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={publishToStudents}
                  onChange={(e) => setPublishToStudents(e.target.checked)}
                  className="w-4 h-4 accent-blue-700"
                />
                Allow Students in Permitted Class(es) to See &amp; Attempt This Paper Online
              </label>
              <span className="text-[11px] font-medium text-slate-500">
                {publishToStudents
                  ? 'Visible only to selected classes during the scheduled window'
                  : 'Paused / Print-Only (completely hidden from student login)'}
              </span>
            </div>

            {publishToStudents && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-semibold text-slate-700 mr-1">
                  Permitted Classes:
                </span>
                {(effectiveLockedGrade ? [effectiveLockedGrade] : GRADES).map((g) => {
                  const checked = effectiveLockedGrade ? g === effectiveLockedGrade : allowedGrades.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      disabled={Boolean(effectiveLockedGrade)}
                      onClick={() => {
                        if (effectiveLockedGrade) return;
                        setAllowedGrades((prev) => {
                          if (prev.includes(g)) {
                            return prev.length > 1 ? prev.filter((item) => item !== g) : prev;
                          }
                          return [...prev, g];
                        });
                      }}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md border cursor-pointer disabled:cursor-default transition-colors inline-flex items-center gap-1 ${
                        checked
                          ? 'bg-blue-700 border-blue-700 text-white'
                          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {checked && <Check className="w-3 h-3" />}
                      {GRADE_LABELS[g]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Paper Start Date &amp; Time
                </label>
                {scheduledReleaseAt && (
                  <button
                    type="button"
                    onClick={() => setScheduledReleaseAt('')}
                    className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                  >
                    Start Now
                  </button>
                )}
              </div>
              <input
                type="datetime-local"
                value={scheduledReleaseAt}
                onChange={(e) => setScheduledReleaseAt(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {scheduledReleaseAt
                  ? `Unlocks at ${new Date(scheduledReleaseAt).toLocaleString()}.`
                  : 'Leave blank to unlock immediately upon publishing.'}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Paper End / Closing Time (Auto-Hide)
                </label>
                {scheduledEndAt && (
                  <button
                    type="button"
                    onClick={() => setScheduledEndAt('')}
                    className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                type="datetime-local"
                value={scheduledEndAt}
                onChange={(e) => setScheduledEndAt(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {[
                  { label: `+${durationMinutes}m`, mins: durationMinutes },
                  { label: '+1 Hr', mins: 60 },
                  { label: '+3 Hrs', mins: 180 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const base = scheduledReleaseAt ? new Date(scheduledReleaseAt) : new Date();
                      const baseMs = Number.isNaN(base.getTime()) ? Date.now() : base.getTime();
                      const end = new Date(baseMs + preset.mins * 60_000);
                      const pad = (n: number) => String(n).padStart(2, '0');
                      setScheduledEndAt(
                        `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`,
                      );
                    }}
                    className="px-2 py-0.5 text-[10.5px] font-semibold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200 rounded cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const base = scheduledReleaseAt ? new Date(scheduledReleaseAt) : new Date();
                    const d = Number.isNaN(base.getTime()) ? new Date() : base;
                    const pad = (n: number) => String(n).padStart(2, '0');
                    setScheduledEndAt(
                      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T23:59`,
                    );
                  }}
                  className="px-2 py-0.5 text-[10.5px] font-semibold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200 rounded cursor-pointer"
                >
                  Today 11:59 PM
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {scheduledEndAt
                  ? `Auto-hides from students after ${new Date(scheduledEndAt).toLocaleString()}.`
                  : 'If left blank: scheduled papers auto-close after Start + Duration, and immediate papers auto-close after 12 hours.'}
              </p>
            </div>

            {creatorRole === 'admin' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Result Release Mode (Admin Control)
                </label>
                <select
                  value={deliveryMode}
                  onChange={(e) => setDeliveryMode(e.target.value as TestDeliveryOverride)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="inherit">
                    Follow Global Admin Setting ({systemSettings.resultMode === 'instant' ? 'Option 1: Instant' : 'Option 2: Admin Review'})
                  </option>
                  <option value="instant">Option 1: Force Instant Result</option>
                  <option value="admin_review">Option 2: Force Admin Controlled Release</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={generating}
            onClick={() => void handleGenerate()}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {generating
              ? generationProgress || `Generating ${subject} Paper...`
              : generateButtonSummary}
          </button>

          <button
            type="button"
            onClick={handleAddManualQuestion}
            className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add MCQ
          </button>

          <button
            type="button"
            onClick={handleAddManualShortQuestion}
            className="px-4 py-2.5 text-sm font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Short Q
          </button>

          <button
            type="button"
            onClick={handleAddManualLongQuestion}
            className="px-4 py-2.5 text-sm font-semibold text-indigo-800 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Long Q
          </button>
        </div>
      </div>

      {/* Generated Question Review & Publish Form */}
      {hasAnyPaperContent && (
        <form onSubmit={handlePublish} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Paper / Assessment Title
              </label>
              <input
                type="text"
                required
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print / Export Paper
              </button>

              <button
                type="submit"
                disabled={publishing}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                {publishing ? 'Publishing...' : `Publish Paper (${publishButtonSummary})`}
              </button>
            </div>
          </div>

          {/* Section A: MCQs */}
          {questions.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-slate-700">
                Section A — Multiple Choice Questions ({questions.length})
              </h3>
              <div className="space-y-5">
                {questions.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-slate-600 tabular-nums">
                        <span className="font-semibold text-slate-900">MCQ {qIdx + 1}</span>
                        <span aria-hidden="true">·</span>
                        <span>{q.topicTag || subject}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(qIdx)}
                        className="text-xs text-red-600 hover:text-red-800 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      required
                      value={q.prompt}
                      onChange={(e) => handleUpdateQuestion(qIdx, { prompt: e.target.value })}
                      placeholder="Enter question stem..."
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {q.options.map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        const isCorrect = q.correctIndex === optIdx;
                        return (
                          <div
                            key={optIdx}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                              isCorrect
                                ? 'bg-emerald-50 border-emerald-300'
                                : 'bg-white border-slate-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`correct-${qIdx}`}
                              checked={isCorrect}
                              onChange={() => handleUpdateQuestion(qIdx, { correctIndex: optIdx })}
                              title={`Mark option ${letter} as correct`}
                              className="accent-emerald-700 cursor-pointer"
                            />
                            <span className="text-xs font-mono font-semibold text-slate-500">
                              {letter}.
                            </span>
                            <input
                              type="text"
                              required
                              value={opt}
                              onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                              placeholder={`Option ${letter}`}
                              className="flex-1 text-sm bg-transparent focus:outline-none text-slate-900"
                            />
                          </div>
                        );
                      })}
                    </div>

                    <input
                      type="text"
                      value={q.explanation}
                      onChange={(e) => handleUpdateQuestion(qIdx, { explanation: e.target.value })}
                      placeholder="Explanation shown when results are released..."
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section B: Short Questions */}
          {shortQuestions.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-teal-800">
                  Question {questions.length > 0 ? 2 : 1} — Short Answer Questions ({shortQuestions.length})
                </h3>
                <input
                  type="text"
                  maxLength={200}
                  value={shortChoiceNote}
                  onChange={(e) => setShortChoiceNote(e.target.value)}
                  placeholder="Optional instruction (e.g. Attempt any 6 out of 9)..."
                  className="sm:w-80 px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div className="space-y-4">
                {shortQuestions.map((sq, idx) => {
                  const hasOr = sq.orPrompt !== undefined;
                  return (
                    <div
                      key={idx}
                      className="p-4 bg-teal-50/40 border border-teal-200 rounded-lg space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-slate-600 tabular-nums">
                          <span className="font-semibold text-teal-900">Short Part {idx + 1}</span>
                          <span aria-hidden="true">·</span>
                          <span>{sq.topicTag || subject}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateShortQuestion(idx, {
                                orPrompt: hasOr ? undefined : '',
                                orSuggestedAnswer: hasOr ? undefined : '',
                              })
                            }
                            className={`text-xs font-semibold px-2.5 py-1 rounded border cursor-pointer ${
                              hasOr
                                ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                                : 'bg-white border-teal-300 text-teal-800 hover:bg-teal-50'
                            }`}
                          >
                            {hasOr ? 'Remove "OR"' : '+ Add "OR" Choice'}
                          </button>
                          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                            <span>Marks:</span>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              step={0.5}
                              value={sq.marks}
                              onChange={(e) =>
                                handleUpdateShortQuestion(idx, {
                                  marks: Math.max(1, Math.min(10, Number(e.target.value) || 3)),
                                })
                              }
                              className="w-16 px-2 py-1 text-xs bg-white border border-slate-300 rounded tabular-nums"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveShortQuestion(idx)}
                            className="text-xs text-red-600 hover:text-red-800 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        required
                        value={sq.prompt}
                        onChange={(e) => handleUpdateShortQuestion(idx, { prompt: e.target.value })}
                        placeholder="Enter short question prompt..."
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />

                      <textarea
                        rows={2}
                        value={sq.suggestedAnswer}
                        onChange={(e) =>
                          handleUpdateShortQuestion(idx, { suggestedAnswer: e.target.value })
                        }
                        placeholder="Model short answer / marking key (optional)..."
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600 text-slate-700"
                      />

                      {hasOr && (
                        <div className="pt-2 border-t border-teal-200/80 space-y-2">
                          <div className="text-[11px] font-bold uppercase tracking-widest text-teal-800">
                            — OR (Alternative Question) —
                          </div>
                          <textarea
                            rows={2}
                            value={sq.orPrompt ?? ''}
                            onChange={(e) => handleUpdateShortQuestion(idx, { orPrompt: e.target.value })}
                            placeholder="Enter alternative OR short question prompt..."
                            className="w-full px-3 py-2 text-sm bg-white border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                          />
                          <textarea
                            rows={2}
                            value={sq.orSuggestedAnswer ?? ''}
                            onChange={(e) =>
                              handleUpdateShortQuestion(idx, { orSuggestedAnswer: e.target.value })
                            }
                            placeholder="Model answer for OR alternative (optional)..."
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600 text-slate-700"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section C: Long Questions */}
          {longQuestions.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-indigo-800">
                  Question {(questions.length > 0 ? 1 : 0) + (shortQuestions.length > 0 ? 1 : 0) + 1} — Long / Descriptive Questions ({longQuestions.length})
                </h3>
                <input
                  type="text"
                  maxLength={200}
                  value={longChoiceNote}
                  onChange={(e) => setLongChoiceNote(e.target.value)}
                  placeholder="Optional instruction (e.g. Attempt any 3 long questions)..."
                  className="sm:w-80 px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
              <div className="space-y-4">
                {longQuestions.map((lq, idx) => {
                  const hasOr = lq.orPrompt !== undefined;
                  return (
                    <div
                      key={idx}
                      className="p-4 bg-indigo-50/40 border border-indigo-200 rounded-lg space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-slate-600 tabular-nums">
                          <span className="font-semibold text-indigo-900">Long Part {idx + 1}</span>
                          <span aria-hidden="true">·</span>
                          <span>{lq.topicTag || subject}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateLongQuestion(idx, {
                                orPrompt: hasOr ? undefined : '',
                                orSuggestedAnswer: hasOr ? undefined : '',
                              })
                            }
                            className={`text-xs font-semibold px-2.5 py-1 rounded border cursor-pointer ${
                              hasOr
                                ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                                : 'bg-white border-indigo-300 text-indigo-800 hover:bg-indigo-50'
                            }`}
                          >
                            {hasOr ? 'Remove "OR"' : '+ Add "OR" Choice'}
                          </button>
                          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                            <span>Marks:</span>
                            <input
                              type="number"
                              min={1}
                              max={25}
                              step={0.5}
                              value={lq.marks}
                              onChange={(e) =>
                                handleUpdateLongQuestion(idx, {
                                  marks: Math.max(1, Math.min(25, Number(e.target.value) || 8)),
                                })
                              }
                              className="w-16 px-2 py-1 text-xs bg-white border border-slate-300 rounded tabular-nums"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveLongQuestion(idx)}
                            className="text-xs text-red-600 hover:text-red-800 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={3}
                        required
                        value={lq.prompt}
                        onChange={(e) => handleUpdateLongQuestion(idx, { prompt: e.target.value })}
                        placeholder="Enter long / descriptive question prompt..."
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />

                      <textarea
                        rows={3}
                        value={lq.suggestedAnswer}
                        onChange={(e) =>
                          handleUpdateLongQuestion(idx, { suggestedAnswer: e.target.value })
                        }
                        placeholder="Marking scheme / solution outline (optional)..."
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-600 text-slate-700"
                      />

                      {hasOr && (
                        <div className="pt-2 border-t border-indigo-200/80 space-y-2">
                          <div className="text-[11px] font-bold uppercase tracking-widest text-indigo-800">
                            — OR (Alternative Long Question) —
                          </div>
                          <textarea
                            rows={3}
                            value={lq.orPrompt ?? ''}
                            onChange={(e) => handleUpdateLongQuestion(idx, { orPrompt: e.target.value })}
                            placeholder="Enter alternative OR long / descriptive question prompt..."
                            className="w-full px-3 py-2 text-sm bg-white border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                          />
                          <textarea
                            rows={3}
                            value={lq.orSuggestedAnswer ?? ''}
                            onChange={(e) =>
                              handleUpdateLongQuestion(idx, { orSuggestedAnswer: e.target.value })
                            }
                            placeholder="Solution outline for OR alternative (optional)..."
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-600 text-slate-700"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      )}

      {showPrintModal && hasAnyPaperContent && (
        <PrintablePaperModal
          title={title.trim() || `${grade} ${subject} Paper`}
          board={board}
          schoolName={schoolName.trim()}
          examLabel={examLabel.trim()}
          paperDate={paperDate.trim()}
          grade={grade}
          subject={subject}
          topic={topic.trim()}
          durationMinutes={durationMinutes}
          sectionATimeMinutes={sectionATimeMinutes}
          patternLabel={patternLabel}
          marksPerQuestion={marksPerQuestion}
          questions={questions}
          shortQuestions={shortQuestions}
          longQuestions={longQuestions}
          shortChoiceNote={shortChoiceNote.trim()}
          longChoiceNote={longChoiceNote.trim()}
          defaultPaperStyle={paperHeaderStyle}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
