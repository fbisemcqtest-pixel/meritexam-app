import {
  collection,
  deleteDoc,
  doc,
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
  TestAttempt,
  TestDeliveryOverride,
  UserRole,
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
  shortMarks?: number;
  longMarks?: number;
}

export interface GenerateMCQResponse {
  title: string;
  questions: MCQQuestion[];
  shortQuestions: SubjectiveQuestion[];
  longQuestions: SubjectiveQuestion[];
}

async function requestGenerateEndpoint(
  url: string,
  req: GenerateMCQRequest,
): Promise<{ kind: 'json'; status: number; ok: boolean; data: GenerateMCQResponse & { error?: string } } | { kind: 'html'; status: number }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(req),
  });

  const rawText = await response.text();
  const trimmed = rawText.trim();

  if (trimmed.startsWith('<')) {
    return { kind: 'html', status: response.status };
  }

  let parsed: (GenerateMCQResponse & { error?: string }) | null = null;
  try {
    parsed = JSON.parse(rawText) as GenerateMCQResponse & { error?: string };
  } catch {
    throw new Error(
      `Server returned an invalid response (HTTP ${response.status}). Please try again.`,
    );
  }

  return {
    kind: 'json',
    status: response.status,
    ok: response.ok,
    data: parsed,
  };
}

export async function generateMCQsFromServer(
  req: GenerateMCQRequest,
): Promise<GenerateMCQResponse> {
  let result = await requestGenerateEndpoint('/api/mcq/generate', req);

  if (result.kind === 'html') {
    const netlifyFallback = await requestGenerateEndpoint(
      '/.netlify/functions/generate-mcq',
      req,
    );
    if (netlifyFallback.kind === 'json') {
      result = netlifyFallback;
    } else {
      throw new Error(
        'Live hosting did not route /api/mcq/generate to the backend (received HTML instead of JSON). If you deployed only static files (e.g. Firebase Hosting or drag-and-drop dist), serverless API routes are inactive—deploy the full GitHub repo on Netlify/Vercel with GEMINI_API_KEY, or add questions manually below.',
      );
    }
  }

  if (!result.ok) {
    throw new Error(
      result.data.error || `Failed to generate paper from server (HTTP ${result.status}).`,
    );
  }

  return {
    title: result.data.title,
    questions: Array.isArray(result.data.questions) ? result.data.questions : [],
    shortQuestions: Array.isArray(result.data.shortQuestions) ? result.data.shortQuestions : [],
    longQuestions: Array.isArray(result.data.longQuestions) ? result.data.longQuestions : [],
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
  deliveryMode: TestDeliveryOverride;
  isActive: boolean;
  scheduledReleaseAt: string;
  createdBy: string;
  createdByName: string;
  createdByRole: 'teacher' | 'admin' | 'student_practice';
}): Promise<MCQTest> {
  const id = generateSafeId('test');
  const cleanQuestions = input.questions.slice(0, 50);
  const cleanShortQuestions = (input.shortQuestions ?? []).slice(0, 30);
  const cleanLongQuestions = (input.longQuestions ?? []).slice(0, 15);
  const cleanSchoolName = (input.schoolName ?? '').trim().slice(0, 140);
  const cleanExamLabel = (input.examLabel ?? '').trim().slice(0, 80);
  const cleanPaperDate = (input.paperDate ?? '').trim().slice(0, 40);
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
        }
      : {}),
    ...(cleanLongQuestions.length > 0
      ? {
          longQuestionCount: cleanLongQuestions.length,
          longQuestions: cleanLongQuestions,
        }
      : {}),
    deliveryMode: input.deliveryMode,
    isActive: input.isActive,
    scheduledReleaseAt: input.scheduledReleaseAt.trim().slice(0, 64),
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

export async function updateAccountApproval(input: {
  uid: string;
  email: string;
  status: AccountStatus;
  role?: UserRole;
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

  try {
    await updateDoc(doc(db, 'users', input.uid), payload);
    if (input.role === 'admin' && input.status === 'approved') {
      await setDoc(doc(db, 'admins', input.uid), {
        uid: input.uid,
        email: input.email,
        grantedBy: input.adminUid,
        createdAt: serverTimestamp(),
      });
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
      defaultTimeLimitMinutes: Math.min(Math.max(Math.round(settings.defaultTimeLimitMinutes), 1), 180),
      passingPercentage: Math.min(Math.max(Math.round(settings.passingPercentage), 1), 100),
      updatedBy: adminUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'systemSettings/global');
  }
}

export { collection };
