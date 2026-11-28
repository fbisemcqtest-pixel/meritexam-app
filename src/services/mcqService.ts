import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  OperationType,
  db,
  generateSafeId,
  handleFirestoreError,
} from '../lib/firebase';
import {
  AccountStatus,
  DifficultyTier,
  ExamBoard,
  GRADES,
  GradeLevel,
  MAX_NAME_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_TOPIC_LENGTH,
  MCQQuestion,
  MCQTest,
  ResultMode,
  SubjectName,
  SubjectiveQuestion,
  SystemSettings,
  TeacherActivity,
  TeacherActivityAction,
  TestAttempt,
  TestDeliveryOverride,
  UserRole,
  isSingleStudentGrade,
} from '../types';

export interface GenerateMCQRequest {
  board?: ExamBoard;
  grade: GradeLevel;
  subject: SubjectName;
  topic?: string;
  selectedChapters?: string[];
  syllabusChapters?: string[];
  difficulty: DifficultyTier;
  questionCount: number;
  shortQuestionCount?: number;
  longQuestionCount?: number;
  includeShortOr?: boolean;
  includeLongOr?: boolean;
  shortMarks?: number;
  longMarks?: number;
  longMarksList?: number[];
  fbiseExclusionClause?: string;
  avoidPrompts?: string[];
}

export interface GenerateMCQResponse {
  title: string;
  questions: MCQQuestion[];
  shortQuestions: SubjectiveQuestion[];
  longQuestions: SubjectiveQuestion[];
}

function isNetworkFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return (
    err.name === 'TypeError' ||
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('load failed') ||
    m.includes('network request failed')
  );
}

async function requestGenerateEndpoint(
  url: string,
  req: GenerateMCQRequest,
): Promise<{ kind: 'json'; status: number; ok: boolean; data: GenerateMCQResponse & { error?: string } } | { kind: 'html'; status: number }> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(req),
    });
  } catch (err) {
    if (isNetworkFetchError(err)) {
      await new Promise((r) => setTimeout(r, 600));
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(req),
      });
    } else {
      throw err;
    }
  }

  const rawText = await response.text();
  const trimmed = rawText.trim();

  if (trimmed.startsWith('<')) {
    return { kind: 'html', status: response.status };
  }

  let parsed: (GenerateMCQResponse & { error?: string }) | null = null;
  try {
    parsed = JSON.parse(rawText) as GenerateMCQResponse & { error?: string };
  } catch {
    const err = new Error(
      `Server returned an invalid response (HTTP ${response.status}). Please try again.`,
    ) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  return {
    kind: 'json',
    status: response.status,
    ok: response.ok,
    data: parsed,
  };
}

async function executeSingleGenerateCall(
  req: GenerateMCQRequest,
): Promise<GenerateMCQResponse> {
  let result: Awaited<ReturnType<typeof requestGenerateEndpoint>>;
  try {
    result = await requestGenerateEndpoint('/api/mcq/generate', req);
  } catch (primaryErr) {
    if (isNetworkFetchError(primaryErr)) {
      try {
        const netlifyDirect = await requestGenerateEndpoint('/.netlify/functions/generate-mcq', req);
        result = netlifyDirect;
      } catch {
        throw new Error(
          'Network connection to the paper generator failed (Failed to fetch). Check your internet/VPN, make sure you are on your latest active site URL (refresh the page if you renamed Netlify), and try again.',
        );
      }
    } else {
      throw primaryErr;
    }
  }

  if (result.kind === 'html') {
    const netlifyFallback = await requestGenerateEndpoint(
      '/.netlify/functions/generate-mcq',
      req,
    );
    if (netlifyFallback.kind === 'json') {
      result = netlifyFallback;
    } else if (netlifyFallback.status === 502 || netlifyFallback.status === 504) {
      const timeoutErr = new Error(
        `Server timed out while generating this batch (HTTP ${netlifyFallback.status}). Retrying smaller batch...`,
      ) as Error & { status?: number };
      timeoutErr.status = netlifyFallback.status;
      throw timeoutErr;
    } else {
      throw new Error(
        'Live hosting did not route /api/mcq/generate to the backend (received HTML instead of JSON). If you deployed only static files (e.g. Firebase Hosting or drag-and-drop dist), serverless API routes are inactive—deploy the full GitHub repo on Netlify/Vercel with GEMINI_API_KEY, or add questions manually below.',
      );
    }
  }

  if (!result.ok) {
    const err = new Error(
      result.data.error || `Failed to generate paper from server (HTTP ${result.status}).`,
    ) as Error & { status?: number };
    err.status = result.status;
    throw err;
  }

  return {
    title: result.data.title,
    questions: Array.isArray(result.data.questions) ? result.data.questions : [],
    shortQuestions: Array.isArray(result.data.shortQuestions) ? result.data.shortQuestions : [],
    longQuestions: Array.isArray(result.data.longQuestions) ? result.data.longQuestions : [],
  };
}

function isRetryableTimeoutError(err: unknown): boolean {
  if (isNetworkFetchError(err)) return true;
  const status = (err as { status?: number } | null)?.status;
  if (status === 502 || status === 503 || status === 504) return true;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return msg.includes('502') || msg.includes('503') || msg.includes('504') || msg.includes('Failed to fetch');
}

export async function generateMCQsFromServer(
  req: GenerateMCQRequest,
  onProgress?: (generatedCount: number, totalCount: number, stageLabel?: string) => void,
): Promise<GenerateMCQResponse> {
  const totalRequestedMcqs = Math.min(Math.max(Math.round(req.questionCount || 0), 0), 200);
  const totalRequestedShort = Math.min(Math.max(Math.round(req.shortQuestionCount || 0), 0), 50);
  const totalRequestedLong = Math.min(Math.max(Math.round(req.longQuestionCount || 0), 0), 25);
  const includeShortOr = req.includeShortOr === true;
  const includeLongOr = req.includeLongOr === true;

  const canRunSingleFastCall =
    totalRequestedMcqs <= 8 &&
    totalRequestedShort + totalRequestedLong <= 2 &&
    !(includeShortOr && totalRequestedShort > 1) &&
    !(includeLongOr && totalRequestedLong > 1);

  if (canRunSingleFastCall) {
    try {
      return await executeSingleGenerateCall({
        ...req,
        questionCount: totalRequestedMcqs,
        shortQuestionCount: totalRequestedShort,
        longQuestionCount: totalRequestedLong,
      });
    } catch (err) {
      if (!isRetryableTimeoutError(err) || (totalRequestedMcqs <= 4 && totalRequestedShort + totalRequestedLong <= 1)) {
        throw err;
      }
    }
  }

  const collectedQuestions: MCQQuestion[] = [];
  const collectedShort: SubjectiveQuestion[] = [];
  const collectedLong: SubjectiveQuestion[] = [];
  let suggestedTitle = '';

  // 1. Generate Short Questions in Netlify-safe batches
  if (totalRequestedShort > 0) {
    let shortBatchSize = includeShortOr ? 4 : 6;
    let shortRemaining = totalRequestedShort;
    let shortBatchIdx = 0;

    while (shortRemaining > 0 && shortBatchIdx < 20) {
      const chunkShort = Math.min(shortRemaining, shortBatchSize);
      const avoidShortPrompts = collectedShort
        .slice(-40)
        .flatMap((q) => [q.prompt.slice(0, 100), ...(q.orPrompt ? [q.orPrompt.slice(0, 100)] : [])]);

      let shortRes: GenerateMCQResponse;
      try {
        shortRes = await executeSingleGenerateCall({
          ...req,
          questionCount: 0,
          shortQuestionCount: chunkShort,
          longQuestionCount: 0,
          ...(avoidShortPrompts.length > 0 ? { avoidPrompts: avoidShortPrompts } : {}),
        });
      } catch (err) {
        if (isRetryableTimeoutError(err) && chunkShort > 2) {
          shortBatchSize = Math.max(2, Math.floor(chunkShort / 2));
          shortBatchIdx += 1;
          continue;
        }
        throw err;
      }

      if (!suggestedTitle && shortRes.title) {
        suggestedTitle = shortRes.title;
      }

      const existingShortSet = new Set(
        collectedShort.map((q) => q.prompt.trim().toLowerCase()),
      );
      const freshShort = shortRes.shortQuestions.filter(
        (q) => !existingShortSet.has(q.prompt.trim().toLowerCase()),
      );
      collectedShort.push(...freshShort);
      onProgress?.(
        Math.min(collectedShort.length, totalRequestedShort),
        totalRequestedShort,
        `Short Qs: ${Math.min(collectedShort.length, totalRequestedShort)} / ${totalRequestedShort}...`,
      );
      shortRemaining = totalRequestedShort - collectedShort.length;
      shortBatchIdx += 1;
      if (shortRes.shortQuestions.length === 0) break;
    }
  }

  // 2. Generate Long Questions in Netlify-safe batches
  if (totalRequestedLong > 0) {
    let longBatchSize = includeLongOr ? 2 : 4;
    let longRemaining = totalRequestedLong;
    let longBatchIdx = 0;

    while (longRemaining > 0 && longBatchIdx < 18) {
      const chunkLong = Math.min(longRemaining, longBatchSize);
      const startIdx = collectedLong.length;
      const chunkLongMarksList = Array.isArray(req.longMarksList)
        ? req.longMarksList.slice(startIdx, startIdx + chunkLong)
        : undefined;
      const avoidLongPrompts = collectedLong
        .slice(-30)
        .flatMap((q) => [q.prompt.slice(0, 100), ...(q.orPrompt ? [q.orPrompt.slice(0, 100)] : [])]);

      let longRes: GenerateMCQResponse;
      try {
        longRes = await executeSingleGenerateCall({
          ...req,
          questionCount: 0,
          shortQuestionCount: 0,
          longQuestionCount: chunkLong,
          ...(chunkLongMarksList && chunkLongMarksList.length > 0
            ? { longMarksList: chunkLongMarksList }
            : {}),
          ...(avoidLongPrompts.length > 0 ? { avoidPrompts: avoidLongPrompts } : {}),
        });
      } catch (err) {
        if (isRetryableTimeoutError(err) && chunkLong > 1) {
          longBatchSize = Math.max(1, Math.floor(chunkLong / 2));
          longBatchIdx += 1;
          continue;
        }
        throw err;
      }

      if (!suggestedTitle && longRes.title) {
        suggestedTitle = longRes.title;
      }

      const existingLongSet = new Set(
        collectedLong.map((q) => q.prompt.trim().toLowerCase()),
      );
      const freshLong = longRes.longQuestions
        .filter((q) => !existingLongSet.has(q.prompt.trim().toLowerCase()))
        .map((q, localIdx) => {
          const explicitMarks = req.longMarksList?.[startIdx + localIdx];
          return explicitMarks ? { ...q, marks: explicitMarks } : q;
        });
      collectedLong.push(...freshLong);
      onProgress?.(
        Math.min(collectedLong.length, totalRequestedLong),
        totalRequestedLong,
        `Long Qs: ${Math.min(collectedLong.length, totalRequestedLong)} / ${totalRequestedLong}...`,
      );
      longRemaining = totalRequestedLong - collectedLong.length;
      longBatchIdx += 1;
      if (longRes.longQuestions.length === 0) break;
    }
  }

  // 3. Generate MCQs in Netlify-safe batches
  let remaining = totalRequestedMcqs - collectedQuestions.length;
  let batchIndex = 0;
  let activeBatchSize = 10;

  while (remaining > 0 && batchIndex < 35) {
    const chunkCount = Math.min(remaining, activeBatchSize);
    const avoidPrompts = collectedQuestions
      .slice(-50)
      .map((q) => q.prompt.slice(0, 110));

    let chunkRes: GenerateMCQResponse;
    try {
      chunkRes = await executeSingleGenerateCall({
        ...req,
        questionCount: chunkCount,
        shortQuestionCount: 0,
        longQuestionCount: 0,
        ...(avoidPrompts.length > 0 ? { avoidPrompts } : {}),
      });
    } catch (err) {
      if (isRetryableTimeoutError(err) && chunkCount > 4) {
        activeBatchSize = Math.max(4, Math.floor(chunkCount / 2));
        batchIndex += 1;
        continue;
      }
      throw err;
    }

    if (!suggestedTitle && chunkRes.title) {
      suggestedTitle = chunkRes.title;
    }

    const existingPromptSet = new Set(
      collectedQuestions.map((q) => q.prompt.trim().toLowerCase()),
    );
    const freshQuestions = chunkRes.questions.filter(
      (q) => !existingPromptSet.has(q.prompt.trim().toLowerCase()),
    );

    collectedQuestions.push(...freshQuestions);
    onProgress?.(
      Math.min(collectedQuestions.length, totalRequestedMcqs),
      totalRequestedMcqs,
      `${Math.min(collectedQuestions.length, totalRequestedMcqs)} / ${totalRequestedMcqs} MCQs ready...`,
    );
    remaining = totalRequestedMcqs - collectedQuestions.length;
    batchIndex += 1;

    if (chunkRes.questions.length === 0) {
      break;
    }
  }

  return {
    title: suggestedTitle || `${req.grade} ${req.subject} Assessment`,
    questions: collectedQuestions.slice(0, totalRequestedMcqs),
    shortQuestions: collectedShort.slice(0, totalRequestedShort),
    longQuestions: collectedLong.slice(0, totalRequestedLong),
  };
}

export async function publishMCQTest(input: {
  title: string;
  board?: ExamBoard;
  schoolName?: string;
  examLabel?: string;
  paperDate?: string;
  grade: GradeLevel;
  subject: SubjectName;
  topic: string;
  difficulty: DifficultyTier;
  durationMinutes: number;
  marksPerQuestion?: number;
  questions: MCQQuestion[];
  shortQuestions?: SubjectiveQuestion[];
  longQuestions?: SubjectiveQuestion[];
  shortChoiceNote?: string;
  longChoiceNote?: string;
  sectionATimeMinutes?: number;
  patternLabel?: string;
  deliveryMode: TestDeliveryOverride;
  isActive: boolean;
  scheduledReleaseAt: string;
  scheduledEndAt?: string;
  allowedGrades?: GradeLevel[];
  createdBy: string;
  createdByName: string;
  createdByRole: 'teacher' | 'admin' | 'student_practice';
}): Promise<MCQTest> {
  const id = generateSafeId('test');
  const cleanQuestions = input.questions.slice(0, 200);
  const sanitizeSubjList = (list: SubjectiveQuestion[] | undefined, max: number) =>
    (list ?? []).slice(0, max).map((item) => {
      const cleanOrPrompt = (item.orPrompt ?? '').trim();
      const cleanOrAnswer = (item.orSuggestedAnswer ?? '').trim();
      return {
        prompt: item.prompt.trim(),
        suggestedAnswer: (item.suggestedAnswer ?? '').trim(),
        marks: item.marks,
        topicTag: (item.topicTag ?? '').trim(),
        ...(cleanOrPrompt ? { orPrompt: cleanOrPrompt } : {}),
        ...(cleanOrPrompt && cleanOrAnswer ? { orSuggestedAnswer: cleanOrAnswer } : {}),
      };
    });
  const cleanShortQuestions = sanitizeSubjList(input.shortQuestions, 50);
  const cleanLongQuestions = sanitizeSubjList(input.longQuestions, 25);
  const cleanShortChoiceNote = (input.shortChoiceNote ?? '').trim().slice(0, 200);
  const cleanLongChoiceNote = (input.longChoiceNote ?? '').trim().slice(0, 200);
  const cleanPatternLabel = (input.patternLabel ?? '').trim().slice(0, 120);
  const cleanSectionATime =
    typeof input.sectionATimeMinutes === 'number' &&
    Number.isFinite(input.sectionATimeMinutes) &&
    input.sectionATimeMinutes >= 1
      ? Math.min(Math.max(Math.round(input.sectionATimeMinutes), 1), 120)
      : undefined;
  const cleanSchoolName = (input.schoolName ?? '').trim().slice(0, 140);
  const cleanExamLabel = (input.examLabel ?? '').trim().slice(0, 80);
  const cleanPaperDate = (input.paperDate ?? '').trim().slice(0, 40);
  const cleanScheduledEndAt = (input.scheduledEndAt ?? '').trim().slice(0, 64);
  const rawAllowedGrades = Array.isArray(input.allowedGrades)
    ? Array.from(new Set(input.allowedGrades.filter((g): g is GradeLevel => GRADES.includes(g))))
    : [];
  const cleanAllowedGrades: GradeLevel[] =
    rawAllowedGrades.length > 0 ? rawAllowedGrades.slice(0, 4) : [input.grade];
  const cleanMarks = Number(input.marksPerQuestion);
  const marksPerQuestion =
    Number.isFinite(cleanMarks) && cleanMarks >= 0.25 && cleanMarks <= 10
      ? Math.round(cleanMarks * 100) / 100
      : 1;
  const testDoc: MCQTest = {
    id,
    title: input.title.trim().slice(0, MAX_TITLE_LENGTH) || `${input.grade} ${input.subject} Assessment`,
    ...(input.board ? { board: input.board } : {}),
    ...(cleanSchoolName ? { schoolName: cleanSchoolName } : {}),
    ...(cleanExamLabel ? { examLabel: cleanExamLabel } : {}),
    ...(cleanPaperDate ? { paperDate: cleanPaperDate } : {}),
    grade: input.grade,
    subject: input.subject,
    topic: input.topic.trim().slice(0, MAX_TOPIC_LENGTH),
    difficulty: input.difficulty,
    durationMinutes: Math.min(Math.max(Math.round(input.durationMinutes), 1), 180),
    questionCount: cleanQuestions.length,
    marksPerQuestion,
    questions: cleanQuestions,
    ...(cleanShortQuestions.length > 0
      ? {
          shortQuestionCount: cleanShortQuestions.length,
          shortQuestions: cleanShortQuestions,
          ...(cleanShortChoiceNote ? { shortChoiceNote: cleanShortChoiceNote } : {}),
        }
      : {}),
    ...(cleanLongQuestions.length > 0
      ? {
          longQuestionCount: cleanLongQuestions.length,
          longQuestions: cleanLongQuestions,
          ...(cleanLongChoiceNote ? { longChoiceNote: cleanLongChoiceNote } : {}),
        }
      : {}),
    ...(cleanSectionATime ? { sectionATimeMinutes: cleanSectionATime } : {}),
    ...(cleanPatternLabel ? { patternLabel: cleanPatternLabel } : {}),
    deliveryMode: input.deliveryMode,
    isActive: input.isActive,
    scheduledReleaseAt: input.scheduledReleaseAt.trim().slice(0, 64),
    ...(cleanScheduledEndAt ? { scheduledEndAt: cleanScheduledEndAt } : {}),
    allowedGrades: cleanAllowedGrades,
    createdBy: input.createdBy,
    createdByName: input.createdByName.trim().slice(0, MAX_NAME_LENGTH) || 'Faculty',
    createdByRole: input.createdByRole,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'tests', id), testDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `tests/${id}`);
  }
  return testDoc;
}

export async function toggleTestActiveStatus(testId: string, isActive: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'tests', testId), {
      isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tests/${testId}`);
  }
}

export async function updateTestScheduleAndAccess(
  testId: string,
  patch: {
    isActive: boolean;
    scheduledReleaseAt: string;
    scheduledEndAt: string;
    allowedGrades: GradeLevel[];
    fallbackGrade: GradeLevel;
  },
): Promise<void> {
  const validGrades = Array.from(
    new Set(patch.allowedGrades.filter((g): g is GradeLevel => GRADES.includes(g))),
  );
  const safeAllowedGrades: GradeLevel[] =
    validGrades.length > 0 ? validGrades.slice(0, 4) : [patch.fallbackGrade];

  try {
    await updateDoc(doc(db, 'tests', testId), {
      isActive: patch.isActive,
      scheduledReleaseAt: patch.scheduledReleaseAt.trim().slice(0, 64),
      scheduledEndAt: patch.scheduledEndAt.trim().slice(0, 64),
      allowedGrades: safeAllowedGrades,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tests/${testId}`);
  }
}

export async function setTestClosingTime(
  testId: string,
  scheduledEndAtIso: string,
): Promise<void> {
  await updateDoc(doc(db, 'tests', testId), {
    scheduledEndAt: scheduledEndAtIso.trim().slice(0, 64),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTestDeliveryOverride(
  testId: string,
  deliveryMode: TestDeliveryOverride,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'tests', testId), {
      deliveryMode,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tests/${testId}`);
  }
}

export async function deleteMCQTest(testId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'tests', testId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tests/${testId}`);
  }
}

export async function submitTestAttempt(input: {
  test: MCQTest;
  studentId: string;
  studentName: string;
  studentIdentifier: string;
  answers: number[];
  shortAnswers?: string[];
  longAnswers?: string[];
  globalSettings: SystemSettings;
  autoCancelled?: boolean;
  terminationReason?: string;
}): Promise<TestAttempt> {
  const id = generateSafeId('attempt');
  const totalQuestions = input.test.questions.length;
  let score = 0;
  input.test.questions.forEach((q, idx) => {
    if (input.answers[idx] === q.correctIndex) {
      score += 1;
    }
  });
  const marksPerQuestion = input.test.marksPerQuestion ?? 1;
  const obtainedMarks = Math.round(score * marksPerQuestion * 100) / 100;
  const totalMarks = Math.round(totalQuestions * marksPerQuestion * 100) / 100;
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 1000) / 10 : 100;

  const cleanShortAnswers = (input.shortAnswers ?? [])
    .slice(0, input.test.shortQuestions?.length ?? 0)
    .map((ans) => String(ans ?? '').trim().slice(0, 2000));
  const cleanLongAnswers = (input.longAnswers ?? [])
    .slice(0, input.test.longQuestions?.length ?? 0)
    .map((ans) => String(ans ?? '').trim().slice(0, 5000));

  const effectiveMode: ResultMode =
    input.test.deliveryMode === 'inherit'
      ? input.globalSettings.resultMode
      : input.test.deliveryMode;

  const isInstant = effectiveMode === 'instant';
  const cleanTerminationReason = (input.terminationReason ?? '').trim().slice(0, 200);

  const attemptDoc: TestAttempt = {
    id,
    testId: input.test.id,
    testTitle: input.test.title.slice(0, MAX_TITLE_LENGTH),
    testCreatorId: input.test.createdBy,
    grade: input.test.grade,
    subject: input.test.subject,
    studentId: input.studentId,
    studentName: input.studentName.trim().slice(0, MAX_NAME_LENGTH) || 'Student',
    studentIdentifier: input.studentIdentifier.trim().slice(0, 64),
    answers: input.answers.slice(0, totalQuestions),
    ...(cleanShortAnswers.length > 0 ? { shortAnswers: cleanShortAnswers } : {}),
    ...(cleanLongAnswers.length > 0 ? { longAnswers: cleanLongAnswers } : {}),
    score,
    totalQuestions,
    marksPerQuestion,
    obtainedMarks,
    totalMarks,
    percentage,
    deliveryModeUsed: effectiveMode,
    resultReleased: isInstant,
    status: isInstant ? 'reviewed' : 'submitted',
    releasedBy: isInstant ? 'system_instant' : '',
    ...(input.autoCancelled ? { autoCancelled: true } : {}),
    ...(cleanTerminationReason ? { terminationReason: cleanTerminationReason } : {}),
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'attempts', id), attemptDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `attempts/${id}`);
  }
  return attemptDoc;
}

export async function releaseAttemptResult(attemptId: string, adminOrTeacherUid: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'attempts', attemptId), {
      resultReleased: true,
      status: 'reviewed',
      releasedBy: adminOrTeacherUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `attempts/${attemptId}`);
  }
}

export async function toggleAttemptAnswerKeyRelease(
  attemptId: string,
  allowed: boolean,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'attempts', attemptId), {
      answerKeyReleased: allowed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `attempts/${attemptId}`);
  }
}

export async function deleteTestAttempt(attemptId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'attempts', attemptId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `attempts/${attemptId}`);
  }
}

export async function updateAccountClass(input: {
  uid: string;
  grade: GradeLevel;
  adminUid: string;
}): Promise<void> {
  if (!isSingleStudentGrade(input.grade)) {
    throw new Error('Student accounts must be assigned to a single valid class.');
  }
  try {
    await updateDoc(doc(db, 'users', input.uid), {
      grade: input.grade,
      approvedBy: input.adminUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${input.uid}`);
  }
}

export async function updateAccountApproval(input: {
  uid: string;
  email: string;
  status: AccountStatus;
  role?: UserRole;
  grade?: GradeLevel;
  adminUid: string;
}): Promise<void> {
  const payload: Record<string, unknown> = {
    status: input.status,
    approvedBy: input.adminUid,
    updatedAt: serverTimestamp(),
  };
  if (input.role) {
    payload.role = input.role;
  }
  if (input.grade && isSingleStudentGrade(input.grade)) {
    payload.grade = input.grade;
  }

  try {
    await updateDoc(doc(db, 'users', input.uid), payload);
    if (input.role === 'admin' && input.status === 'approved') {
      const adminRef = doc(db, 'admins', input.uid);
      const adminSnap = await getDoc(adminRef);
      if (adminSnap.exists()) {
        await updateDoc(adminRef, {
          status: 'active',
          grantedBy: input.adminUid,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(adminRef, {
          uid: input.uid,
          email: input.email,
          grantedBy: input.adminUid,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${input.uid}`);
  }
}

export async function pauseOrResumeAdmin(input: {
  uid: string;
  email: string;
  pause: boolean;
  mainAdminUid: string;
}): Promise<void> {
  const nextUserStatus: AccountStatus = input.pause ? 'paused' : 'approved';
  const nextAdminStatus: 'active' | 'paused' = input.pause ? 'paused' : 'active';

  try {
    await updateDoc(doc(db, 'users', input.uid), {
      status: nextUserStatus,
      approvedBy: input.mainAdminUid,
      updatedAt: serverTimestamp(),
    });

    const adminRef = doc(db, 'admins', input.uid);
    const adminSnap = await getDoc(adminRef);
    if (adminSnap.exists()) {
      await updateDoc(adminRef, {
        status: nextAdminStatus,
        grantedBy: input.mainAdminUid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(adminRef, {
        uid: input.uid,
        email: input.email,
        grantedBy: input.mainAdminUid,
        status: nextAdminStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `admins/${input.uid}`);
  }
}

export async function revokeAdminAccess(input: {
  uid: string;
  mainAdminUid: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', input.uid), {
      role: 'teacher',
      status: 'rejected',
      approvedBy: input.mainAdminUid,
      updatedAt: serverTimestamp(),
    });
    const adminRef = doc(db, 'admins', input.uid);
    const adminSnap = await getDoc(adminRef);
    if (adminSnap.exists()) {
      await deleteDoc(adminRef);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${input.uid}`);
  }
}

export async function saveSystemSettings(
  settings: Omit<SystemSettings, 'updatedAt' | 'updatedBy'>,
  adminUid: string,
): Promise<void> {
  try {
    await setDoc(doc(db, 'systemSettings', 'global'), {
      ...settings,
      allowTeacherPaperCreation: settings.allowTeacherPaperCreation ?? true,
      allowStudentAnswerKeyReview: settings.allowStudentAnswerKeyReview ?? false,
      defaultTimeLimitMinutes: Math.min(Math.max(Math.round(settings.defaultTimeLimitMinutes), 1), 180),
      passingPercentage: Math.min(Math.max(Math.round(settings.passingPercentage), 1), 100),
      updatedBy: adminUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'systemSettings/global');
  }
}

export async function toggleTeacherPaperCreation(
  allowed: boolean,
  adminUid: string,
  currentSettings: SystemSettings,
): Promise<void> {
  await saveSystemSettings(
    {
      resultMode: currentSettings.resultMode,
      testAccessMode: currentSettings.testAccessMode,
      allowStudentInstantPractice: currentSettings.allowStudentInstantPractice,
      allowTeacherPaperCreation: allowed,
      allowStudentAnswerKeyReview: currentSettings.allowStudentAnswerKeyReview ?? false,
      defaultTimeLimitMinutes: currentSettings.defaultTimeLimitMinutes,
      passingPercentage: currentSettings.passingPercentage,
    },
    adminUid,
  );
}

export async function toggleStudentAnswerKeyReview(
  allowed: boolean,
  adminUid: string,
  currentSettings: SystemSettings,
): Promise<void> {
  await saveSystemSettings(
    {
      resultMode: currentSettings.resultMode,
      testAccessMode: currentSettings.testAccessMode,
      allowStudentInstantPractice: currentSettings.allowStudentInstantPractice,
      allowTeacherPaperCreation: currentSettings.allowTeacherPaperCreation ?? true,
      allowStudentAnswerKeyReview: allowed,
      defaultTimeLimitMinutes: currentSettings.defaultTimeLimitMinutes,
      passingPercentage: currentSettings.passingPercentage,
    },
    adminUid,
  );
}

export async function recordTeacherActivity(input: {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  action: TeacherActivityAction;
  paperTitle: string;
  grade: GradeLevel;
  subject: SubjectName;
  board?: ExamBoard;
  mcqCount: number;
  shortCount?: number;
  longCount?: number;
  testId?: string;
}): Promise<TeacherActivity | null> {
  const cleanEmail = input.teacherEmail.trim().slice(0, 200);
  if (!input.teacherId.trim() || cleanEmail.length < 3) {
    return null;
  }

  const id = generateSafeId('tact');
  const clampInt = (val: unknown, max: number) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return 0;
    return Math.min(Math.max(Math.round(n), 0), max);
  };

  const activityDoc: TeacherActivity = {
    id,
    teacherId: input.teacherId.trim().slice(0, 128),
    teacherName: input.teacherName.trim().slice(0, MAX_NAME_LENGTH) || 'Faculty',
    teacherEmail: cleanEmail,
    action: input.action,
    paperTitle:
      input.paperTitle.trim().slice(0, MAX_TITLE_LENGTH) ||
      `${input.grade} ${input.subject} Paper`,
    grade: input.grade,
    subject: input.subject,
    board: input.board === 'punjab_ptb' ? 'punjab_ptb' : 'fbise_nbf',
    mcqCount: clampInt(input.mcqCount, 200),
    shortCount: clampInt(input.shortCount ?? 0, 50),
    longCount: clampInt(input.longCount ?? 0, 25),
    testId: (input.testId ?? '').trim().slice(0, 128),
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'teacherActivities', id), activityDoc);
    return activityDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `teacherActivities/${id}`);
  }
}

export { collection };

