import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, FileText, Globe, Languages, X } from 'lucide-react';

interface PlatformBrochureModalProps {
  onClose: () => void;
}

type BrochureLang = 'bilingual' | 'english' | 'urdu';

const ENGLISH_BROCHURE = `====================================================================
MERITEXAM — SMART BOARD EXAMINATION & ONLINE TESTING PLATFORM
(Federal Board FBISE / NBF · Punjab Board BISE / PTB · APSACS)
====================================================================

📌 OVERVIEW
MeritExam is a complete, cloud-powered school and college examination management system designed for Pakistani Board curricula. It unifies AI-assisted official board paper generation, printable Word/PDF exam creation (with OMR bubble sheets & crests), strict anti-cheat online student testing, and automated cumulative student record management—all under centralized Administrator governance.

--------------------------------------------------------------------
1. SUPPORTED CLASSES, BOARDS & BOOKS
--------------------------------------------------------------------
• 4 Academic Classes: 9th (SSC-I), 10th (SSC-II), 1st Year / 1st A (HSSC-I), and 2nd Year (HSSC-II)
• 20 Complete Textbooks Across All Streams:
  - Sciences: Physics, Chemistry, Biology, Mathematics, Computer Science
  - Compulsory: English, Urdu, Islamiat, Pakistan Studies, General Science
  - Arts & Humanities: General Math, Civics, Economics, Education, Islamic Studies, History, Geography, Sociology, Psychology, Home Economics
• Curriculum Alignment:
  - Federal Board (FBISE · National Book Foundation — NBF) with official Assessment Framework chapter filtering (automatically excluding non-examined practical-only chapters for summative papers)
  - Punjab Board (BISE · Punjab Textbook Board — PTB / PCTB)

--------------------------------------------------------------------
2. OFFICIAL BOARD PAPER PATTERNS & PRINT / EXPORT STUDIO
--------------------------------------------------------------------
• 3 Authentic Examination Pattern Tracks (Shared by FBISE & APSACS):
  1) New 50/50 Reformed Scheme (2026–27)
  2) Inclusive Scheme 2024
  3) Legacy Scheme 2006
• 3 Customizable First-Page Header & Logo Styles:
  - FBISE Official Board Header (OMR Answer Sheet + Version/Roll No. bubbles + Board Seal)
  - APSACS Monogram & First Page (Circular APSACS crest + customizable school logo upload)
  - Standard School / Academy Header
• Complete 3-Section Paper Builder:
  - Section A: Objective MCQs (4 options A/B/C/D + Answer Key)
  - Section B: Short Answer Questions (with internal OR choices & attempt instructions)
  - Section C: Long / Descriptive Questions (with internal OR choices & mark distribution)
• Full Question Editing & One-Click Export:
  - Edit any generated question, option, or mark before publishing
  - Direct Print Preview, PDF Download, and Editable Microsoft Word (.docx) Export

--------------------------------------------------------------------
3. THREE DEDICATED ROLE PORTALS & SECURITY GOVERNANCE
--------------------------------------------------------------------
🔹 A. ADMINISTRATOR CONTROL PORTAL
• Account Verification Queue: Approve, pause, or decline Teacher and Student registrations; appoint or pause Secondary Administrators (Main Admin account stays protected).
• Strict Single-Class Student Policy: Every student account belongs strictly to one enrolled class (9th, 10th, 1st A, or 2nd Year). Multi-class access is blocked for students.
• Instant Global Policy Controls:
  - Option 1 (Instant Mode): Release scores immediately upon submission.
  - Option 2 (Admin Controlled Mode): Hold results securely until Admin explicitly releases them.
  - Stop / Allow Teachers' Papers: One-click button to pause or enable teacher paper creation.
  - Allow / Lock Answer Key Review: One-click button (plus per-student controls) to permit or block students from viewing read-only Answer Keys of their given papers.
• Full Student Academic Record Modal: Click any student's name to view Total Tests, Tests Given, Not Given (Missed / Absent), Total Obtained / Possible Marks, Overall Percentage (%), and per-test MCQ breakdown (Attempted, Correct, Wrong, Left).
• Attendance & Results Analytics: Filter by Class, Test, and Present / Absent / Auto-Cancelled records, plus full project ZIP backup export.

🔹 B. TEACHER ASSESSMENT PORTAL
• Approved teachers create board-compliant MCQ and Subjective papers for their assigned classes/subjects, configure start/end schedules, print PDF/Word exam sheets, and track their students' test submissions.

🔹 C. STUDENT EXAMINATION PORTAL (ANTI-CHEAT & STRICT PRIVACY)
• Clean Upcoming Front Page: Displays ONLY upcoming exams (with live Days/Hours/Minutes/Seconds countdown timers) and currently open exams for the student's single enrolled class.
• Green Screen Lock Anti-Cheating System:
  - Enforces Fullscreen & Screen Wake Lock during active tests on Desktop, Laptop, and Mobile.
  - Switching tabs, minimizing the browser, or leaving the locked exam screen immediately auto-submits and cancels the paper, notifying the Admin (who can allow a Retake if needed).
• Zero Past-Paper Leakage: Once a paper is submitted, timed out, or cancelled by Screen Lock, the question paper disappears immediately from the student portal—no past question papers remain accessible. Only the student's Results & Record (Marks, Percentage, Attempted/Correct/Wrong/Left) are shown.
• Admin-Permitted Read-Only Answer Key View: Appears in a separate "Answer Key" tab ONLY when Admin grants permission, allowing students to see their right and wrong answers for papers they have already given—with solving/retaking completely disabled.

--------------------------------------------------------------------
4. CAPACITY, CONCURRENCY & SCALABILITY
--------------------------------------------------------------------
• Registered Users (Students & Teachers): Unlimited. Powered by Google Firebase Authentication & Cloud Firestore, supporting thousands of registered accounts across multiple campuses.
• Smart Single-Generation AI Efficiency: Papers are generated ONCE by the Teacher or Admin and stored in the cloud database. Even if 1,000+ students take the same exam together, the AI is called only once—zero per-student AI bottleneck.
• Simultaneous Students Taking Exams At Once:
  - Free Tier (Firebase Spark): Handles ~50,000 database reads & 20,000 writes/day — comfortably supporting roughly 300 to 1,000+ simultaneous student exam submissions per day.
  - Production Scale (Firebase Blaze): Scales automatically to 10,000+ concurrent students taking examinations at the exact same time across different classes and subjects.
• Parallel Exams Running At Once: Unlimited papers across all 4 classes and 20 subjects can be scheduled and conducted simultaneously without interference.
• Built-In Security Safeguards: Server-side timestamps (tamper-proof timers), Google-verified sign-in, strict Firestore role-based security rules, and real-time cloud synchronization.

--------------------------------------------------------------------
Platform Developer & Technical Contact:
Muhammad Asim Khan · Phone / WhatsApp: 0316-5552001
====================================================================`;

const URDU_BROCHURE = `====================================================================
MeritExam — اسمارٹ بورڈ ایگزامینیشن اور آن لائن ٹیسٹنگ ویب سائٹ
(Federal Board FBISE / NBF · Punjab Board BISE / PTB · APSACS)
====================================================================

📌 تعارف (Overview)
MeritExam ایک جدید، محفوظ اور مکمل کلاؤڈ بیسڈ اسکول و کالج امتحانی نظام ہے جو خاص طور پر پاکستانی تعلیمی بورڈز کے نصاب کے مطابق تیار کیا گیا ہے۔ اس پلیٹ فارم پر آفیشل بورڈ پیٹرن کے مطابق پرچہ جات کی تیاری، پرنٹ ایبل Word / PDF پیپرز (OMR ببل شیٹ اور مونوگرام کے ساتھ)، اینٹی چیٹ آن لائن امتحانات، اور ہر طالب علم کا مکمل تعلیمی ریکارڈ خودکار طریقے سے منظم ہوتا ہے۔

--------------------------------------------------------------------
1. شامل کلاسز، بورڈز اور کتابیں
--------------------------------------------------------------------
• 4 کلاسز: نہم (9th)، دہم (10th)، فرسٹ ایئر (1st A)، اور سیکنڈ ایئر (2nd Year)
• 20 مکمل کتابیں اور مضامین:
  - سائنس گروپ: Physics، Chemistry، Biology، Math، Computer Science
  - لازمی مضامین: English، Urdu، Islamiat، Pakistan Studies، General Science
  - آرٹس و ہیومینیٹیز: General Math، Civics، Economics، Education، Islamic Studies، History، Geography، Sociology، Psychology، Home Economics
• تعلیمی بورڈز:
  - فیڈرل بورڈ (FBISE · National Book Foundation — NBF) مع سرکاری Assessment Framework فلٹرنگ (یعنی وہ چیپٹرز جو بورڈ امتحان میں شامل نہیں، سالانہ پیپر بناتے وقت خودکار طور پر نکال دیے جاتے ہیں)
  - پنجاب بورڈ (BISE · Punjab Textbook Board — PTB / PCTB)

--------------------------------------------------------------------
2. آفیشل بورڈ پیپر پیٹرن اور پرنٹ / ایکسپورٹ سسٹم
--------------------------------------------------------------------
• 3 آفیشل پیٹرن ٹریکس (FBISE اور APSACS دونوں کے لیے یکساں):
  1) نیا 50/50 پیٹرن (2026–27)
  2) Inclusive Scheme 2024
  3) پرانی اسکیم 2006
• 3 فرسٹ پیج ہیڈر اور مونوگرام اسٹائلز:
  - FBISE آفیشل بورڈ ہیڈر (OMR ببل شیٹ، Version / Roll No. ببلز اور بورڈ مہر کے ساتھ)
  - APSACS آفیشل مونوگرام اور فرسٹ پیج (گول مونوگرام اور کسٹم لوگو اپ لوڈ سہولت کے ساتھ)
  - اسٹینڈرڈ اسکول / اکیڈمی ہیڈر
• مکمل 3 سیکشن پیپر جنریشن:
  - سیکشن A: معروضی سوالات (MCQs مع 4 آپشنز اور Answer Key)
  - سیکشن B: مختصر سوالات (OR چوائس اور Attempt Note کے ساتھ)
  - سیکشن C: تفصیلی / انشائیہ سوالات (OR چوائس اور نمبر کی تقسیم کے ساتھ)
• مکمل ایڈیٹنگ اور ایکسپورٹ:
  - کسی بھی سوال، آپشن یا نمبر کو پبلش کرنے سے پہلے تبدیل یا ایڈٹ کرنے کی سہولت
  - ایک کلک پر Print Preview، PDF ڈاؤن لوڈ اور Editable Microsoft Word (.docx) فائل ایکسپورٹ

--------------------------------------------------------------------
3. تین الگ الگ پورٹلز اور مکمل سکیورٹی کنٹرول
--------------------------------------------------------------------
🔹 الف) ایڈمن کنٹرول پینل (Administrator Portal)
• اکاؤنٹس کی تصدیق: اسٹوڈنٹس اور ٹیچرز کے اکاؤنٹس منظور (Approve)، معطل (Pause) یا مسترد (Decline) کرنے، اور نئے سیکنڈری ایڈمن مقرر کرنے کا مکمل اختیار (مین ایڈمن ہمیشہ محفوظ رہتا ہے)۔
• اسٹوڈنٹ کے لیے صرف ایک کلاس کی پابندی: ہر اسٹوڈنٹ صرف اپنی ایک مخصوص کلاس (9th، 10th، 1st A یا 2nd Year) میں رجسٹر اور لاگ ان ہو سکتا ہے۔ کوئی بھی طالب علم دیگر کلاسز کے پیپرز نہیں دیکھ سکتا۔
• ایڈمن پالیسی بٹنز:
  - Option 1 (Instant Mode): ٹیسٹ جمع ہوتے ہی فوراً نمبر اور رزلٹ ظاہر ہو۔
  - Option 2 (Admin Review Mode): رزلٹ روک لیا جائے اور صرف ایڈمن کی اجازت (Release) کے بعد اسٹوڈنٹ کو نظر آئے۔
  - Stop / Allow Teachers' Papers: ایک کلک سے ٹیچرز کا پیپر بنانا بند یا بحال کریں۔
  - Allow / Lock Answer Key Review: ایک کلک سے (یا کسی خاص اسٹوڈنٹ کے لیے الگ سے) دیے گئے پیپرز کی Read-Only انسر کی دیکھنے کی اجازت دیں یا بند کریں۔
• اسٹوڈنٹ کا مکمل ریکارڈ: کسی بھی اسٹوڈنٹ کے نام پر کلک کر کے کل ٹیسٹ، دیے گئے ٹیسٹ، نہ دیے گئے (غیر حاضر) ٹیسٹ، کل حاصل کردہ نمبر، مجموعی فیصد (%) اور ہر ٹیسٹ کے صحیح، غلط، کیے گئے اور چھوڑے گئے سوالات کی مکمل تفصیل دیکھیں۔
• حاضری اور رزلٹ فلٹرز: کلاس، ٹیسٹ اور Present / Absent / Cancelled کے لحاظ سے فلٹرنگ اور مکمل بیک اپ ڈاؤن لوڈ۔

🔹 ب) ٹیچر پورٹل (Teacher Portal)
• منظور شدہ اساتذہ اپنی کلاس اور مضمون کے مطابق پیپر بنا سکتے ہیں، ٹیسٹ کا وقت (Start / End Time) مقرر کر سکتے ہیں، Word/PDF پرنٹ نکال سکتے ہیں اور طلبہ کے نتائج دیکھ سکتے ہیں۔

🔹 ج) اسٹوڈنٹ پورٹل (انتہائی محفوظ اور اینٹی چیٹ نظام)
• صاف فرنٹ پیج: اسٹوڈنٹ کے ڈیش بورڈ پر صرف آنے والے ٹیسٹ (لائیو کاؤنٹ ڈاؤن ٹائمر کے ساتھ) اور اس وقت کھلے ہوئے ٹیسٹ ہی نظر آتے ہیں۔
• Green Screen Lock اینٹی چیٹنگ سسٹم:
  - ٹیسٹ شروع ہوتے ہی فل اسکرین اور اسکرین لاک آن ہو جاتا ہے (کمپیوٹر، لیپ ٹاپ اور موبائل سب پر کام کرتا ہے)۔
  - ٹیسٹ کے دوران کسی دوسری ایپ، ٹیب یا اسکرین پر جانے سے پیپر فوراً خودکار طور پر سبمٹ اور کینسل ہو جاتا ہے اور ایڈمن کو اطلاع مل جاتی ہے (ایڈمن چاہے تو Retake کی اجازت دے سکتا ہے)۔
• پیپر کی مکمل حفاظت: جیسے ہی اسٹوڈنٹ پیپر سبمٹ کرے، وقت ختم ہو، یا اسکرین لاک ٹوٹے، سوال نامہ فوراً ختم ہو جاتا ہے۔ اسٹوڈنٹ کے پاس کوئی پرانا پیپر باقی نہیں رہتا—صرف Results & Record میں اس کے نمبر، فیصد اور رزلٹ محفوظ رہتا ہے۔
• ایڈمن کی اجازت سے Read-Only انسر کی: صرف جب ایڈمن اجازت دے تو اسٹوڈنٹ کو ایک الگ "Answer Key" سیکشن ملتا ہے جہاں وہ صرف اپنے دیے گئے پیپرز کے صحیح اور غلط جوابات دیکھ سکتا ہے، مگر دوبارہ حل نہیں کر سکتا۔

--------------------------------------------------------------------
4. ویب سائٹ کی گنجائش (کتنے اسٹوڈنٹس اور کتنے پیپر ایک ساتھ چل سکتے ہیں؟)
--------------------------------------------------------------------
• کل رجسٹرڈ اسٹوڈنٹس اور ٹیچرز: لامحدود (Unlimited) — Google Firebase Authentication اور Cloud Firestore پر مبنی ہونے کی وجہ سے ہزاروں طلبہ اور اساتذہ کے اکاؤنٹس بغیر کسی رکاوٹ کے بن سکتے ہیں۔
• اسمارٹ سنگل جنریشن سسٹم: پیپر صرف ایک بار ایڈمن یا ٹیچر بناتے ہیں اور وہ کلاؤڈ میں محفوظ ہو جاتا ہے۔ اگر 1,000 یا 2,000 اسٹوڈنٹس ایک ہی وقت میں وہی ٹیسٹ دیں تب بھی AI صرف 1 بار استعمال ہوتا ہے، ہر اسٹوڈنٹ پر الگ لوڈ نہیں پڑتا۔
• ایک وقت میں آن لائن ٹیسٹ دینے کی صلاحیت:
  - فری پلان (Firebase Spark Tier): روزانہ تقریباً 50,000 ریڈز اور 20,000 رائٹس کی گنجائش ہوتی ہے، جس پر روزانہ باآسانی 300 سے 1,000+ طلبہ بیک وقت ٹیسٹ دے کر سبمٹ کر سکتے ہیں۔
  - پروڈکشن / کمرشل اسکیل (Firebase Blaze Plan): خودکار طور پر اسکیل ہو کر بیک وقت 10,000+ اسٹوڈنٹس کو ایک ساتھ امتحان دلانے کی صلاحیت رکھتا ہے۔
• ایک وقت میں چلنے والے پیپرز: چاروں کلاسز اور تمام 20 مضامین کے لامحدود پیپرز بیک وقت شیڈول اور منعقد کیے جا سکتے ہیں۔
• اضافی حفاظتی فیچرز: سرور ٹائم اسٹیمپ (کوئی طالب علم موبائل کی گھڑی بدل کر ٹائم نہیں بڑھا سکتا)، Google Verified لاگ ان، اور سخت Firestore سکیورٹی رولز۔

--------------------------------------------------------------------
پلیٹ فارم ڈویلپر اور رابطہ:
محمد عاصم خان (Muhammad Asim Khan) · فون / واٹس ایپ: 0316-5552001
====================================================================`;

export function PlatformBrochureModal({ onClose }: PlatformBrochureModalProps) {
  const [lang, setLang] = useState<BrochureLang>('bilingual');
  const [copiedType, setCopiedType] = useState<BrochureLang | null>(null);

  const activeText = useMemo(() => {
    if (lang === 'english') return ENGLISH_BROCHURE;
    if (lang === 'urdu') return URDU_BROCHURE;
    return `${ENGLISH_BROCHURE}\n\n${URDU_BROCHURE}`;
  }, [lang]);

  async function copyContent(targetLang: BrochureLang) {
    const payload =
      targetLang === 'english'
        ? ENGLISH_BROCHURE
        : targetLang === 'urdu'
          ? URDU_BROCHURE
          : `${ENGLISH_BROCHURE}\n\n${URDU_BROCHURE}`;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(payload);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = payload;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }

    setCopiedType(targetLang);
    window.setTimeout(() => {
      setCopiedType((curr) => (curr === targetLang ? null : curr));
    }, 2500);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Platform Description & Feature Brochure"
        className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-teal-500 to-amber-500 shrink-0" />

        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/70 shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0 mt-0.5">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                Website Description, Features &amp; Capacity Brochure
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Ready-to-share overview in English &amp; Urdu. Click any Copy button below and paste directly to WhatsApp, Email, or Documents.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
            aria-label="Close brochure modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Language Selector & One-Click Copy Bar */}
        <div className="px-5 sm:px-6 py-3 border-b border-slate-200 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setLang('bilingual')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                lang === 'bilingual'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Languages className="w-3.5 h-3.5" />
              English + Urdu (Both)
            </button>
            <button
              type="button"
              onClick={() => setLang('english')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                lang === 'english'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              English Only
            </button>
            <button
              type="button"
              onClick={() => setLang('urdu')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                lang === 'urdu'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              اردو (Urdu Only)
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyContent('english')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                copiedType === 'english'
                  ? 'bg-emerald-700 border-emerald-700 text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {copiedType === 'english' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  English Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy English
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void copyContent('urdu')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                copiedType === 'urdu'
                  ? 'bg-emerald-700 border-emerald-700 text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {copiedType === 'urdu' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Urdu Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Urdu
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void copyContent('bilingual')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                copiedType === 'bilingual'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white'
              }`}
            >
              {copiedType === 'bilingual' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Full Description Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Complete (English + Urdu)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Content Preview */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50 space-y-5">
          {lang === 'bilingual' ? (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                    English Version
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyContent('english')}
                    className="text-xs font-semibold text-blue-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedType === 'english' ? 'Copied!' : 'Copy English'}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-slate-800 leading-relaxed">
                  {ENGLISH_BROCHURE}
                </pre>
              </div>

              <div
                dir="rtl"
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-right"
              >
                <div
                  dir="ltr"
                  className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Urdu Version (اردو)
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyContent('urdu')}
                    className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedType === 'urdu' ? 'Copied!' : 'Copy Urdu'}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 leading-loose">
                  {URDU_BROCHURE}
                </pre>
              </div>
            </>
          ) : (
            <div
              dir={lang === 'urdu' ? 'rtl' : 'ltr'}
              className={`bg-white border border-slate-200 rounded-xl p-5 shadow-xs ${
                lang === 'urdu' ? 'text-right' : 'text-left'
              }`}
            >
              <pre
                className={`whitespace-pre-wrap font-sans text-slate-800 ${
                  lang === 'urdu' ? 'text-sm leading-loose' : 'text-xs sm:text-sm leading-relaxed'
                }`}
              >
                {activeText}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
