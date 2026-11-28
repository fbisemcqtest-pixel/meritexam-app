import { GRADE_LABELS, GradeLevel } from '../types';

export type EditionClass = GradeLevel | 'SSC' | 'HSSC' | 'All';

/**
 * Set to 'All' in the full 4-class platform.
 * Change this single value to:
 *   'SSC'      -> locks the app exclusively to 9th & 10th (SSC-I & SSC-II)
 *   'HSSC'     -> locks the app exclusively to 1st Year & 2nd Year (HSSC-I & HSSC-II)
 *   '9th' | '10th' | '1st A' | '2nd Year' -> locks to a single class
 * You can also set VITE_APP_CLASS in Netlify / Vercel environment variables without editing code.
 */
export const BUILD_LOCKED_CLASS: EditionClass = 'All';

export interface ClassEditionMeta {
  grade: EditionClass;
  queryKey: 'ssc' | 'hssc' | '9th' | '10th' | '1st-a' | '2nd-year' | 'all';
  slug: string;
  badge: string;
  title: string;
  urduTitle: string;
  description: string;
  urduDescription: string;
  zipFilename: string;
  accentGradient: string;
  borderClass: string;
}

export const CLASS_EDITIONS: ClassEditionMeta[] = [
  {
    grade: 'SSC',
    queryKey: 'ssc',
    slug: '/ssc',
    badge: 'SSC · 9th & 10th',
    title: 'SSC Portal (9th & 10th Classes)',
    urduTitle: 'ایس ایس سی پورٹل (9th اور 10th کلاس)',
    description: 'Dedicated combined portal & standalone package strictly for Matric / SSC students and teachers (9th & 10th Classes).',
    urduDescription: 'صرف نہم (9th) اور دہم (10th) میٹرک کلاسز کے لیے مکمل علیحدہ پورٹل۔',
    zipFilename: 'meritexam-ssc.zip',
    accentGradient: 'from-blue-600 to-teal-600',
    borderClass: 'border-blue-300',
  },
  {
    grade: 'HSSC',
    queryKey: 'hssc',
    slug: '/hssc',
    badge: 'HSSC · 1st & 2nd Year',
    title: 'HSSC Portal (1st Year & 2nd Year)',
    urduTitle: 'ایچ ایس ایس سی پورٹل (1st Year اور 2nd Year)',
    description: 'Dedicated combined portal & standalone package strictly for Intermediate / HSSC students and teachers (1st Year & 2nd Year).',
    urduDescription: 'صرف فرسٹ ایئر (1st Year) اور سیکنڈ ایئر (2nd Year) انٹرمیڈیٹ کلاسز کے لیے مکمل علیحدہ پورٹل۔',
    zipFilename: 'meritexam-hssc.zip',
    accentGradient: 'from-indigo-600 to-amber-600',
    borderClass: 'border-indigo-300',
  },
  {
    grade: '9th',
    queryKey: '9th',
    slug: '/9th',
    badge: '9th Only',
    title: '9th Class (SSC-I) Portal',
    urduTitle: 'نہم کلاس (9th) پورٹل',
    description: 'Dedicated portal & standalone package strictly for 9th Class (SSC-I) students, teachers, and board papers.',
    urduDescription: 'صرف نہم کلاس (9th) کے اسٹوڈنٹس، ٹیچرز اور امتحانی پیپرز کے لیے مخصوص پورٹل۔',
    zipFilename: 'meritexam-9th-class.zip',
    accentGradient: 'from-blue-600 to-indigo-600',
    borderClass: 'border-blue-200',
  },
  {
    grade: '10th',
    queryKey: '10th',
    slug: '/10th',
    badge: '10th Only',
    title: '10th Class (SSC-II) Portal',
    urduTitle: 'دہم کلاس (10th) پورٹل',
    description: 'Dedicated portal & standalone package strictly for 10th Class (SSC-II) students, teachers, and board papers.',
    urduDescription: 'صرف دہم کلاس (10th) کے اسٹوڈنٹس، ٹیچرز اور امتحانی پیپرز کے لیے مخصوص پورٹل۔',
    zipFilename: 'meritexam-10th-class.zip',
    accentGradient: 'from-teal-600 to-emerald-600',
    borderClass: 'border-teal-200',
  },
  {
    grade: '1st A',
    queryKey: '1st-a',
    slug: '/1st-year',
    badge: '1st Year Only',
    title: '1st Year / 11th (HSSC-I) Portal',
    urduTitle: 'فرسٹ ایئر (1st Year / 11th) پورٹل',
    description: 'Dedicated portal & standalone package strictly for 1st Year / 1st A (HSSC-I) students, teachers, and board papers.',
    urduDescription: 'صرف فرسٹ ایئر (11th) کے اسٹوڈنٹس، ٹیچرز اور امتحانی پیپرز کے لیے مخصوص پورٹل۔',
    zipFilename: 'meritexam-1st-year.zip',
    accentGradient: 'from-indigo-600 to-purple-600',
    borderClass: 'border-indigo-200',
  },
  {
    grade: '2nd Year',
    queryKey: '2nd-year',
    slug: '/2nd-year',
    badge: '2nd Year Only',
    title: '2nd Year / 12th (HSSC-II) Portal',
    urduTitle: 'سیکنڈ ایئر (2nd Year / 12th) پورٹل',
    description: 'Dedicated portal & standalone package strictly for 2nd Year / 12th (HSSC-II) students, teachers, and board papers.',
    urduDescription: 'صرف سیکنڈ ایئر (12th) کے اسٹوڈنٹس، ٹیچرز اور امتحانی پیپرز کے لیے مخصوص پورٹل۔',
    zipFilename: 'meritexam-2nd-year.zip',
    accentGradient: 'from-amber-500 to-orange-600',
    borderClass: 'border-amber-200',
  },
  {
    grade: 'All',
    queryKey: 'all',
    slug: '/',
    badge: 'Complete (All 4 Classes)',
    title: 'Complete All-Classes Portal (Full Version)',
    urduTitle: 'مکمل ویب سائٹ (چاروں کلاسز کا پورٹل)',
    description: 'The full MeritExam platform supporting all 4 classes (9th, 10th, 1st A, 2nd Year) together in one unified system.',
    urduDescription: 'مکمل ویب سائٹ جس میں چاروں کلاسز (9th, 10th, 1st Year, 2nd Year) ایک ساتھ شامل ہیں۔',
    zipFilename: 'meritexam-complete-all-classes.zip',
    accentGradient: 'from-slate-800 to-blue-900',
    borderClass: 'border-slate-300',
  },
];

export function normalizeEditionClass(raw: unknown): EditionClass {
  if (typeof raw !== 'string') return 'All';
  const cleaned = raw.trim().toLowerCase().replace(/[_/]+/g, ' ').replace(/\s+/g, ' ');
  if (!cleaned || cleaned === 'all') return 'All';

  if (cleaned === 'ssc' || cleaned === 'matric' || cleaned === '9th-10th' || cleaned === '9th 10th') {
    return 'SSC';
  }
  if (
    cleaned === 'hssc' ||
    cleaned === 'inter' ||
    cleaned === 'intermediate' ||
    cleaned === 'fsc' ||
    cleaned === '11th-12th' ||
    cleaned === '11th 12th'
  ) {
    return 'HSSC';
  }

  if (cleaned === '9' || cleaned === '9th' || cleaned === 'ssc-1' || cleaned === 'ssc-i' || cleaned === 'ninth') {
    return '9th';
  }
  if (cleaned === '10' || cleaned === '10th' || cleaned === 'ssc-2' || cleaned === 'ssc-ii' || cleaned === 'tenth') {
    return '10th';
  }
  if (
    cleaned === '1st a' ||
    cleaned === '1st-a' ||
    cleaned === '1sta' ||
    cleaned === '1st year' ||
    cleaned === '1st-year' ||
    cleaned === '11' ||
    cleaned === '11th' ||
    cleaned === 'hssc-1' ||
    cleaned === 'hssc-i'
  ) {
    return '1st A';
  }
  if (
    cleaned === '2nd year' ||
    cleaned === '2nd-year' ||
    cleaned === '2ndyear' ||
    cleaned === '12' ||
    cleaned === '12th' ||
    cleaned === 'hssc-2' ||
    cleaned === 'hssc-ii'
  ) {
    return '2nd Year';
  }
  return 'All';
}

export function getEditionAllowedGrades(edition: EditionClass): GradeLevel[] {
  if (edition === 'SSC') return ['9th', '10th'];
  if (edition === 'HSSC') return ['1st A', '2nd Year'];
  if (edition === 'All') return ['9th', '10th', '1st A', '2nd Year'];
  return [edition];
}

export function isEditionRestricted(edition: EditionClass): boolean {
  return edition !== 'All';
}

export function isGradeAllowedInEdition(grade: string | undefined, edition: EditionClass): boolean {
  if (edition === 'All') return true;
  if (!grade) return false;
  return getEditionAllowedGrades(edition).includes(grade.trim() as GradeLevel);
}

export function getBuildLockedEdition(): EditionClass {
  if (BUILD_LOCKED_CLASS !== 'All') {
    return BUILD_LOCKED_CLASS;
  }
  const envRaw =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_APP_CLASS as string | undefined)
      : undefined;
  return normalizeEditionClass(envRaw);
}

export function isBuildLockedEdition(): boolean {
  return getBuildLockedEdition() !== 'All';
}

export function getActiveEditionClass(): EditionClass {
  const buildLocked = getBuildLockedEdition();
  if (buildLocked !== 'All') {
    return buildLocked;
  }

  if (typeof window === 'undefined') {
    return 'All';
  }

  const params = new URLSearchParams(window.location.search);
  const queryClass = normalizeEditionClass(params.get('class'));
  if (queryClass !== 'All') {
    return queryClass;
  }

  const firstSegment = window.location.pathname
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)[0];
  if (firstSegment) {
    const pathClass = normalizeEditionClass(firstSegment);
    if (pathClass !== 'All') {
      return pathClass;
    }
  }

  return 'All';
}

export function getClassPathSlug(edition: EditionClass): string {
  const matched = CLASS_EDITIONS.find((e) => e.grade === edition);
  return matched ? matched.slug : '/';
}

export function getEditionLabel(edition: EditionClass): string {
  if (edition === 'All') return 'All Classes (9th, 10th, 1st A & 2nd Year)';
  if (edition === 'SSC') return 'SSC (9th & 10th Classes)';
  if (edition === 'HSSC') return 'HSSC (1st Year & 2nd Year)';
  return GRADE_LABELS[edition];
}

export function getEditionShortBadge(edition: EditionClass): string {
  if (edition === 'All') return 'All Classes';
  if (edition === 'SSC') return 'SSC (9th & 10th)';
  if (edition === 'HSSC') return 'HSSC (1st & 2nd Year)';
  return edition;
}
