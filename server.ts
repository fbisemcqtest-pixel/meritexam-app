import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOOTSTRAPPED_ADMIN_EMAILS = [
  'meranamasimkhan@gmail.com',
  'shahzainandwalli@gmail.com',
  'fbisemcqtest@gmail.com',
];

function getFirebaseConfig() {
  const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (!fs.existsSync(cfgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as {
      projectId?: string;
      apiKey?: string;
      firestoreDatabaseId?: string;
    };
  } catch {
    return null;
  }
}

async function verifyAdminBearerToken(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const idToken = authHeader.slice(7).trim();
  if (!idToken) return false;

  const fbConfig = getFirebaseConfig();
  if (!fbConfig?.apiKey || !fbConfig?.projectId) return false;

  const lookupRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(fbConfig.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!lookupRes.ok) return false;
  const lookupData = (await lookupRes.json()) as {
    users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
  };
  const user = lookupData.users?.[0];
  if (!user?.localId || !user?.email || !user.emailVerified) return false;

  if (BOOTSTRAPPED_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return true;
  }

  const dbId = fbConfig.firestoreDatabaseId || '(default)';
  const adminDocRes = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(fbConfig.projectId)}/databases/${encodeURIComponent(dbId)}/documents/admins/${encodeURIComponent(user.localId)}`,
    {
      headers: { Authorization: `Bearer ${idToken}` },
    },
  );
  if (!adminDocRes.ok) return false;
  try {
    const adminDocData = (await adminDocRes.json()) as {
      fields?: { status?: { stringValue?: string } };
    };
    if (adminDocData.fields?.status?.stringValue === 'paused') {
      return false;
    }
  } catch {
    // If parsing fails, treat conservatively
    return false;
  }
  return true;
}

function addDirectoryToZip(zip: JSZip, baseDir: string, currentDir: string) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === 'build' ||
      entry.name === '.git' ||
      entry.name === '.DS_Store' ||
      entry.name === 'bun.lock' ||
      entry.name.endsWith('.log')
    ) {
      continue;
    }

    if (entry.name.startsWith('.env') && entry.name !== '.env.example') {
      continue;
    }

    if (relPath === 'public/assets/aistudio' || relPath.startsWith('public/assets/aistudio/')) {
      continue;
    }

    if (entry.isDirectory()) {
      addDirectoryToZip(zip, baseDir, fullPath);
    } else if (entry.isFile()) {
      zip.file(relPath, fs.readFileSync(fullPath));
    }
  }
}

const VALID_GRADES = ['9th', '10th', '1st A', '2nd Year'] as const;
const VALID_SUBJECTS = [
  'Physics',
  'Chemistry',
  'Biology',
  'Math',
  'Computer Science',
  'English',
  'Urdu',
  'Islamiat',
  'Pakistan Studies',
  'General Science',
  'General Math',
  'Civics',
  'Economics',
  'Education',
  'Islamic Studies',
  'History',
  'Geography',
  'Sociology',
  'Psychology',
  'Home Economics',
] as const;
const VALID_DIFFICULTIES = ['Standard', 'Conceptual', 'Board Exam'] as const;

type GradeOption = (typeof VALID_GRADES)[number];
type SubjectOption = (typeof VALID_SUBJECTS)[number];
type DifficultyOption = (typeof VALID_DIFFICULTIES)[number];

interface GeneratedQuestion {
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  topicTag: string;
}

interface GeneratedSubjectiveQuestion {
  prompt: string;
  suggestedAnswer: string;
  marks: number;
  topicTag: string;
  orPrompt?: string;
  orSuggestedAnswer?: string;
}

function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/mcq/generate', async (req, res) => {
    try {
      const body = req.body ?? {};
      const grade = body.grade as GradeOption;
      const subject = body.subject as SubjectOption;
      const difficulty = (VALID_DIFFICULTIES.includes(body.difficulty)
        ? body.difficulty
        : 'Standard') as DifficultyOption;
      const rawTopic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 500) : '';

      const rawCount = body.questionCount === undefined ? 10 : Number(body.questionCount);
      const questionCount = Number.isInteger(rawCount)
        ? Math.min(Math.max(rawCount, 0), 50)
        : 10;

      const rawShortCount = Number(body.shortQuestionCount);
      const shortQuestionCount = Number.isInteger(rawShortCount)
        ? Math.min(Math.max(rawShortCount, 0), 25)
        : 0;

      const rawLongCount = Number(body.longQuestionCount);
      const longQuestionCount = Number.isInteger(rawLongCount)
        ? Math.min(Math.max(rawLongCount, 0), 15)
        : 0;

      const includeShortOr = body.includeShortOr === true;
      const includeLongOr = body.includeLongOr === true;

      const rawShortMarks = Number(body.shortMarks);
      const shortMarks = Number.isFinite(rawShortMarks) && rawShortMarks >= 1 && rawShortMarks <= 10
        ? Math.round(rawShortMarks * 100) / 100
        : 3;

      const rawLongMarks = Number(body.longMarks);
      const longMarks = Number.isFinite(rawLongMarks) && rawLongMarks >= 1 && rawLongMarks <= 25
        ? Math.round(rawLongMarks * 100) / 100
        : 8;

      if (!VALID_GRADES.includes(grade)) {
        res.status(400).json({ error: 'Invalid grade. Choose 9th, 10th, 1st A, or 2nd Year.' });
        return;
      }
      if (!VALID_SUBJECTS.includes(subject)) {
        res.status(400).json({ error: 'Invalid subject selected for FBISE / NBF curriculum.' });
        return;
      }
      if (questionCount + shortQuestionCount + longQuestionCount < 1) {
        res.status(400).json({ error: 'Please request at least 1 MCQ, Short Question, or Long Question.' });
        return;
      }

      const ai = getGenAIClient();

      const board = body.board === 'punjab_ptb' ? 'punjab_ptb' : 'fbise_nbf';
      const isPunjab = board === 'punjab_ptb';

      const gradeCurriculumLabel = isPunjab
        ? grade === '9th'
          ? '9th Class (SSC-I — Punjab Board BISE / Punjab Textbook Board PTB)'
          : grade === '10th'
            ? '10th Class (SSC-II — Punjab Board BISE / Punjab Textbook Board PTB)'
            : grade === '1st A'
              ? '11th Class / 1st Year (HSSC-I — Punjab Board BISE / Punjab Textbook Board PTB Book I & III)'
              : '12th Class / 2nd Year (HSSC-II — Punjab Board BISE / Punjab Textbook Board PTB Book II & Mr. Chips)'
        : grade === '9th'
          ? '9th Class (SSC-I — Federal Board FBISE / National Book Foundation NBF)'
          : grade === '10th'
            ? '10th Class (SSC-II — Federal Board FBISE / National Book Foundation NBF)'
            : grade === '1st A'
              ? '1st Year / 1st A (HSSC-I — Federal Board FBISE / National Book Foundation NBF)'
              : '2nd Year (HSSC-II — Federal Board FBISE / National Book Foundation NBF)';

      const rawSelectedChapters = Array.isArray(body.selectedChapters)
        ? body.selectedChapters
            .filter((item: unknown): item is string => typeof item === 'string')
            .map((item: string) => item.trim().slice(0, 120))
            .filter((item: string) => item.length > 0)
            .slice(0, 30)
        : [];

      const rawSyllabusChapters = Array.isArray(body.syllabusChapters)
        ? body.syllabusChapters
            .filter((item: unknown): item is string => typeof item === 'string')
            .map((item: string) => item.trim().slice(0, 120))
            .filter((item: string) => item.length > 0)
            .slice(0, 30)
        : [];

      const boardShortName = isPunjab
        ? 'Punjab Board (BISE / PTB - PCTB)'
        : 'Federal Board (FBISE / NBF)';

      const nbfChaptersClause =
        rawSyllabusChapters.length > 0
          ? `Official ${boardShortName} Units for ${grade} ${subject} (use ONLY these units): ${rawSyllabusChapters.join(' | ')}.`
          : '';

      const topicClause =
        rawSelectedChapters.length > 0
          ? `SELECTED CHAPTERS ONLY (${rawSelectedChapters.length} units selected from ${boardShortName}): Generate questions ONLY from these selected chapters/units and distribute questions evenly across ALL of them: ${rawSelectedChapters.join(' | ')}.${rawTopic ? ` Additional focus note: "${rawTopic}".` : ''}`
          : rawTopic
            ? `Focus specifically on the ${boardShortName} unit or topic: "${rawTopic}".`
            : `Cover high-yield units ONLY from the official ${boardShortName} textbook for ${gradeCurriculumLabel} ${subject}.`;

      const rawAvoidPrompts = Array.isArray(body.avoidPrompts)
        ? body.avoidPrompts
            .filter((item: unknown): item is string => typeof item === 'string')
            .map((item: string) => item.trim().slice(0, 120))
            .filter((item: string) => item.length > 0)
            .slice(0, 60)
        : [];

      const avoidClause =
        rawAvoidPrompts.length > 0
          ? `Do NOT repeat or paraphrase any of these already-generated questions: ${rawAvoidPrompts.join(' | ')}`
          : '';

      const languageRule =
        subject === 'Urdu'
          ? `IMPORTANT: Because the subject is Urdu, write EVERY MCQ, option, short question, long question, and model answer in clean, accurate Urdu script (اردو) aligned with the ${boardShortName} Urdu textbook.`
          : `Ensure accurate ${boardShortName} textbook facts, dates, definitions, authors, or formulas for both Science and Arts/Humanities streams.`;

      const subjectStyleRule =
        subject === 'Physics' ||
        subject === 'Chemistry' ||
        subject === 'Biology' ||
        subject === 'Computer Science' ||
        subject === 'General Science'
          ? `SUBJECT PAPER STYLE (${grade} ${subject}): Match authentic ${boardShortName} SLO-based model papers — Section-B short questions must test conceptual reasoning, definitions/laws with formulas or biological mechanisms, and short calculations/code/diagrams; Section-C long questions (${longMarks} marks) should follow the board two-part or structured style (e.g. "(a) ... (b) ..." combining theory/mechanism with analytical, numerical, or application sub-parts when appropriate).`
          : subject === 'Math' || subject === 'General Math'
            ? `SUBJECT PAPER STYLE (${grade} ${subject}): Match authentic ${boardShortName} model papers — include exact equations/proofs/theorems and multi-step numerical/algebraic problem solving appropriate for ${longMarks}-mark Section-C questions and ${shortMarks}-mark Section-B parts.`
            : subject === 'English'
              ? `SUBJECT PAPER STYLE (${grade} ${subject}): Match authentic ${boardShortName} model papers — MCQs on vocabulary, grammar, and textual comprehension; Section-B short parts on reading/stanza comprehension, literary devices, and grammar; Section-C long questions (${longMarks} marks) on structured composition (essay, formal letter/application, report, or critical literary analysis).`
              : subject === 'Urdu'
                ? `SUBJECT PAPER STYLE (${grade} ${subject}): Match authentic ${boardShortName} Urdu model papers — write all stems in Urdu script covering حصہ معروضی (معروضی سوالات), حصہ دوم مختصر سوالات / تشریح اشعار و نثر / قواعد, and حصہ سوم مضمون، خط/درخواست یا تفصیلی سوالات.`
                : subject === 'Islamiat' || subject === 'Islamic Studies' || subject === 'Pakistan Studies'
                  ? `SUBJECT PAPER STYLE (${grade} ${subject}): Match authentic ${boardShortName} model papers — base Section-B short parts on concise SLO concepts, Quranic/Hadith or historical/constitutional points, and Section-C long questions (${longMarks} marks) on comprehensive analytical answers.`
                  : `SUBJECT PAPER STYLE (${grade} ${subject}): Match authentic ${boardShortName} Arts & Humanities model papers with precise concepts in Section-B and structured ${longMarks}-mark analytical essays in Section-C.`;

      const boardLockRule = isPunjab
        ? 'STRICT SYLLABUS LOCK (PUNJAB BOARD PTB / PCTB / PECTAA ONLY): Use ONLY the official Punjab Curriculum and Textbook Board (PTB / PCTB / PECTAA) textbooks prescribed by Punjab BISE Boards (Lahore, Rawalpindi, Multan, Gujranwala, Faisalabad, Sargodha, Bahawalpur). Follow ONLY the Punjab Board unit sequence provided in syllabusChapters across Sciences (Physics, Chemistry, Biology, Math, Computer Science), Compulsory subjects (English, Urdu, Islamiat, Pakistan Studies), and Arts/Humanities. For 11th/1st Year English use Book I & Book III Plays/Poems; for 12th English use Book II & Goodbye Mr. Chips; for 10th Computer Science use C Language; for 9th Computer Science use Computer Science & Entrepreneurship; for 11th/12th Computer Science use PTB IT/Database & C Language. NEVER use Federal Board National Book Foundation (NBF) chapters.'
        : 'STRICT SYLLABUS LOCK (FEDERAL BOARD NBF ONLY): Use ONLY the new National Book Foundation (NBF / FBISE Islamabad) SLO-based textbook units. NEVER generate questions from Punjab Textbook Board (PTB / PCTB), Sindh Board, or old pre-SNC syllabi (for example, in 11th/1st Year English NEVER use "Button, Button", "Clearing in the Sky", "Dark They Were", "Responsibilities of Youth", "His First Flight", "Good Timber", or "Mr. Chips" — use ONLY the official NBF units like Family Values in Pakistan, Shooting Stars, The Wind, Butterflies, Clean Water and Sanitation, The Darkling Thrush, World Heritage Sites in Pakistan, Social Media, Sunshine After Rain, The Small Woman, The Three Questions, Break Break Break, Blow Blow Thou Winter Wind, Choice of a Profession, The Ninny, Fourteen, The Last Leaf).';

      const sectionRequirements: string[] = [];
      if (questionCount > 0) {
        sectionRequirements.push(
          `- "questions": Generate exactly ${questionCount} rigorous exam MCQs, each with 4 distinct options (without "A)" prefix), accurate correctIndex (0-3), 1-2 sentence explanation, and topicTag.`,
        );
      } else {
        sectionRequirements.push('- "questions": Return an empty array [].');
      }

      if (shortQuestionCount > 0) {
        sectionRequirements.push(
          includeShortOr
            ? `- "shortQuestions": Generate exactly ${shortQuestionCount} ${boardShortName} Short Answer Questions (${shortMarks} marks each, concise 3–5 line textbook answer expected). For EVERY short question, provide BOTH a primary "prompt" (with "suggestedAnswer") AND a distinct alternative "orPrompt" (with "orSuggestedAnswer") from the syllabus so students get an "OR" (ya yeh / ya woh) choice on each question, plus "topicTag".`
            : `- "shortQuestions": Generate exactly ${shortQuestionCount} ${boardShortName} Short Answer Questions (${shortMarks} marks each, concise 3–5 line textbook answer expected), with a clear "prompt", concise marking-scheme "suggestedAnswer", and "topicTag".`,
        );
      } else {
        sectionRequirements.push('- "shortQuestions": Return an empty array [].');
      }

      if (longQuestionCount > 0) {
        sectionRequirements.push(
          includeLongOr
            ? `- "longQuestions": Generate exactly ${longQuestionCount} ${boardShortName} Board-standard Long / Descriptive Questions (${longMarks} marks each, detailed analytical, numerical, or essay question). For EVERY long question, provide BOTH a primary "prompt" (with "suggestedAnswer") AND a distinct alternative "orPrompt" (with "orSuggestedAnswer") from the syllabus so students get an "OR" (ya yeh / ya woh) choice on each question, plus "topicTag".`
            : `- "longQuestions": Generate exactly ${longQuestionCount} ${boardShortName} Board-standard Long / Descriptive Questions (${longMarks} marks each, detailed analytical, numerical, or essay question), with a clear "prompt", structured marking-points "suggestedAnswer", and "topicTag".`,
        );
      } else {
        sectionRequirements.push('- "longQuestions": Return an empty array [].');
      }

      const prompt = [
        `Create a structured assessment paper strictly aligned with the ${boardShortName} textbook curriculum:`,
        `- Examination Board & Textbook: ${boardShortName}`,
        `- Academic Level: ${gradeCurriculumLabel}`,
        `- Subject: ${subject}`,
        `- Difficulty Tier: ${difficulty}`,
        `- Syllabus Focus: ${topicClause}`,
        ...(nbfChaptersClause ? [`- ${nbfChaptersClause}`] : []),
        '',
        'Required Paper Sections:',
        ...sectionRequirements,
        '',
        'Quality Rules:',
        `1. Align terminology, formulas, units, definitions, dates, and concepts strictly with the ${boardShortName} textbook.`,
        '2. Avoid ambiguous "All of the above" or "None of the above" MCQ options unless strictly appropriate.',
        `3. ${languageRule}`,
        `4. ${subjectStyleRule}`,
        `5. ${boardLockRule}`,
        ...(avoidClause ? [`6. ${avoidClause}`] : []),
      ].join('\n');

      const systemInstruction = isPunjab
        ? 'You are a senior Punjab Board (BISE Lahore / Rawalpindi) paper setter specializing in Punjab Textbook Board (PTB / PCTB) textbooks across Sciences, Compulsory subjects, and Arts/Humanities for 9th, 10th, 1st Year (11th), and 2nd Year (12th). Return strictly valid JSON matching the schema.'
        : 'You are a senior Federal Board (FBISE, Islamabad) paper setter specializing in National Book Foundation (NBF) SLO-based textbooks across Sciences, Compulsory subjects, and Arts/Humanities for 9th (SSC-I), 10th (SSC-II), 1st Year / 1st A (HSSC-I), and 2nd Year (HSSC-II). Return strictly valid JSON matching the schema.';

      const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'] as const;
      let response;
      let lastApiErr: unknown = null;
      for (const modelName of modelsToTry) {
        let succeeded = false;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                ...(modelName === 'gemini-4-hydrogen'
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : {}),
                systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  suggestedTitle: {
                    type: Type.STRING,
                    description: 'Concise descriptive assessment title (max 100 characters).',
                  },
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        prompt: {
                          type: Type.STRING,
                          description: 'The MCQ stem.',
                        },
                        options: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                          description: 'Exactly 4 answer choices.',
                        },
                        correctIndex: {
                          type: Type.INTEGER,
                          description: 'Zero-based index (0 to 3) of the correct option.',
                        },
                        explanation: {
                          type: Type.STRING,
                          description: 'Brief academic explanation for the correct answer.',
                        },
                        topicTag: {
                          type: Type.STRING,
                          description: 'Chapter or topic name.',
                        },
                      },
                      required: ['prompt', 'options', 'correctIndex', 'explanation', 'topicTag'],
                    },
                  },
                  shortQuestions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        prompt: {
                          type: Type.STRING,
                          description: 'Short answer question prompt.',
                        },
                        suggestedAnswer: {
                          type: Type.STRING,
                          description: 'Concise model answer / rubric (3-5 lines).',
                        },
                        ...(includeShortOr
                          ? {
                              orPrompt: {
                                type: Type.STRING,
                                description: 'Distinct alternative OR short question prompt.',
                              },
                              orSuggestedAnswer: {
                                type: Type.STRING,
                                description: 'Concise model answer for the OR alternative short question.',
                              },
                            }
                          : {}),
                        topicTag: {
                          type: Type.STRING,
                          description: 'Chapter or topic name.',
                        },
                      },
                      required: includeShortOr
                        ? ['prompt', 'suggestedAnswer', 'orPrompt', 'orSuggestedAnswer', 'topicTag']
                        : ['prompt', 'suggestedAnswer', 'topicTag'],
                    },
                  },
                  longQuestions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        prompt: {
                          type: Type.STRING,
                          description: 'Long / descriptive question prompt.',
                        },
                        suggestedAnswer: {
                          type: Type.STRING,
                          description: 'Structured key points / solution outline.',
                        },
                        ...(includeLongOr
                          ? {
                              orPrompt: {
                                type: Type.STRING,
                                description: 'Distinct alternative OR long/descriptive question prompt.',
                              },
                              orSuggestedAnswer: {
                                type: Type.STRING,
                                description: 'Structured key points for the OR alternative long question.',
                              },
                            }
                          : {}),
                        topicTag: {
                          type: Type.STRING,
                          description: 'Chapter or topic name.',
                        },
                      },
                      required: includeLongOr
                        ? ['prompt', 'suggestedAnswer', 'orPrompt', 'orSuggestedAnswer', 'topicTag']
                        : ['prompt', 'suggestedAnswer', 'topicTag'],
                    },
                  },
                },
                required: ['suggestedTitle', 'questions', 'shortQuestions', 'longQuestions'],
              },
            },
            });
            succeeded = true;
            break;
          } catch (apiErr) {
            lastApiErr = apiErr;
            const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
            const isQuotaOrRate =
              msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
            const isTransient =
              msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand');
            if (isQuotaOrRate) {
              break;
            }
            if (isTransient) {
              if (modelName === 'gemini-3.1-flash-lite' && attempt === 0) {
                await new Promise((r) => setTimeout(r, 500));
                continue;
              }
              break;
            }
            throw apiErr;
          }
        }
        if (succeeded && response) break;
      }
      if (!response) {
        const lastMsg = lastApiErr instanceof Error ? lastApiErr.message : String(lastApiErr ?? '');
        if (lastMsg.includes('429') || lastMsg.includes('RESOURCE_EXHAUSTED') || lastMsg.includes('quota')) {
          res.status(429).json({
            error:
              'Daily AI free-tier request limit reached temporarily. Please wait a little while and try again, or add questions manually below.',
          });
          return;
        }
        res.status(503).json({
          error:
            'Google AI servers are temporarily busy (high demand). Please wait 15–30 seconds and click Generate again, or add questions manually below.',
        });
        return;
      }

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Model returned an empty response.' });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        suggestedTitle?: string;
        questions?: Array<{
          prompt?: string;
          options?: string[];
          correctIndex?: number;
          explanation?: string;
          topicTag?: string;
        }>;
        shortQuestions?: Array<{
          prompt?: string;
          suggestedAnswer?: string;
          orPrompt?: string;
          orSuggestedAnswer?: string;
          topicTag?: string;
        }>;
        longQuestions?: Array<{
          prompt?: string;
          suggestedAnswer?: string;
          orPrompt?: string;
          orSuggestedAnswer?: string;
          topicTag?: string;
        }>;
      };

      const sanitizedQuestions: GeneratedQuestion[] = questionCount > 0
        ? (parsed.questions ?? [])
            .slice(0, questionCount)
            .filter((q) => typeof q.prompt === 'string' && Array.isArray(q.options) && q.options.length >= 4)
            .map((q) => {
              const opts = q.options!.slice(0, 4).map((opt) => String(opt).trim().slice(0, 300)) as [
                string,
                string,
                string,
                string,
              ];
              const idx = Number.isInteger(q.correctIndex) && q.correctIndex! >= 0 && q.correctIndex! <= 3
                ? q.correctIndex!
                : 0;
              return {
                prompt: String(q.prompt).trim().slice(0, 800),
                options: opts,
                correctIndex: idx,
                explanation: String(q.explanation ?? 'Verified curriculum answer.').trim().slice(0, 600),
                topicTag: String(q.topicTag ?? subject).trim().slice(0, 80),
              };
            })
        : [];

      const sanitizedShortQuestions: GeneratedSubjectiveQuestion[] = shortQuestionCount > 0
        ? (parsed.shortQuestions ?? [])
            .slice(0, shortQuestionCount)
            .filter((q) => typeof q.prompt === 'string' && q.prompt.trim().length > 0)
            .map((q) => {
              const orPrompt = typeof q.orPrompt === 'string' ? q.orPrompt.trim().slice(0, 800) : '';
              const orSuggestedAnswer = typeof q.orSuggestedAnswer === 'string'
                ? q.orSuggestedAnswer.trim().slice(0, 1200)
                : '';
              return {
                prompt: String(q.prompt).trim().slice(0, 800),
                suggestedAnswer: String(q.suggestedAnswer ?? 'Refer to textbook explanation.').trim().slice(0, 1200),
                marks: shortMarks,
                topicTag: String(q.topicTag ?? subject).trim().slice(0, 80),
                ...(orPrompt ? { orPrompt } : {}),
                ...(orPrompt && orSuggestedAnswer ? { orSuggestedAnswer } : {}),
              };
            })
        : [];

      const sanitizedLongQuestions: GeneratedSubjectiveQuestion[] = longQuestionCount > 0
        ? (parsed.longQuestions ?? [])
            .slice(0, longQuestionCount)
            .filter((q) => typeof q.prompt === 'string' && q.prompt.trim().length > 0)
            .map((q) => {
              const orPrompt = typeof q.orPrompt === 'string' ? q.orPrompt.trim().slice(0, 1200) : '';
              const orSuggestedAnswer = typeof q.orSuggestedAnswer === 'string'
                ? q.orSuggestedAnswer.trim().slice(0, 2400)
                : '';
              return {
                prompt: String(q.prompt).trim().slice(0, 1200),
                suggestedAnswer: String(q.suggestedAnswer ?? 'Refer to textbook detailed answer.').trim().slice(0, 2400),
                marks: longMarks,
                topicTag: String(q.topicTag ?? subject).trim().slice(0, 80),
                ...(orPrompt ? { orPrompt } : {}),
                ...(orPrompt && orSuggestedAnswer ? { orSuggestedAnswer } : {}),
              };
            })
        : [];

      if (
        sanitizedQuestions.length === 0 &&
        sanitizedShortQuestions.length === 0 &&
        sanitizedLongQuestions.length === 0
      ) {
        res.status(502).json({ error: 'Failed to generate valid questions. Please try again.' });
        return;
      }

      const fallbackTitle = rawTopic
        ? `${grade} ${subject} — ${rawTopic}`
        : `${grade} ${subject} (${difficulty})`;

      res.json({
        title: (parsed.suggestedTitle || fallbackTitle).trim().slice(0, 140),
        questions: sanitizedQuestions,
        shortQuestions: sanitizedShortQuestions,
        longQuestions: sanitizedLongQuestions,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate paper.';
      console.error('Paper generation error:', err);
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/admin/export-zip', async (req, res) => {
    try {
      const isAdmin = await verifyAdminBearerToken(req.headers.authorization);
      if (!isAdmin) {
        res.status(403).json({ error: 'Administrator authorization required.' });
        return;
      }

      const zip = new JSZip();
      addDirectoryToZip(zip, __dirname, __dirname);
      const buffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="meritexam-fbise-nbf.zip"');
      res.send(buffer);
    } catch (err) {
      console.error('Export ZIP error:', err);
      res.status(500).json({ error: 'Failed to create project ZIP archive.' });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`MeritExam server listening on port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
