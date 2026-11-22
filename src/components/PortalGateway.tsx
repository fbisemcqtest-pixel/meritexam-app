import React, { useState } from 'react';
import {
  ArrowRight,
  Atom,
  BookOpen,
  Calculator,
  CheckCircle2,
  Dna,
  FlaskConical,
  GraduationCap,
  Phone,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import {
  CURRICULUM_BOARD_LABEL,
  GRADES,
  GRADE_LABELS,
  SUBJECT_GROUPS,
  SYLLABUS_CHAPTERS,
  SubjectName,
  UserRole,
} from '../types';
import { DeveloperFooter } from './DeveloperFooter';

interface PortalGatewayProps {
  onSelectPortal: (role: UserRole, initialMode?: 'login' | 'register') => void;
}

interface SubjectShowcaseMeta {
  subject: SubjectName;
  image: string;
  alt: string;
  tagline: string;
  barGradient: string;
  iconBg: string;
  accentText: string;
  cardBorder: string;
  fallbackGradient: string;
}

const SUBJECT_SHOWCASE: SubjectShowcaseMeta[] = [
  {
    subject: 'Physics',
    image: '/src/assets/images/subject_physics_lab_1794843933912.jpg',
    alt: 'Optical prism light dispersion, electromagnetic coils, and precision physics instruments',
    tagline: 'Mechanics, Optics, Electromagnetism & Modern Physics',
    barGradient: 'from-blue-600 to-indigo-600',
    iconBg: 'bg-blue-50 text-blue-700 border-blue-200',
    accentText: 'text-blue-700',
    cardBorder: 'hover:border-blue-300',
    fallbackGradient: 'from-blue-900 to-indigo-900',
  },
  {
    subject: 'Chemistry',
    image: '/src/assets/images/subject_chemistry_lab_1794843934021.jpg',
    alt: 'Laboratory glassware flasks and molecular structure models for Chemistry',
    tagline: 'Stoichiometry, Bonding, Energetics & Organic Reactions',
    barGradient: 'from-teal-600 to-emerald-600',
    iconBg: 'bg-teal-50 text-teal-700 border-teal-200',
    accentText: 'text-teal-700',
    cardBorder: 'hover:border-teal-300',
    fallbackGradient: 'from-teal-900 to-emerald-900',
  },
  {
    subject: 'Biology',
    image: '/src/assets/images/subject_biology_lab_1794843934926.jpg',
    alt: 'Compound laboratory microscope, botanical specimens, and DNA helix model for Biology',
    tagline: 'Cell Biology, Genetics, Human Physiology & Biotechnology',
    barGradient: 'from-emerald-600 to-green-600',
    iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    accentText: 'text-emerald-700',
    cardBorder: 'hover:border-emerald-300',
    fallbackGradient: 'from-emerald-900 to-green-900',
  },
  {
    subject: 'Math',
    image: '/src/assets/images/subject_math_desk_1794843935794.jpg',
    alt: 'Geometric compass, brass protractor, and trigonometry blueprints for Mathematics',
    tagline: 'Calculus, Matrices, Trigonometry & Analytical Geometry',
    barGradient: 'from-amber-500 to-orange-600',
    iconBg: 'bg-amber-50 text-amber-700 border-amber-200',
    accentText: 'text-amber-700',
    cardBorder: 'hover:border-amber-300',
    fallbackGradient: 'from-amber-900 to-orange-900',
  },
];

function SubjectIcon({ subject, className }: { subject: SubjectName; className?: string }) {
  if (subject === 'Physics') return <Atom className={className} />;
  if (subject === 'Chemistry') return <FlaskConical className={className} />;
  if (subject === 'Biology') return <Dna className={className} />;
  return <Calculator className={className} />;
}

export function PortalGateway({ onSelectPortal }: PortalGatewayProps) {
  const [heroImageError, setHeroImageError] = useState(false);
  const [subjectImgErrors, setSubjectImgErrors] = useState<Record<string, boolean>>({});

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Chromatic Academic Bar + 3-Zone Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-teal-500 to-amber-500" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-6">
          <a
            href="#top"
            className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 inline-flex items-center gap-2"
          >
            <span className="w-2.5 h-2.5 rounded-xs bg-gradient-to-br from-blue-600 to-teal-500 shrink-0" />
            <span>MeritExam</span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#subjects" className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0">
              Subjects
            </a>
            <a href="#portals" className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0">
              Portals
            </a>
            <a href="#curriculum" className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0">
              Curriculum
            </a>
            <button
              type="button"
              onClick={() => onSelectPortal('student', 'login')}
              className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Student Login
            </button>
            <button
              type="button"
              onClick={() => onSelectPortal('teacher', 'login')}
              className="hover:text-teal-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Teacher Login
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onSelectPortal('admin', 'login')}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 rounded-lg shadow-xs transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              Admin Portal
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Section with Subtle Chromatic Academic Backdrop */}
        <section className="bg-gradient-to-br from-blue-50/90 via-white to-teal-50/70 border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-14 lg:pt-14 lg:pb-18">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-center">
                <p className="text-xs font-bold tracking-wide uppercase text-blue-700 mb-3">
                  {CURRICULUM_BOARD_LABEL}
                </p>
                <h1
                  className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12] mb-5"
                  style={{ textWrap: 'balance' }}
                >
                  Subject-driven{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-700 to-teal-600">
                    MCQ examinations
                  </span>{' '}
                  with verified academic governance
                </h1>
                <p className="text-base text-slate-600 leading-relaxed max-w-xl mb-7">
                  Select any class level (9th, 10th, 1st A, or 2nd Year) and any National Book Foundation
                  book—<strong>Sciences</strong> (Physics, Chemistry, Biology, Math, Computer Science),{' '}
                  <strong>Compulsory</strong> (English, Urdu, Islamiat, Pakistan Studies), or{' '}
                  <strong>Arts &amp; Humanities</strong> (Civics, Economics, Education, History, Geography,
                  Sociology, Psychology, General Science &amp; General Math).
                </p>

                <div className="flex flex-wrap items-center gap-3 mb-7">
                  <button
                    type="button"
                    onClick={() => onSelectPortal('student', 'register')}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 rounded-lg shadow-sm transition-all inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Student Registration
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectPortal('teacher', 'register')}
                    className="px-5 py-2.5 text-sm font-semibold text-teal-800 bg-teal-50 border border-teal-300 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Teacher Registration
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
                  <span className="font-medium text-blue-800">9th · 10th · 1st A · 2nd Year</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-medium text-teal-800">Admin Account Verification</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-medium text-amber-800">Scheduled Countdown & Print PDF</span>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="relative h-full min-h-[300px] lg:min-h-[410px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-md">
                  {!heroImageError ? (
                    <img
                      src="/src/assets/images/hero_academic_sciences_1794803308241.jpg"
                      alt="Scientific and mathematical measurement instruments for Physics, Chemistry, Biology, and Mathematics"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImageError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-900 via-indigo-900 to-teal-900 text-white">
                      <BookOpen className="w-12 h-12 text-amber-300 mb-3" />
                      <p className="font-display font-semibold text-lg">
                        Physics · Chemistry · Biology · Mathematics
                      </p>
                      <p className="text-sm text-slate-300 mt-1">
                        9th Grade · 10th Grade · 1st A · 2nd Year Assessment Platform
                      </p>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-transparent text-white">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                      National Book Foundation · FBISE Syllabus
                    </p>
                    <p className="font-display text-base sm:text-lg font-bold mt-1">
                      All Sciences, Compulsory &amp; Arts / Humanities MCQ Bank
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Subject Visual Showcase (4 Generated Subject Pictures) */}
        <section id="subjects" className="py-16 bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-wider text-teal-700 mb-1.5">
                  Board-Aligned Science & Math Tracks
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Federal (NBF) &amp; Punjab (PTB) Subjects Across All 4 Classes
                </h2>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  Every chapter from 9th, 10th, 1st A (11th), and 2nd Year (12th) National Book
                  Foundation (FBISE) and Punjab Textbook Board (PTB / PCTB) books is mapped for instant paper creation.
                </p>
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Developed by <strong className="text-slate-800">Muhammad Asim Khan</strong> ·{' '}
                <a href="tel:03165552001" className="text-blue-700 hover:underline font-semibold tabular-nums">
                  03165552001
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {SUBJECT_SHOWCASE.map((item) => {
                const totalChapters = GRADES.reduce(
                  (acc, g) => acc + (SYLLABUS_CHAPTERS[g][item.subject]?.length ?? 0),
                  0,
                );
                const imgBroken = Boolean(subjectImgErrors[item.subject]);

                return (
                  <article
                    key={item.subject}
                    className={`bg-white border border-slate-200 ${item.cardBorder} rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col`}
                  >
                    <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden">
                      {!imgBroken ? (
                        <img
                          src={item.image}
                          alt={item.alt}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setSubjectImgErrors((prev) => ({ ...prev, [item.subject]: true }))
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className={`w-full h-full bg-gradient-to-br ${item.fallbackGradient} flex flex-col items-center justify-center p-6 text-white`}
                        >
                          <SubjectIcon subject={item.subject} className="w-10 h-10 mb-2 opacity-90" />
                          <span className="font-display font-bold text-lg">{item.subject}</span>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 px-4 py-3 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex items-center justify-between text-white">
                        <span className="font-display font-bold text-base tracking-tight">
                          {item.subject}
                        </span>
                        <span className="text-xs font-semibold text-amber-300 tabular-nums">
                          {totalChapters} Chapters
                        </span>
                      </div>
                    </div>

                    <div className={`h-1.5 w-full bg-gradient-to-r ${item.barGradient}`} />

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2.5 mb-2">
                          <div
                            className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${item.iconBg}`}
                          >
                            <SubjectIcon subject={item.subject} className="w-4 h-4" />
                          </div>
                          <span className={`text-xs font-bold uppercase tracking-wide ${item.accentText}`}>
                            9th · 10th · 1st A · 2nd Year
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{item.tagline}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectPortal('student', 'login')}
                        className={`mt-4 pt-3 border-t border-slate-100 w-full text-left text-xs font-semibold ${item.accentText} hover:underline inline-flex items-center justify-between cursor-pointer`}
                      >
                        <span>Take {item.subject} Assessment</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Complete FBISE & NBF Directory: Sciences, Compulsory & Arts */}
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
              {SUBJECT_GROUPS.map((group, idx) => {
                const style =
                  idx === 0
                    ? {
                        bar: 'from-blue-600 to-indigo-600',
                        border: 'border-blue-200',
                        title: 'text-blue-900',
                        bg: 'bg-blue-50/40',
                      }
                    : idx === 1
                      ? {
                          bar: 'from-teal-600 to-emerald-600',
                          border: 'border-teal-200',
                          title: 'text-teal-900',
                          bg: 'bg-teal-50/40',
                        }
                      : {
                          bar: 'from-amber-500 to-orange-600',
                          border: 'border-amber-200',
                          title: 'text-amber-900',
                          bg: 'bg-amber-50/40',
                        };
                return (
                  <div
                    key={group.label}
                    className={`rounded-xl border ${style.border} ${style.bg} overflow-hidden`}
                  >
                    <div className={`h-1 w-full bg-gradient-to-r ${style.bar}`} />
                    <div className="p-5">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className={`font-display text-base font-bold ${style.title}`}>
                          {group.label}
                        </h3>
                        <span className="text-xs font-semibold text-slate-600 tabular-nums">
                          {group.subjects.length} Books
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        {group.subjects.join(' · ')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Separate Role Portals */}
        <section id="portals" className="bg-slate-50 py-16 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-2xl mb-10">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-1.5">
                Verified Role Access
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Separate Role Access Portals
              </h2>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Students, teachers, and administrators authenticate through dedicated portals. New
                student and teacher accounts remain pending until approved by the administrator.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Student Portal Card */}
              <div className="bg-white border border-blue-200/80 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
                <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 to-indigo-600" />
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 mb-4">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Student Portal
                    </h3>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      Register with your class level (9th, 10th, 1st A, or 2nd Year) and roll number.
                      Once approved by the admin, sit timed MCQ tests and view released scorecards.
                    </p>
                  </div>
                  <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectPortal('student', 'login')}
                      className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 rounded-lg transition-all whitespace-nowrap cursor-pointer"
                    >
                      Student Login
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectPortal('student', 'register')}
                      className="flex-1 px-4 py-2 text-sm font-semibold text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Register
                    </button>
                  </div>
                </div>
              </div>

              {/* Teacher Portal Card */}
              <div className="bg-white border border-teal-200/80 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
                <div className="h-1.5 w-full bg-gradient-to-r from-teal-600 to-emerald-600" />
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="w-11 h-11 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 mb-4">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Teacher Portal
                    </h3>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      Specify a class level, NBF chapter, and subject to build MCQ papers for 9th,
                      10th, 1st A, and 2nd Year, schedule start timers, and print exam sheets.
                    </p>
                  </div>
                  <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectPortal('teacher', 'login')}
                      className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 rounded-lg transition-all whitespace-nowrap cursor-pointer"
                    >
                      Teacher Login
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectPortal('teacher', 'register')}
                      className="flex-1 px-4 py-2 text-sm font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Register
                    </button>
                  </div>
                </div>
              </div>

              {/* Admin Portal Card */}
              <div className="bg-white border border-amber-200/90 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
                <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 to-orange-600" />
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="w-11 h-11 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mb-4">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Administrator Portal
                    </h3>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      Verify and approve pending student and teacher accounts, select between Instant
                      or Controlled Review modes, publish papers, and download full project backups.
                    </p>
                  </div>
                  <div className="mt-6 pt-5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onSelectPortal('admin', 'login')}
                      className="w-full px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 rounded-lg transition-all whitespace-nowrap cursor-pointer"
                    >
                      Administrator Sign In
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Curriculum & Mode Governance Section */}
        <section id="curriculum" className="bg-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-7">
                <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight mb-2">
                  Supported Classes & Science Subjects
                </h2>
                <p className="text-sm text-slate-600 mb-6">
                  Tests align with Federal Board (FBISE) and National Book Foundation (NBF) chapters
                  with automated 4-option questions and verified explanations.
                </p>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-teal-50 text-xs font-bold text-slate-700">
                        <th className="py-3 px-4">Class Level</th>
                        <th className="py-3 px-4">Subjects Covered</th>
                        <th className="py-3 px-4">Format</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {GRADES.map((grade) => (
                        <tr key={grade} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            {GRADE_LABELS[grade]}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            All 20 NBF Sciences, Compulsory &amp; Arts Books
                          </td>
                          <td className="py-3.5 px-4 text-blue-700 font-medium tabular-nums">
                            4-Option MCQ
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="lg:col-span-5">
                <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight mb-2">
                  Admin-Selected Examination Modes
                </h2>
                <p className="text-sm text-slate-600 mb-6">
                  The administrator selects how tests and results operate across the institution.
                </p>

                <div className="space-y-4">
                  <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 text-sm font-bold text-blue-900">
                      <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />
                      <span>Option 1: Instant Mode</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1.5 leading-relaxed">
                      Students receive immediate automated grading, pass/fail status, and detailed
                      answer explanations right upon submitting their test.
                    </p>
                  </div>

                  <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
                      <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Option 2: Controlled / Admin Review Mode</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1.5 leading-relaxed">
                      Submissions are held in a secure review queue. Scores and answer keys remain
                      hidden until the administrator explicitly releases results.
                    </p>
                  </div>

                  <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-xl p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-300">
                        Platform Support & Developer
                      </p>
                      <p className="font-display text-base font-bold mt-0.5">
                        Muhammad Asim Khan
                      </p>
                    </div>
                    <a
                      href="tel:03165552001"
                      className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-amber-300 inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      03165552001
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <DeveloperFooter />
    </div>
  );
}
