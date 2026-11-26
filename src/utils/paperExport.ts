import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  TabStopPosition,
  TabStopType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertInchesToTwip,
} from 'docx';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { getMonogramForWordExport } from './apsacsMonogram';
import {
  BOARD_PRINT_LABELS,
  ExamBoard,
  GRADE_LABELS,
  GradeLevel,
  MCQQuestion,
  SubjectName,
  SubjectiveQuestion,
} from '../types';
import {
  estimateSectionATimeMinutes,
  formatDurationHoursMin,
  formatRomanPart,
  getBoardLevelCode,
  getRomanGradeNumeral,
} from '../data/fbisePatterns';

export interface WordPaperExportInput {
  title: string;
  board: ExamBoard;
  schoolName: string;
  examLabel: string;
  sessionLabel?: string;
  formattedDate: string;
  grade: GradeLevel;
  subject: SubjectName;
  topic?: string;
  durationMinutes: number;
  sectionATimeMinutes?: number;
  patternLabel?: string;
  marksPerQuestion: number;
  totalMarks: number;
  mcqTotalMarks: number;
  shortTotalMarks: number;
  longTotalMarks: number;
  questions: MCQQuestion[];
  shortQuestions: SubjectiveQuestion[];
  longQuestions: SubjectiveQuestion[];
  shortChoiceNote: string;
  longChoiceNote: string;
  paperStyle: 'fbise_official' | 'apsacs_official' | 'standard';
  paperSize: 'a4' | 'legal';
  compactLayout: boolean;
  sideBySideOr: boolean;
  twoColumnMcqs: boolean;
  showOmrGrid: boolean;
  showMonogram?: boolean;
  customMonogramUrl?: string;
  separateSectionA: boolean;
  includeAnswerKey: boolean;
}

const URDU_SCRIPT_REGEX = /[\u0600-\u06FF]/;

function hasRtlScript(text?: string): boolean {
  return Boolean(text && URDU_SCRIPT_REGEX.test(text));
}

function formatMarksBadge(marks: number): string {
  if (Number.isInteger(marks) && marks >= 0 && marks < 10) {
    return `0${marks}`;
  }
  return `${marks}`;
}

export function sanitizeFileName(rawName: string): string {
  const cleaned = rawName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 72);
  return cleaned || 'MeritExam_Paper';
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

interface PdfBlockMetric {
  top: number;
  bottom: number;
  forceBreakBefore: boolean;
  keepWithNext: boolean;
}

interface PdfPageRange {
  start: number;
  end: number;
  forced: boolean;
}

function groupBlocksIntoVisualRows(blocks: PdfBlockMetric[]): PdfBlockMetric[] {
  const rows: PdfBlockMetric[] = [];
  for (const blk of blocks) {
    const prev = rows[rows.length - 1];
    // Combine side-by-side blocks sharing the same visual row (e.g. 2-column MCQs)
    if (prev && !blk.forceBreakBefore && !prev.keepWithNext && Math.abs(blk.top - prev.top) < 8) {
      prev.bottom = Math.max(prev.bottom, blk.bottom);
    } else {
      rows.push({ ...blk });
    }
  }
  return rows;
}

function computePdfPageRanges(
  rows: PdfBlockMetric[],
  totalCssHeight: number,
  maxPageHeightCss: number,
): PdfPageRange[] {
  const pageRanges: PdfPageRange[] = [];
  let pageStart = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const blk = rows[i];

    if (blk.forceBreakBefore && blk.top > pageStart + 12) {
      pageRanges.push({ start: pageStart, end: blk.top, forced: true });
      pageStart = blk.top;
      continue;
    }

    if (blk.keepWithNext && i + 1 < rows.length) {
      let lookIdx = i + 1;
      while (lookIdx + 1 < rows.length && rows[lookIdx].keepWithNext && !rows[lookIdx + 1].forceBreakBefore) {
        lookIdx += 1;
      }
      const anchorBlk = rows[lookIdx];
      if (anchorBlk.bottom - pageStart > maxPageHeightCss && blk.top > pageStart + 12) {
        pageRanges.push({ start: pageStart, end: blk.top, forced: false });
        pageStart = blk.top;
        continue;
      }
    }

    if (blk.bottom - pageStart > maxPageHeightCss) {
      if (blk.top > pageStart + 12 && blk.bottom - blk.top <= maxPageHeightCss) {
        pageRanges.push({ start: pageStart, end: blk.top, forced: false });
        pageStart = blk.top;
      } else {
        while (blk.bottom - pageStart > maxPageHeightCss) {
          const sliceEnd = pageStart + maxPageHeightCss;
          pageRanges.push({ start: pageStart, end: sliceEnd, forced: false });
          pageStart = sliceEnd;
        }
      }
    }
  }

  while (totalCssHeight - pageStart > maxPageHeightCss + 4) {
    const sliceEnd = pageStart + maxPageHeightCss;
    pageRanges.push({ start: pageStart, end: sliceEnd, forced: false });
    pageStart = sliceEnd;
  }

  if (totalCssHeight > pageStart + 2) {
    pageRanges.push({ start: pageStart, end: totalCssHeight, forced: false });
  }

  if (pageRanges.length === 0) {
    pageRanges.push({ start: 0, end: totalCssHeight, forced: false });
  }

  return pageRanges;
}

/**
 * Renders the printable paper DOM into a crisp, multi-page A4 / Legal PDF
 * without slicing questions across page boundaries or leaving orphan sliver pages.
 */
export async function exportPaperToPdf(
  sheetElement: HTMLElement,
  fileBaseName: string,
  compactLayout: boolean,
  paperSize: 'a4' | 'legal' = 'a4',
): Promise<void> {
  const isLegal = paperSize === 'legal';
  const targetWidthPx = isLegal ? 816 : 794; // 8.5in vs 8.27in at 96 DPI

  const cloneHost = document.createElement('div');
  cloneHost.style.position = 'fixed';
  cloneHost.style.left = '-12000px';
  cloneHost.style.top = '0';
  cloneHost.style.width = `${targetWidthPx}px`;
  cloneHost.style.backgroundColor = '#ffffff';
  cloneHost.style.zIndex = '-1';
  cloneHost.style.pointerEvents = 'none';

  const clonedSheet = sheetElement.cloneNode(true) as HTMLElement;
  clonedSheet.setAttribute('data-pdf-root', 'true');
  clonedSheet.style.width = `${targetWidthPx}px`;
  clonedSheet.style.minWidth = `${targetWidthPx}px`;
  clonedSheet.style.maxWidth = `${targetWidthPx}px`;
  clonedSheet.style.margin = '0';
  clonedSheet.style.border = 'none';
  clonedSheet.style.boxShadow = 'none';
  clonedSheet.style.padding = compactLayout ? '4px 10px' : '16px 22px';
  clonedSheet.style.backgroundColor = '#ffffff';

  cloneHost.appendChild(clonedSheet);
  document.body.appendChild(cloneHost);

  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const pageWidthMm = isLegal ? 215.9 : 210;
    const pageHeightMm = isLegal ? 355.6 : 297;
    let marginMm = compactLayout ? 5 : 9;

    const measureCurrent = () => {
      const sheetRect = clonedSheet.getBoundingClientRect();
      const blockNodes = Array.from(
        clonedSheet.querySelectorAll<HTMLElement>('[data-pdf-block], [data-pdf-page-break]'),
      );
      const rawBlocks: PdfBlockMetric[] = blockNodes
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            top: Math.max(0, rect.top - sheetRect.top),
            bottom: Math.max(0, rect.bottom - sheetRect.top),
            forceBreakBefore: el.hasAttribute('data-pdf-page-break'),
            keepWithNext: el.hasAttribute('data-pdf-keep-with-next'),
          };
        })
        .filter((b) => b.bottom > b.top);

      const contentWidthMm = pageWidthMm - marginMm * 2;
      const contentHeightMm = pageHeightMm - marginMm * 2;
      const totalCssWidth = clonedSheet.offsetWidth || targetWidthPx;
      const totalCssHeight = clonedSheet.offsetHeight || sheetRect.height;
      const maxPageHeightCss = totalCssWidth * (contentHeightMm / contentWidthMm);
      const rows = groupBlocksIntoVisualRows(rawBlocks);
      const ranges = computePdfPageRanges(rows, totalCssHeight, maxPageHeightCss);

      return { contentWidthMm, totalCssWidth, totalCssHeight, maxPageHeightCss, ranges };
    };

    let measured = measureCurrent();

    // If compact mode leaves just a small trailing sliver (< 28% of a page) that isn't an intentional break,
    // gently tighten spacing & margins so those few lines pull cleanly onto the previous page.
    if (compactLayout && measured.ranges.length > 1) {
      const lastIdx = measured.ranges.length - 1;
      const lastRange = measured.ranges[lastIdx];
      const prevRange = measured.ranges[lastIdx - 1];
      const lastHeight = lastRange.end - lastRange.start;
      const trailingWasIntentionalBreak = lastRange.forced || (prevRange && lastHeight > measured.maxPageHeightCss * 0.28);

      if (!trailingWasIntentionalBreak && lastHeight < measured.maxPageHeightCss * 0.28) {
        marginMm = 4;
        clonedSheet.style.padding = '2px 8px';
        const tightStyle = document.createElement('style');
        tightStyle.textContent = `
          [data-pdf-root="true"] { font-size: 92% !important; line-height: 1.2 !important; }
          [data-pdf-root="true"] [data-pdf-block="true"] { padding-top: 1.5px !important; padding-bottom: 1.5px !important; }
        `;
        cloneHost.appendChild(tightStyle);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        const tighterMeasured = measureCurrent();
        if (tighterMeasured.ranges.length < measured.ranges.length) {
          measured = tighterMeasured;
        } else {
          cloneHost.removeChild(tightStyle);
          marginMm = 5;
          clonedSheet.style.padding = '4px 10px';
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          measured = measureCurrent();
        }
      }
    }

    const canvas = await html2canvas(clonedSheet, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: targetWidthPx + 24,
    });

    const totalCssWidth = measured.totalCssWidth;
    const totalCssHeight = measured.totalCssHeight || canvas.height / 2;
    const scaleX = canvas.width / totalCssWidth;
    const scaleY = canvas.height / totalCssHeight;
    const contentWidthMm = measured.contentWidthMm;
    const pageRanges = measured.ranges;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isLegal ? 'legal' : 'a4',
      compress: true,
    });

    pageRanges.forEach((range, pageIdx) => {
      const srcY = Math.max(0, Math.floor(range.start * scaleY));
      const srcEnd = Math.min(canvas.height, Math.ceil(range.end * scaleY));
      const srcH = Math.max(1, srcEnd - srcY);

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = srcH;

      const ctx = pageCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
      }

      const imgData = pageCanvas.toDataURL('image/png');
      const renderedHeightMm = (srcH / (scaleX * totalCssWidth)) * contentWidthMm;

      if (pageIdx > 0) {
        pdf.addPage();
      }
      pdf.addImage(imgData, 'PNG', marginMm, marginMm, contentWidthMm, renderedHeightMm, undefined, 'FAST');
    });

    pdf.save(`${sanitizeFileName(fileBaseName)}.pdf`);
  } finally {
    document.body.removeChild(cloneHost);
  }
}

const NO_CELL_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

function createSectionBanner(leftTitle: string, rightMarks: string, isOfficial: boolean): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            shading: isOfficial
              ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F1F5F9' }
              : undefined,
            borders: {
              top: { style: BorderStyle.SINGLE, size: isOfficial ? 12 : 4, color: '0F172A' },
              bottom: { style: BorderStyle.SINGLE, size: isOfficial ? 12 : 6, color: '0F172A' },
              left: NO_CELL_BORDERS.left,
              right: NO_CELL_BORDERS.right,
            },
            margins: { top: 70, bottom: 70, left: 100, right: 80 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: leftTitle,
                    bold: true,
                    size: 21,
                    color: '0F172A',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: isOfficial
              ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F1F5F9' }
              : undefined,
            borders: {
              top: { style: BorderStyle.SINGLE, size: isOfficial ? 12 : 4, color: '0F172A' },
              bottom: { style: BorderStyle.SINGLE, size: isOfficial ? 12 : 6, color: '0F172A' },
              left: NO_CELL_BORDERS.left,
              right: NO_CELL_BORDERS.right,
            },
            margins: { top: 70, bottom: 70, left: 80, right: 100 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: rightMarks,
                    bold: true,
                    size: 19,
                    color: '1E293B',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function createMultilineTextRuns(text: string, size = 20, color = '334155', bold = false): TextRun[] {
  const lines = text.split('\n');
  const runs: TextRun[] = [];
  lines.forEach((line, idx) => {
    runs.push(
      new TextRun({
        text: line,
        size,
        color,
        bold,
        font: 'Calibri',
        break: idx > 0 ? 1 : undefined,
      }),
    );
  });
  return runs;
}

/**
 * Generates a native, editable Microsoft Word (.docx) document matching
 * the official FBISE / school question paper layout and optional answer key.
 */
export async function exportPaperToWord(input: WordPaperExportInput): Promise<void> {
  const {
    title,
    board,
    schoolName,
    examLabel,
    sessionLabel = 'SESSION 2026-2027',
    formattedDate,
    grade,
    subject,
    topic,
    durationMinutes,
    sectionATimeMinutes,
    patternLabel = '',
    marksPerQuestion,
    totalMarks,
    mcqTotalMarks,
    shortTotalMarks,
    longTotalMarks,
    questions,
    shortQuestions,
    longQuestions,
    shortChoiceNote,
    longChoiceNote,
    paperStyle,
    paperSize,
    compactLayout,
    sideBySideOr,
    twoColumnMcqs,
    showOmrGrid,
    showMonogram = true,
    customMonogramUrl = '',
    separateSectionA,
    includeAnswerKey,
  } = input;

  const CIRCLED_DIGITS = ['⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
  const CIRCLED_LETTERS = ['Ⓐ', 'Ⓑ', 'Ⓒ', 'Ⓓ'];
  const OPEN_CIRCLES = ['○', '○', '○', '○'];
  const optionTag = (optIdx: number) => `(${String.fromCharCode(65 + optIdx)}) `;

  const qFontSize = compactLayout ? 18 : 20;
  const optFontSize = compactLayout ? 17 : 19;

  const isApsacs = paperStyle === 'apsacs_official';
  const isOfficial = paperStyle === 'fbise_official' || isApsacs;
  const romanGrade = getRomanGradeNumeral(grade);
  const marksPerQuestionPhrase =
    marksPerQuestion === 1
      ? 'one mark'
      : marksPerQuestion < 1
        ? `${marksPerQuestion} mark`
        : `${marksPerQuestion} marks`;
  const mcqQuestionNum = questions.length > 0 ? 1 : 0;
  const shortQuestionNum = shortQuestions.length > 0 ? mcqQuestionNum + 1 : 0;
  const longStartNum = (shortQuestionNum || mcqQuestionNum) + 1;
  const boardLevelCode = getBoardLevelCode(grade);
  const resolvedSectionATime = estimateSectionATimeMinutes(
    grade,
    questions.length,
    sectionATimeMinutes,
  );
  const subjectiveTotalMarks = Math.round((shortTotalMarks + longTotalMarks) * 100) / 100;
  const resolvedSubjectiveTime =
    questions.length > 0 && (shortQuestions.length > 0 || longQuestions.length > 0)
      ? Math.max(15, durationMinutes - resolvedSectionATime)
      : durationMinutes;
  const hasShortOr = shortQuestions.some((q) => Boolean(q.orPrompt?.trim()));
  const hasLongOr = longQuestions.some((q) => Boolean(q.orPrompt?.trim()));
  const isRtlSubject = subject === 'Urdu' || subject === 'Islamiat';

  const children: Array<Paragraph | Table> = [];

  const monogramImg = showMonogram && (isApsacs || Boolean(customMonogramUrl.trim()))
    ? await getMonogramForWordExport(customMonogramUrl)
    : null;

  const createMonogramParagraph = (targetHeightPx: number, afterSpacing = 25): Paragraph | null => {
    if (!monogramImg) return null;
    const scaledWidth = Math.max(
      24,
      Math.round(monogramImg.width * (targetHeightPx / Math.max(1, monogramImg.height))),
    );
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: afterSpacing },
      children: [
        new ImageRun({
          type: 'png',
          data: monogramImg.bytes,
          transformation: {
            width: scaledWidth,
            height: targetHeightPx,
          },
        }),
      ],
    });
  };

  // 1. Header Block
  if (isApsacs) {
    const trimmedSchool = schoolName.trim();
    const isGenericApsacsName =
      !trimmedSchool ||
      trimmedSchool.toLowerCase() === 'army public schools & colleges system' ||
      trimmedSchool.toLowerCase() === 'apsacs';
    const apsacsHeaderName = trimmedSchool
      ? trimmedSchool.toUpperCase()
      : 'ARMY PUBLIC SCHOOLS & COLLEGES SYSTEM';
    const apsacsExamText = examLabel.trim()
      ? examLabel.trim().toUpperCase()
      : 'PRE-BOARD EXAMINATION (COLD & WARM REGION)';
    const apsacsSessionText = sessionLabel.trim()
      ? sessionLabel.trim().toUpperCase()
      : 'SESSION 2026-2027';

    const omrBlockParagraphs = (cols: number, label: string, boxText: string): Paragraph[] => [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 20 },
        children: [
          new TextRun({ text: label, bold: true, size: 17, color: '0F172A', font: 'Calibri' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 30 },
        children: [
          new TextRun({ text: boxText, bold: true, size: 16, color: '0F172A', font: 'Consolas' }),
        ],
      }),
      ...CIRCLED_DIGITS.map(
        (digitChar) =>
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 6 },
            children: [
              new TextRun({
                text: Array.from({ length: cols }, () => digitChar).join(' '),
                size: 16,
                color: '1E293B',
                font: 'Segoe UI Symbol',
              }),
            ],
          }),
      ),
    ];

    const apsacsMonogramParagraph = createMonogramParagraph(compactLayout ? 50 : 60, 20);
    const shouldPrintApsacsTextLine =
      !apsacsMonogramParagraph ||
      (customMonogramUrl.trim() ? Boolean(trimmedSchool) : !isGenericApsacsName);

    const apsacsLeftChildren: Paragraph[] = [
      ...(apsacsMonogramParagraph ? [apsacsMonogramParagraph] : []),
      ...(shouldPrintApsacsTextLine
        ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 20 },
              children: [
                new TextRun({
                  text: apsacsHeaderName,
                  bold: true,
                  size: 16,
                  color: '0F172A',
                  font: 'Calibri',
                }),
              ],
            }),
          ]
        : []),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 15 },
        children: [
          new TextRun({
            text: boardLevelCode,
            bold: true,
            size: 22,
            color: '0F172A',
            font: 'Calibri',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 20 },
        children: [
          new TextRun({
            text: subject.toUpperCase(),
            bold: true,
            size: 25,
            color: '0F172A',
            font: 'Calibri',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 15 },
        children: [
          new TextRun({
            text:
              questions.length > 0
                ? `Section – A (Marks ${mcqTotalMarks})`
                : `Subjective Part (Marks ${totalMarks})`,
            bold: true,
            size: 19,
            color: '0F172A',
            font: 'Calibri',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 30 },
        children: [
          new TextRun({
            text:
              questions.length > 0
                ? `Time Allowed: ${resolvedSectionATime} Minutes`
                : `Time Allowed: ${formatDurationHoursMin(durationMinutes)}`,
            bold: true,
            size: 18,
            color: '0F172A',
            font: 'Calibri',
          }),
        ],
      }),
      ...(questions.length > 0
        ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: isRtlSubject ? 20 : 60 },
              children: [
                new TextRun({
                  text: 'Section – A is compulsory. All parts of this section are to be answered on this page and handed over to the Centre Superintendent. Deleting/overwriting is not allowed. Do not use lead pencil.',
                  size: 16,
                  color: '1E293B',
                  font: 'Calibri',
                }),
              ],
            }),
            ...(isRtlSubject
              ? [
                  new Paragraph({
                    bidirectional: true,
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 55 },
                    children: [
                      new TextRun({
                        text: 'نوٹ: حصہ اول لازمی ہے، اس کے جوابات اسی صفحہ پر دے کر ناظم مرکز کے حوالے کردیں۔ کاٹ کر دوبارہ لکھنے کی اجازت نہیں۔ لیڈ پنسل کا استعمال ممنوع ہے۔',
                        size: 16,
                        color: '1E293B',
                        font: 'Tahoma',
                        rightToLeft: true,
                      }),
                    ],
                  }),
                ]
              : []),
          ]
        : []),
      new Paragraph({
        spacing: { before: 35, after: 30 },
        children: [
          new TextRun({
            text: 'Candidate Name: _____________________________',
            bold: true,
            size: 18,
            color: '0F172A',
            font: 'Calibri',
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: 'Class & Section: _____________________________',
            bold: true,
            size: 18,
            color: '0F172A',
            font: 'Calibri',
          }),
        ],
      }),
    ];

    const apsacsRightChildren: Array<Paragraph | Table> = [
      ...(showOmrGrid
        ? [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              layout: TableLayoutType.FIXED,
              rows: [
                new TableRow({
                  cantSplit: true,
                  children: [
                    new TableCell({
                      width: { size: 42, type: WidthType.PERCENTAGE },
                      borders: NO_CELL_BORDERS,
                      margins: { top: 0, bottom: 20, left: 20, right: 40 },
                      children: omrBlockParagraphs(4, 'Version No', '[ ][ ][ ][ ]'),
                    }),
                    new TableCell({
                      width: { size: 58, type: WidthType.PERCENTAGE },
                      borders: NO_CELL_BORDERS,
                      margins: { top: 0, bottom: 20, left: 40, right: 20 },
                      children: omrBlockParagraphs(6, 'Roll Number', '[ ][ ][ ][ ][ ][ ]'),
                    }),
                  ],
                }),
              ],
            }),
          ]
        : [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 20, after: 40 },
              children: [
                new TextRun({ text: 'Version No: ', bold: true, size: 17, font: 'Calibri' }),
                new TextRun({ text: '[ ][ ][ ][ ]   ', bold: true, size: 17, font: 'Consolas' }),
                new TextRun({ text: 'Roll Number: ', bold: true, size: 17, font: 'Calibri' }),
                new TextRun({ text: '[ ][ ][ ][ ][ ][ ]', bold: true, size: 17, font: 'Consolas' }),
              ],
            }),
          ]),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 15 },
        children: [
          new TextRun({
            text: apsacsExamText,
            bold: true,
            size: 18,
            color: '0F172A',
            font: 'Calibri',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 45 },
        children: [
          new TextRun({
            text: apsacsSessionText,
            bold: true,
            size: 18,
            color: '0F172A',
            font: 'Calibri',
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 0, after: 30 },
        children: [
          new TextRun({
            text: 'Answer Sheet No. ___________________________',
            bold: true,
            size: 18,
            color: '0F172A',
            font: 'Calibri',
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: `Sign. of Invigilator _________________________${formattedDate ? ` (${formattedDate})` : ''}`,
            bold: true,
            size: 18,
            color: '0F172A',
            font: 'Calibri',
          }),
        ],
      }),
    ];

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: 52, type: WidthType.PERCENTAGE },
                borders: NO_CELL_BORDERS,
                margins: { top: 20, bottom: 20, left: 20, right: 120 },
                children: apsacsLeftChildren,
              }),
              new TableCell({
                width: { size: 48, type: WidthType.PERCENTAGE },
                borders: NO_CELL_BORDERS,
                margins: { top: 20, bottom: 20, left: 80, right: 20 },
                children: apsacsRightChildren,
              }),
            ],
          }),
        ],
      }),
    );
  } else if (isOfficial) {
    const headerRows: TableRow[] = [];

    // Title Row
    const headerParagraphs: Paragraph[] = [];
    if (customMonogramUrl.trim()) {
      const customLogoPara = createMonogramParagraph(48, 25);
      if (customLogoPara) headerParagraphs.push(customLogoPara);
    }
    if (schoolName.trim()) {
      headerParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 20, after: 40 },
          children: [
            new TextRun({
              text: schoolName.trim().toUpperCase(),
              bold: true,
              size: 26,
              color: '0F172A',
              font: 'Calibri',
            }),
          ],
        }),
      );
    }

    headerParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 25 },
        children: [
          new TextRun({
            text:
              board === 'punjab_ptb'
                ? `PUNJAB BOARD (BISE · PTB) ${boardLevelCode} EXAMINATION`
                : 'FEDERAL BOARD OF INTERMEDIATE AND SECONDARY EDUCATION, ISLAMABAD',
            bold: true,
            size: 20,
            color: '0F172A',
            font: 'Calibri',
          }),
        ],
      }),
    );

    headerParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 20 },
        children: [
          new TextRun({
            text: `${subject.toUpperCase()} ${boardLevelCode} · ${(examLabel.trim() || 'Model Question Paper').toUpperCase()}${patternLabel ? ` (${patternLabel})` : ''}`,
            bold: true,
            size: 19,
            color: '334155',
            font: 'Calibri',
          }),
        ],
      }),
    );

    if (title.trim() && title.trim() !== `${grade} ${subject}`) {
      headerParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 15 },
          children: [
            new TextRun({
              text: title.trim(),
              size: 17,
              color: '475569',
              font: 'Calibri',
            }),
          ],
        }),
      );
    }

    headerRows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            columnSpan: 4,
            borders: {
              top: NO_CELL_BORDERS.top,
              left: NO_CELL_BORDERS.left,
              right: NO_CELL_BORDERS.right,
              bottom: { style: BorderStyle.SINGLE, size: 8, color: '0F172A' },
            },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: headerParagraphs,
          }),
        ],
      }),
    );

    // Version No. + Roll No. OMR Bubbles + Official Candidate / Invigilator Details
    if (showOmrGrid) {
      const omrDigitParagraphs = (cols: number, label: string, boxText: string): Paragraph[] => [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 10, after: 25 },
          children: [
            new TextRun({ text: label, bold: true, size: 17, color: '0F172A', font: 'Calibri' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 35 },
          children: [
            new TextRun({
              text: boxText,
              bold: true,
              size: 16,
              color: '0F172A',
              font: 'Consolas',
            }),
          ],
        }),
        ...CIRCLED_DIGITS.map(
          (digitChar) =>
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 8 },
              children: [
                new TextRun({
                  text: Array.from({ length: cols }, () => digitChar).join(' '),
                  size: 16,
                  color: '1E293B',
                  font: 'Segoe UI Symbol',
                }),
              ],
            }),
        ),
      ];

      headerRows.push(
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              columnSpan: 4,
              borders: {
                top: NO_CELL_BORDERS.top,
                left: NO_CELL_BORDERS.left,
                right: NO_CELL_BORDERS.right,
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
              },
              margins: { top: 45, bottom: 45, left: 80, right: 80 },
              children: [
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  layout: TableLayoutType.FIXED,
                  rows: [
                    new TableRow({
                      cantSplit: true,
                      children: [
                        new TableCell({
                          width: { size: 22, type: WidthType.PERCENTAGE },
                          borders: {
                            top: NO_CELL_BORDERS.top,
                            bottom: NO_CELL_BORDERS.bottom,
                            left: NO_CELL_BORDERS.left,
                            right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                          },
                          margins: { top: 20, bottom: 20, left: 30, right: 30 },
                          children: omrDigitParagraphs(4, 'VERSION NO.', '[ ] [ ] [ ] [ ]'),
                        }),
                        new TableCell({
                          width: { size: 32, type: WidthType.PERCENTAGE },
                          borders: {
                            top: NO_CELL_BORDERS.top,
                            bottom: NO_CELL_BORDERS.bottom,
                            left: NO_CELL_BORDERS.left,
                            right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                          },
                          margins: { top: 20, bottom: 20, left: 30, right: 30 },
                          children: omrDigitParagraphs(6, 'ROLL NO.', '[ ] [ ] [ ] [ ] [ ] [ ]'),
                        }),
                        new TableCell({
                          width: { size: 46, type: WidthType.PERCENTAGE },
                          borders: NO_CELL_BORDERS,
                          margins: { top: 25, bottom: 20, left: 90, right: 40 },
                          children: [
                            new Paragraph({
                              spacing: { before: 10, after: 35 },
                              children: [
                                new TextRun({
                                  text: 'Answer Sheet No.: _______________________',
                                  size: 17,
                                  color: '0F172A',
                                  font: 'Calibri',
                                }),
                              ],
                            }),
                            new Paragraph({
                              spacing: { before: 0, after: 35 },
                              children: [
                                new TextRun({
                                  text: 'Name of Candidate: ______________________',
                                  size: 17,
                                  color: '0F172A',
                                  font: 'Calibri',
                                }),
                              ],
                            }),
                            new Paragraph({
                              spacing: { before: 0, after: 35 },
                              children: [
                                new TextRun({
                                  text: 'Sign. of Candidate: _______________________',
                                  size: 17,
                                  color: '0F172A',
                                  font: 'Calibri',
                                }),
                              ],
                            }),
                            new Paragraph({
                              spacing: { before: 0, after: 45 },
                              children: [
                                new TextRun({
                                  text: `Sign. of Invigilator: ____________   Date: ${formattedDate || '__________'}`,
                                  size: 17,
                                  color: '0F172A',
                                  font: 'Calibri',
                                }),
                              ],
                            }),
                            new Paragraph({
                              border: {
                                top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                                left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                                right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                              },
                              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F8FAFC' },
                              spacing: { before: 15, after: 0 },
                              children: [
                                new TextRun({
                                  text: ' Use Blue/Black Ballpoint Pen only (Lead pencil prohibited). Fill circle completely: ● (Correct) | ✕ ✓ (Wrong). Do not overwrite.',
                                  size: 15,
                                  color: '334155',
                                  font: 'Calibri',
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      );
    } else {
      headerRows.push(
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              columnSpan: 2,
              borders: {
                top: NO_CELL_BORDERS.top,
                left: NO_CELL_BORDERS.left,
                right: NO_CELL_BORDERS.right,
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
              },
              margins: { top: 65, bottom: 65, left: 100, right: 60 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 20 },
                  children: [
                    new TextRun({ text: 'Version No.: ', bold: true, size: 17, font: 'Calibri' }),
                    new TextRun({ text: '[ ][ ][ ][ ]   ', bold: true, size: 17, font: 'Consolas' }),
                    new TextRun({ text: 'ROLL NO.: ', bold: true, size: 17, font: 'Calibri' }),
                    new TextRun({ text: '[ ][ ][ ][ ][ ][ ]', bold: true, size: 17, font: 'Consolas' }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: 'Answer Sheet No.: ___________________',
                      size: 17,
                      color: '1E293B',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              columnSpan: 2,
              borders: {
                top: NO_CELL_BORDERS.top,
                left: NO_CELL_BORDERS.left,
                right: NO_CELL_BORDERS.right,
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
              },
              margins: { top: 65, bottom: 65, left: 60, right: 100 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 20 },
                  children: [
                    new TextRun({
                      text: 'Name of Candidate: ________________________',
                      size: 17,
                      color: '1E293B',
                      font: 'Calibri',
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: `Sign. Candidate: ________  Sign. Invigilator: ________  Date: ${formattedDate || '________'}`,
                      size: 16,
                      color: '1E293B',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      );
    }

    // Metadata Row
    const metaValues = [
      `Examination: ${boardLevelCode} (${GRADE_LABELS[grade]})`,
      `Subject: ${subject}`,
      `Total Marks: ${totalMarks}`,
      `Total Time: ${formatDurationHoursMin(durationMinutes)}${formattedDate ? ` · ${formattedDate}` : ''}`,
    ];

    headerRows.push(
      new TableRow({
        cantSplit: true,
        children: metaValues.map(
          (val) =>
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              borders: NO_CELL_BORDERS,
              margins: { top: 65, bottom: 65, left: 100, right: 100 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: val,
                      bold: true,
                      size: 18,
                      color: '0F172A',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
        ),
      }),
    );

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        borders: {
          top: { style: BorderStyle.DOUBLE, size: 12, color: '0F172A' },
          bottom: { style: BorderStyle.DOUBLE, size: 12, color: '0F172A' },
          left: { style: BorderStyle.DOUBLE, size: 12, color: '0F172A' },
          right: { style: BorderStyle.DOUBLE, size: 12, color: '0F172A' },
        },
        rows: headerRows,
      }),
    );
  } else {
    // Standard School Sheet Header
    if (customMonogramUrl.trim()) {
      const customLogoPara = createMonogramParagraph(50, 25);
      if (customLogoPara) children.push(customLogoPara);
    }
    if (schoolName.trim()) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 30 },
          children: [
            new TextRun({
              text: schoolName.trim().toUpperCase(),
              bold: true,
              size: 30,
              color: '0F172A',
              font: 'Calibri',
            }),
          ],
        }),
      );
    }
    if (examLabel.trim()) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 40 },
          children: [
            new TextRun({
              text: examLabel.trim().toUpperCase(),
              bold: true,
              size: 21,
              color: '1E293B',
              font: 'Calibri',
            }),
          ],
        }),
      );
    }

    children.push(
      new Paragraph({
        spacing: { before: 20, after: 20 },
        children: [
          new TextRun({
            text: BOARD_PRINT_LABELS[board].toUpperCase(),
            bold: true,
            size: 17,
            color: '475569',
            font: 'Calibri',
          }),
        ],
      }),
    );

    children.push(
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        spacing: { before: 0, after: 40 },
        children: [
          new TextRun({
            text: title.trim() || 'Assessment Paper',
            bold: true,
            size: 28,
            color: '0F172A',
            font: 'Calibri',
          }),
          new TextRun({
            text: `\tTotal Marks: ${totalMarks} · Time: ${durationMinutes} Min${formattedDate ? ` · Date: ${formattedDate}` : ''}`,
            bold: true,
            size: 19,
            color: '334155',
            font: 'Calibri',
          }),
        ],
      }),
    );

    children.push(
      new Paragraph({
        spacing: { before: 0, after: 60 },
        children: [
          new TextRun({
            text: `Class: ${GRADE_LABELS[grade]}   ·   Subject: ${subject}`,
            size: 20,
            color: '334155',
            font: 'Calibri',
          }),
        ],
      }),
    );

    children.push(
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          bottom: { style: BorderStyle.SINGLE, size: 12, color: '0F172A' },
        },
        spacing: { before: 20, after: 140 },
        children: [
          new TextRun({
            text: 'Student Name: ____________________________',
            size: 19,
            color: '475569',
            font: 'Calibri',
          }),
          new TextRun({
            text: `\tRoll No.: ______________   ${formattedDate ? `Date: ${formattedDate}` : 'Date: __________'}`,
            size: 19,
            color: '475569',
            font: 'Calibri',
          }),
        ],
      }),
    );
  }

  // Spacer after header
  children.push(new Paragraph({ spacing: { before: 80, after: 80 }, children: [] }));

  // 2. Section A: Objective MCQs
  if (questions.length > 0) {
    if (isApsacs) {
      children.push(
        new Paragraph({
          spacing: { before: 40, after: compactLayout ? 55 : 90 },
          children: [
            new TextRun({
              text: `Q-${mcqQuestionNum}: Fill the relevant bubble for each part. Each part carries ${marksPerQuestionPhrase}.`,
              bold: true,
              size: 19,
              color: '0F172A',
              font: 'Calibri',
            }),
          ],
        }),
      );
    } else if (isOfficial) {
      children.push(
        createSectionBanner(
          `SECTION – A (Marks ${mcqTotalMarks})`,
          `Time allowed: ${resolvedSectionATime} minutes`,
          true,
        ),
      );
      children.push(
        new Paragraph({
          spacing: { before: 60, after: isRtlSubject ? 25 : 35 },
          children: [
            new TextRun({
              text: `Note: Section – A is compulsory. All parts of this section are to be answered on the separately provided OMR Answer Sheet / question paper itself. It should be completed in the first ${resolvedSectionATime} minutes and handed over to the Centre Superintendent. Deleting/overwriting is not allowed. Do not use lead pencil.`,
              size: 16,
              color: '334155',
              font: 'Calibri',
            }),
          ],
        }),
      );
      if (isRtlSubject) {
        children.push(
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.RIGHT,
            spacing: { before: 0, after: 35 },
            children: [
              new TextRun({
                text: 'نوٹ: حصہ اول لازمی ہے، اس کے جوابات اسی صفحہ پر دے کر ناظم مرکز کے حوالے کردیں۔ کاٹ کر دوبارہ لکھنے کی اجازت نہیں۔ لیڈ پنسل کا استعمال ممنوع ہے۔',
                size: 17,
                color: '1E293B',
                font: 'Tahoma',
                rightToLeft: true,
              }),
            ],
          }),
        );
      }
      children.push(
        new Paragraph({
          spacing: { before: 0, after: compactLayout ? 70 : 110 },
          children: [
            new TextRun({
              text: `Q.${mcqQuestionNum} Fill the relevant bubble / circle against each question according to curriculum. Each part carries ${marksPerQuestionPhrase}.`,
              bold: true,
              size: 18,
              color: '0F172A',
              font: 'Calibri',
            }),
          ],
        }),
      );
    } else {
      children.push(
        createSectionBanner(
          `Question ${mcqQuestionNum}: Multiple Choice Questions (Objective)`,
          `Marks: ${mcqTotalMarks} (${questions.length} × ${marksPerQuestion})`,
          false,
        ),
      );
      children.push(
        new Paragraph({
          spacing: { before: 70, after: compactLayout ? 80 : 120 },
          children: [
            new TextRun({
              text: 'Note: Choose the correct option (A, B, C, or D) for each statement below.',
              bold: true,
              size: 18,
              color: '334155',
              font: 'Calibri',
            }),
          ],
        }),
      );
    }

    if (twoColumnMcqs) {
      const mcqPairRows: TableRow[] = [];
      for (let i = 0; i < questions.length; i += 2) {
        const leftQ = questions[i];
        const rightQ = questions[i + 1];

        const buildMcqCellParagraphs = (qItem: MCQQuestion | undefined, num: number): Paragraph[] => {
          if (!qItem) return [new Paragraph({ children: [] })];
          const optLine1 = [0, 1]
            .filter((idx) => qItem.options[idx] !== undefined)
            .map((idx) => `${optionTag(idx)}${qItem.options[idx]}`)
            .join('    ');
          const optLine2 = [2, 3]
            .filter((idx) => qItem.options[idx] !== undefined)
            .map((idx) => `${optionTag(idx)}${qItem.options[idx]}`)
            .join('    ');

          return [
            new Paragraph({
              spacing: { before: 30, after: 15 },
              children: [
                new TextRun({ text: `${num}. `, bold: true, size: qFontSize, color: '0F172A', font: 'Calibri' }),
                new TextRun({ text: qItem.prompt, bold: true, size: qFontSize, color: '0F172A', font: 'Calibri' }),
              ],
            }),
            new Paragraph({
              indent: { left: convertInchesToTwip(0.16) },
              spacing: { before: 0, after: 10 },
              children: [new TextRun({ text: optLine1, size: optFontSize, color: '1E293B', font: 'Calibri' })],
            }),
            ...(optLine2
              ? [
                  new Paragraph({
                    indent: { left: convertInchesToTwip(0.16) },
                    spacing: { before: 0, after: 30 },
                    children: [new TextRun({ text: optLine2, size: optFontSize, color: '1E293B', font: 'Calibri' })],
                  }),
                ]
              : []),
          ];
        };

        mcqPairRows.push(
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: 49, type: WidthType.PERCENTAGE },
                borders: {
                  top: NO_CELL_BORDERS.top,
                  left: NO_CELL_BORDERS.left,
                  right: NO_CELL_BORDERS.right,
                  bottom: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
                },
                margins: { top: 20, bottom: 25, left: 40, right: 80 },
                children: buildMcqCellParagraphs(leftQ, i + 1),
              }),
              new TableCell({
                width: { size: 2, type: WidthType.PERCENTAGE },
                borders: NO_CELL_BORDERS,
                children: [new Paragraph({ children: [] })],
              }),
              new TableCell({
                width: { size: 49, type: WidthType.PERCENTAGE },
                borders: {
                  top: NO_CELL_BORDERS.top,
                  left: NO_CELL_BORDERS.left,
                  right: NO_CELL_BORDERS.right,
                  bottom: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
                },
                margins: { top: 20, bottom: 25, left: 80, right: 40 },
                children: buildMcqCellParagraphs(rightQ, i + 2),
              }),
            ],
          }),
        );
      }

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: mcqPairRows,
        }),
      );
    } else if (isOfficial) {
      const mcqHeaderBorders = {
        top: { style: BorderStyle.SINGLE, size: 6, color: '475569' },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '475569' },
        left: { style: BorderStyle.SINGLE, size: 4, color: '64748B' },
        right: { style: BorderStyle.SINGLE, size: 4, color: '64748B' },
      };

      const makeHeaderCell = (label: string, widthPct: number, centered = true) =>
        new TableCell({
          width: { size: widthPct, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F1F5F9' },
          verticalAlign: VerticalAlign.CENTER,
          borders: mcqHeaderBorders,
          margins: { top: 35, bottom: 35, left: 40, right: 40 },
          children: [
            new Paragraph({
              alignment: centered ? AlignmentType.CENTER : AlignmentType.LEFT,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: label,
                  bold: true,
                  size: 15,
                  color: '1E293B',
                  font: 'Calibri',
                }),
              ],
            }),
          ],
        });

      const fbiseMcqRows: TableRow[] = [
        new TableRow({
          tableHeader: true,
          cantSplit: true,
          children: [
            makeHeaderCell(isApsacs ? 'Ser' : 'S#', 7, true),
            makeHeaderCell(isApsacs ? 'Question' : 'QUESTION', 33, false),
            makeHeaderCell(isApsacs ? 'A' : '(A)', 11, true),
            makeHeaderCell(isApsacs ? 'B' : '(B)', 11, true),
            makeHeaderCell(isApsacs ? 'C' : '(C)', 11, true),
            makeHeaderCell(isApsacs ? 'D' : '(D)', 11, true),
            makeHeaderCell('A B C D', 16, true),
          ],
        }),
      ];

      questions.forEach((q, idx) => {
        const rowIsRtl = isRtlSubject || hasRtlScript(q.prompt) || q.options.some((o) => hasRtlScript(o));
        const textFont = rowIsRtl ? 'Tahoma' : 'Calibri';
        const totalOptionChars = q.options.reduce((sum, opt) => sum + opt.trim().length, 0);
        const anyOptionTooLong =
          q.options.some((opt) => opt.trim().length > 26) || totalOptionChars > 84;

        const bodyCellBorders = {
          top: NO_CELL_BORDERS.top,
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
        };

        const serialCell = new TableCell({
          width: { size: 7, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          shading: isApsacs ? undefined : { type: ShadingType.CLEAR, color: 'auto', fill: 'F8FAFC' },
          borders: {
            ...bodyCellBorders,
            left: { style: BorderStyle.SINGLE, size: 6, color: '64748B' },
          },
          margins: { top: compactLayout ? 25 : 45, bottom: compactLayout ? 25 : 45, left: 25, right: 25 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: isApsacs ? `${idx + 1}.` : `(${idx + 1})`,
                  bold: true,
                  size: qFontSize - 1,
                  color: '0F172A',
                  font: 'Calibri',
                }),
              ],
            }),
          ],
        });

        const bubblesCell = new TableCell({
          width: { size: 16, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          shading: isApsacs ? undefined : { type: ShadingType.CLEAR, color: 'auto', fill: 'F8FAFC' },
          borders: {
            ...bodyCellBorders,
            right: { style: BorderStyle.SINGLE, size: 6, color: '64748B' },
          },
          margins: { top: 20, bottom: 20, left: 20, right: 20 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: (isApsacs ? OPEN_CIRCLES : CIRCLED_LETTERS).join(' '),
                  size: compactLayout ? 17 : 19,
                  color: '0F172A',
                  font: 'Segoe UI Symbol',
                }),
              ],
            }),
          ],
        });

        const middleCells: TableCell[] = anyOptionTooLong
          ? [
              new TableCell({
                columnSpan: 5,
                width: { size: 77, type: WidthType.PERCENTAGE },
                borders: bodyCellBorders,
                margins: {
                  top: compactLayout ? 25 : 45,
                  bottom: compactLayout ? 25 : 45,
                  left: 70,
                  right: 70,
                },
                children: [
                  new Paragraph({
                    bidirectional: rowIsRtl,
                    alignment: rowIsRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                    spacing: { before: 0, after: 15 },
                    children: [
                      new TextRun({
                        text: q.prompt,
                        bold: true,
                        size: qFontSize,
                        color: '0F172A',
                        font: textFont,
                        rightToLeft: rowIsRtl,
                      }),
                    ],
                  }),
                  ...[0, 2].map(
                    (startIdx) =>
                      new Paragraph({
                        bidirectional: rowIsRtl,
                        alignment: rowIsRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                        tabStops: [{ type: TabStopType.LEFT, position: convertInchesToTwip(2.65) }],
                        spacing: { before: 0, after: startIdx === 0 ? 10 : 0 },
                        children: [
                          new TextRun({
                            text: `(${String.fromCharCode(65 + startIdx)}) `,
                            bold: true,
                            size: optFontSize,
                            color: '0F172A',
                            font: 'Calibri',
                          }),
                          new TextRun({
                            text: q.options[startIdx] ?? '',
                            size: optFontSize,
                            color: '1E293B',
                            font: textFont,
                            rightToLeft: rowIsRtl,
                          }),
                          ...(q.options[startIdx + 1] !== undefined
                            ? [
                                new TextRun({
                                  text: `\t(${String.fromCharCode(65 + startIdx + 1)}) `,
                                  bold: true,
                                  size: optFontSize,
                                  color: '0F172A',
                                  font: 'Calibri',
                                }),
                                new TextRun({
                                  text: q.options[startIdx + 1] ?? '',
                                  size: optFontSize,
                                  color: '1E293B',
                                  font: textFont,
                                  rightToLeft: rowIsRtl,
                                }),
                              ]
                            : []),
                        ],
                      }),
                  ),
                ],
              }),
            ]
          : [
              new TableCell({
                width: { size: 33, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                borders: bodyCellBorders,
                margins: {
                  top: compactLayout ? 25 : 45,
                  bottom: compactLayout ? 25 : 45,
                  left: 65,
                  right: 65,
                },
                children: [
                  new Paragraph({
                    bidirectional: rowIsRtl,
                    alignment: rowIsRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                    spacing: { before: 0, after: 0 },
                    children: [
                      new TextRun({
                        text: q.prompt,
                        bold: true,
                        size: qFontSize,
                        color: '0F172A',
                        font: textFont,
                        rightToLeft: rowIsRtl,
                      }),
                    ],
                  }),
                ],
              }),
              ...[0, 1, 2, 3].map(
                (optIdx) =>
                  new TableCell({
                    width: { size: 11, type: WidthType.PERCENTAGE },
                    verticalAlign: VerticalAlign.CENTER,
                    borders: bodyCellBorders,
                    margins: {
                      top: compactLayout ? 25 : 45,
                      bottom: compactLayout ? 25 : 45,
                      left: 35,
                      right: 35,
                    },
                    children: [
                      new Paragraph({
                        bidirectional: rowIsRtl,
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 0 },
                        children: [
                          new TextRun({
                            text: q.options[optIdx] ?? '',
                            size: optFontSize,
                            color: '1E293B',
                            font: textFont,
                            rightToLeft: rowIsRtl,
                          }),
                        ],
                      }),
                    ],
                  }),
              ),
            ];

        fbiseMcqRows.push(
          new TableRow({
            cantSplit: true,
            children: [serialCell, ...middleCells, bubblesCell],
          }),
        );
      });

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: fbiseMcqRows,
        }),
      );
    } else {
      questions.forEach((q, idx) => {
        children.push(
          new Paragraph({
            keepNext: true,
            spacing: { before: compactLayout ? 25 : 70, after: 15 },
            children: [
              new TextRun({
                text: `${idx + 1}. `,
                bold: true,
                size: qFontSize,
                color: '0F172A',
                font: 'Calibri',
              }),
              new TextRun({
                text: q.prompt,
                bold: true,
                size: qFontSize,
                color: '0F172A',
                font: 'Calibri',
              }),
            ],
          }),
        );

        // 2-column options table for clean alignment
        const optionRows: TableRow[] = [];
        for (let r = 0; r < q.options.length; r += 2) {
          const leftText = q.options[r] ?? '';
          const rightLetter = q.options[r + 1] !== undefined ? String.fromCharCode(65 + r + 1) : '';
          const rightText = q.options[r + 1] ?? '';

          optionRows.push(
            new TableRow({
              cantSplit: true,
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: NO_CELL_BORDERS,
                  margins: { top: 10, bottom: 15, left: 220, right: 70 },
                  children: [
                    new Paragraph({
                      spacing: { before: 0, after: 0 },
                      children: [
                        new TextRun({
                          text: optionTag(r),
                          bold: true,
                          size: optFontSize,
                          color: '1E293B',
                          font: 'Calibri',
                        }),
                        new TextRun({
                          text: leftText,
                          size: optFontSize,
                          color: '1E293B',
                          font: 'Calibri',
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: NO_CELL_BORDERS,
                  margins: { top: 10, bottom: 15, left: 70, right: 40 },
                  children: [
                    new Paragraph({
                      spacing: { before: 0, after: 0 },
                      children: rightLetter
                        ? [
                            new TextRun({
                              text: optionTag(r + 1),
                              bold: true,
                              size: optFontSize,
                              color: '1E293B',
                              font: 'Calibri',
                            }),
                            new TextRun({
                              text: rightText,
                              size: optFontSize,
                              color: '1E293B',
                              font: 'Calibri',
                            }),
                          ]
                        : [],
                    }),
                  ],
                }),
              ],
            }),
          );
        }

        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: optionRows,
          }),
        );
      });
    }

    if (isApsacs) {
      children.push(
        new Paragraph({
          tabStops: [
            { type: TabStopType.CENTER, position: TabStopPosition.MAX / 2 },
            { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
          ],
          spacing: { before: 65, after: 35 },
          children: [
            new TextRun({
              text: `Class: ${romanGrade}`,
              bold: true,
              size: 17,
              color: '0F172A',
              font: 'Calibri',
            }),
            new TextRun({
              text: `\tSection – A (${questions.length} MCQs · ${mcqTotalMarks} Marks)`,
              size: 16,
              color: '475569',
              font: 'Calibri',
            }),
            new TextRun({
              text: `\tSubject: ${subject}`,
              bold: true,
              size: 17,
              color: '0F172A',
              font: 'Calibri',
            }),
          ],
        }),
      );
    }
  }

  // Subjective Part Header (Sections B & C)
  if (isOfficial && (shortQuestions.length > 0 || longQuestions.length > 0)) {
    if (separateSectionA && questions.length > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    } else if (questions.length > 0) {
      children.push(new Paragraph({ spacing: { before: 80, after: 60 }, children: [] }));
    }

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F8FAFC' },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 12, color: '0F172A' },
                  bottom: { style: BorderStyle.SINGLE, size: 12, color: '0F172A' },
                  left: { style: BorderStyle.SINGLE, size: 12, color: '0F172A' },
                  right: { style: BorderStyle.SINGLE, size: 12, color: '0F172A' },
                },
                margins: { top: 65, bottom: 65, left: 100, right: 100 },
                children: [
                  ...(separateSectionA && questions.length > 0 && isApsacs
                    ? [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { before: 0, after: 15 },
                          children: [
                            new TextRun({
                              text: schoolName.trim()
                                ? schoolName.trim().toUpperCase()
                                : 'ARMY PUBLIC SCHOOLS & COLLEGES SYSTEM',
                              bold: true,
                              size: 18,
                              color: '0F172A',
                              font: 'Calibri',
                            }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' } },
                          spacing: { before: 0, after: 35 },
                          children: [
                            new TextRun({
                              text: `${subject.toUpperCase()} ${boardLevelCode} — SUBJECTIVE PART · ${(examLabel.trim() || 'PRE-BOARD EXAMINATION (COLD & WARM REGION)').toUpperCase()} (${(sessionLabel || 'SESSION 2026-2027').toUpperCase()})`,
                              bold: true,
                              size: 17,
                              color: '0F172A',
                              font: 'Calibri',
                            }),
                          ],
                        }),
                      ]
                    : []),
                  new Paragraph({
                    tabStops: [
                      { type: TabStopType.CENTER, position: TabStopPosition.MAX / 2 },
                      { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
                    ],
                    spacing: { before: 0, after: 35 },
                    children: [
                      new TextRun({
                        text: `Time Allowed: ${formatDurationHoursMin(resolvedSubjectiveTime)}`,
                        bold: true,
                        size: 18,
                        color: '0F172A',
                        font: 'Calibri',
                      }),
                      new TextRun({
                        text: `\t${boardLevelCode} ${subject.toUpperCase()} — SUBJECTIVE PART (SECTIONS B & C)`,
                        bold: true,
                        size: 18,
                        color: '0F172A',
                        font: 'Calibri',
                      }),
                      new TextRun({
                        text: `\tTotal Marks Section B & C: ${subjectiveTotalMarks}`,
                        bold: true,
                        size: 18,
                        color: '0F172A',
                        font: 'Calibri',
                      }),
                    ],
                  }),
                  new Paragraph({
                    spacing: { before: 0, after: isRtlSubject ? 20 : 0 },
                    children: [
                      new TextRun({
                        text: "Note: Answer all parts from Section 'B' and all questions from Section 'C' on the E-sheet. Write your answers on the allotted / given spaces.",
                        size: 16,
                        color: '334155',
                        font: 'Calibri',
                      }),
                    ],
                  }),
                  ...(isRtlSubject
                    ? [
                        new Paragraph({
                          bidirectional: true,
                          alignment: AlignmentType.RIGHT,
                          spacing: { before: 0, after: 0 },
                          children: [
                            new TextRun({
                              text: 'نوٹ: حصہ دوم (Section B) اور حصہ سوم (Section C) کے تمام سوالات کے جوابات مہیا کی گئی جوابی کاپی (E-Sheet) پر مقررہ جگہ پر تحریر کریں۔',
                              size: 16,
                              color: '1E293B',
                              font: 'Tahoma',
                              rightToLeft: true,
                            }),
                          ],
                        }),
                      ]
                    : []),
                ],
              }),
            ],
          }),
        ],
      }),
    );
    children.push(new Paragraph({ spacing: { before: 50, after: 50 }, children: [] }));
  } else if (questions.length > 0 && (shortQuestions.length > 0 || longQuestions.length > 0)) {
    children.push(new Paragraph({ spacing: { before: 80, after: 80 }, children: [] }));
  }

  // 3. Section B: Short Questions
  if (shortQuestions.length > 0) {
    children.push(
      createSectionBanner(
        isOfficial
          ? `SECTION – B (Marks ${shortTotalMarks})`
          : `Q.${shortQuestionNum}: Short Answer Questions`,
        isOfficial
          ? `Q.${shortQuestionNum} (${shortQuestions.length} Parts · ${shortTotalMarks} Marks)`
          : `(${shortQuestions.length} Parts · ${shortTotalMarks} Marks)`,
        isOfficial,
      ),
    );

    const shortNote = shortChoiceNote.trim()
      ? `Q.${shortQuestionNum}: ${shortChoiceNote.trim()}`
      : hasShortOr
        ? `Q.${shortQuestionNum}: Attempt the following parts on the E-sheet (internal OR choice provided).`
        : `Q.${shortQuestionNum}: Write concise, to-the-point answers for the short parts below.`;

    children.push(
      new Paragraph({
        spacing: { before: 70, after: compactLayout ? 70 : 110 },
        children: [
          new TextRun({
            text: shortNote,
            bold: true,
            size: 18,
            color: '334155',
            font: 'Calibri',
          }),
        ],
      }),
    );

    const buildSubjectiveOrTable = (
      col1Label: string,
      items: SubjectiveQuestion[],
      getLabel: (idx: number) => string,
      rowVerticalMargin: number,
    ): Table => {
      const hdrBorder = {
        top: { style: BorderStyle.SINGLE, size: 6, color: '475569' },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '475569' },
        left: { style: BorderStyle.SINGLE, size: 4, color: '64748B' },
        right: { style: BorderStyle.SINGLE, size: 4, color: '64748B' },
      };

      const makeSubHdrCell = (text: string, widthPct: number, centered = true) =>
        new TableCell({
          width: { size: widthPct, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F1F5F9' },
          verticalAlign: VerticalAlign.CENTER,
          borders: hdrBorder,
          margins: { top: 35, bottom: 35, left: 40, right: 40 },
          children: [
            new Paragraph({
              alignment: centered ? AlignmentType.CENTER : AlignmentType.LEFT,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text,
                  bold: true,
                  size: 15,
                  color: '1E293B',
                  font: 'Calibri',
                }),
              ],
            }),
          ],
        });

      const headerRow = new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: [
          makeSubHdrCell(col1Label, 7, true),
          makeSubHdrCell('QUESTIONS', 40, false),
          makeSubHdrCell('OR', 7, true),
          makeSubHdrCell('ALTERNATIVE QUESTION', 38, false),
          makeSubHdrCell('MARKS', 8, true),
        ],
      });

      const bodyRows = items.map((item, idx) => {
        const leftRtl = isRtlSubject || hasRtlScript(item.prompt);
        const rightRtl = isRtlSubject || hasRtlScript(item.orPrompt);
        const rowBorders = {
          top: NO_CELL_BORDERS.top,
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
        };

        return new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 7, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F8FAFC' },
              borders: {
                ...rowBorders,
                left: { style: BorderStyle.SINGLE, size: 6, color: '64748B' },
              },
              margins: { top: rowVerticalMargin, bottom: rowVerticalMargin, left: 20, right: 20 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: getLabel(idx),
                      bold: true,
                      size: qFontSize,
                      color: '0F172A',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              borders: rowBorders,
              margins: { top: rowVerticalMargin, bottom: rowVerticalMargin, left: 55, right: 55 },
              children: [
                new Paragraph({
                  bidirectional: leftRtl,
                  alignment: leftRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: item.prompt,
                      size: qFontSize,
                      color: '0F172A',
                      font: leftRtl ? 'Tahoma' : 'Calibri',
                      rightToLeft: leftRtl,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 7, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F8FAFC' },
              verticalAlign: VerticalAlign.CENTER,
              borders: rowBorders,
              margins: { top: rowVerticalMargin, bottom: rowVerticalMargin, left: 15, right: 15 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: item.orPrompt?.trim() ? 'OR' : '—',
                      bold: true,
                      size: 16,
                      color: '475569',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 38, type: WidthType.PERCENTAGE },
              borders: rowBorders,
              margins: { top: rowVerticalMargin, bottom: rowVerticalMargin, left: 55, right: 55 },
              children: [
                new Paragraph({
                  bidirectional: rightRtl,
                  alignment: rightRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: item.orPrompt?.trim() || '',
                      size: qFontSize,
                      color: '0F172A',
                      font: rightRtl ? 'Tahoma' : 'Calibri',
                      rightToLeft: rightRtl,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 8, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F8FAFC' },
              verticalAlign: VerticalAlign.CENTER,
              borders: {
                ...rowBorders,
                right: { style: BorderStyle.SINGLE, size: 6, color: '64748B' },
              },
              margins: { top: rowVerticalMargin, bottom: rowVerticalMargin, left: 20, right: 20 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: `[${formatMarksBadge(item.marks)}]`,
                      bold: true,
                      size: 17,
                      color: '334155',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      });

      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        rows: [headerRow, ...bodyRows],
      });
    };

    if (sideBySideOr && hasShortOr) {
      children.push(
        buildSubjectiveOrTable('PART', shortQuestions, (idx) => formatRomanPart(idx), 35),
      );
    } else {
      shortQuestions.forEach((sq, idx) => {
        const rowRtl = isRtlSubject || hasRtlScript(sq.prompt) || hasRtlScript(sq.orPrompt);
        children.push(
          new Paragraph({
            bidirectional: rowRtl,
            alignment: rowRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            keepNext: Boolean(sq.orPrompt?.trim()),
            spacing: { before: compactLayout ? 35 : 80, after: sq.orPrompt?.trim() ? 15 : 50 },
            children: [
              new TextRun({
                text: `${formatRomanPart(idx)} `,
                bold: true,
                size: qFontSize,
                color: '0F172A',
                font: 'Calibri',
              }),
              new TextRun({
                text: sq.prompt,
                size: qFontSize,
                color: '0F172A',
                font: rowRtl ? 'Tahoma' : 'Calibri',
                rightToLeft: rowRtl,
              }),
              new TextRun({
                text: `\t[${formatMarksBadge(sq.marks)} Marks]`,
                bold: true,
                size: 17,
                color: '475569',
                font: 'Calibri',
              }),
            ],
          }),
        );

        if (sq.orPrompt?.trim()) {
          children.push(
            new Paragraph({
              indent: { left: convertInchesToTwip(0.3) },
              keepNext: true,
              spacing: { before: 8, after: 8 },
              children: [
                new TextRun({
                  text: '— OR —',
                  bold: true,
                  size: 16,
                  color: '475569',
                  font: 'Calibri',
                }),
              ],
            }),
          );
          children.push(
            new Paragraph({
              bidirectional: rowRtl,
              alignment: rowRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
              indent: { left: convertInchesToTwip(0.3) },
              spacing: { before: 0, after: 45 },
              children: [
                new TextRun({
                  text: sq.orPrompt.trim(),
                  size: qFontSize,
                  color: '0F172A',
                  font: rowRtl ? 'Tahoma' : 'Calibri',
                  rightToLeft: rowRtl,
                }),
              ],
            }),
          );
        }
      });
    }
  }

  // 4. Section C: Long Questions (Q.3, Q.4, Q.5, Q.6...)
  if (longQuestions.length > 0) {
    if (shortQuestions.length > 0) {
      children.push(new Paragraph({ spacing: { before: compactLayout ? 40 : 80, after: compactLayout ? 40 : 80 }, children: [] }));
    }

    const longRangeLabel = `Q.${longStartNum}${longQuestions.length > 1 ? `–Q.${longStartNum + longQuestions.length - 1}` : ''}`;

    children.push(
      createSectionBanner(
        isOfficial
          ? `SECTION – C (Marks ${longTotalMarks})`
          : 'SECTION – C: Long / Extended Questions',
        isOfficial
          ? `${longRangeLabel} (${longQuestions.length} ${longQuestions.length === 1 ? 'Question' : 'Questions'})`
          : `(${longQuestions.length} ${longQuestions.length === 1 ? 'Question' : 'Questions'} · ${longTotalMarks} Marks)`,
        isOfficial,
      ),
    );

    const longNote = longChoiceNote.trim()
      ? `Note: ${longChoiceNote.trim()}`
      : hasLongOr
        ? 'Note: Attempt all questions. Marks of each question are given along with each question (internal OR choice provided).'
        : 'Note: Attempt all questions below with detailed explanations, diagrams, or equations where applicable.';

    children.push(
      new Paragraph({
        spacing: { before: 50, after: compactLayout ? 50 : 100 },
        children: [
          new TextRun({
            text: longNote,
            bold: true,
            size: 17,
            color: '334155',
            font: 'Calibri',
          }),
        ],
      }),
    );

    if (sideBySideOr && hasLongOr) {
      const hdrBorder = {
        top: { style: BorderStyle.SINGLE, size: 6, color: '475569' },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '475569' },
        left: { style: BorderStyle.SINGLE, size: 4, color: '64748B' },
        right: { style: BorderStyle.SINGLE, size: 4, color: '64748B' },
      };

      const makeLongHdrCell = (text: string, widthPct: number, centered = true) =>
        new TableCell({
          width: { size: widthPct, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F1F5F9' },
          verticalAlign: VerticalAlign.CENTER,
          borders: hdrBorder,
          margins: { top: 35, bottom: 35, left: 40, right: 40 },
          children: [
            new Paragraph({
              alignment: centered ? AlignmentType.CENTER : AlignmentType.LEFT,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text,
                  bold: true,
                  size: 15,
                  color: '1E293B',
                  font: 'Calibri',
                }),
              ],
            }),
          ],
        });

      const longHeaderRow = new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: [
          makeLongHdrCell('Q.#', 7, true),
          makeLongHdrCell('QUESTIONS', 40, false),
          makeLongHdrCell('OR', 7, true),
          makeLongHdrCell('ALTERNATIVE QUESTION', 38, false),
          makeLongHdrCell('MARKS', 8, true),
        ],
      });

      const longTableRows = longQuestions.map((lq, idx) => {
        const leftRtl = isRtlSubject || hasRtlScript(lq.prompt);
        const rightRtl = isRtlSubject || hasRtlScript(lq.orPrompt);
        const rowBorders = {
          top: NO_CELL_BORDERS.top,
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
        };

        return new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 7, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F8FAFC' },
              borders: {
                ...rowBorders,
                left: { style: BorderStyle.SINGLE, size: 6, color: '64748B' },
              },
              margins: { top: 40, bottom: 40, left: 20, right: 20 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: `Q.${longStartNum + idx}`,
                      bold: true,
                      size: qFontSize,
                      color: '0F172A',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              borders: rowBorders,
              margins: { top: 40, bottom: 40, left: 55, right: 55 },
              children: [
                new Paragraph({
                  bidirectional: leftRtl,
                  alignment: leftRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: lq.prompt,
                      size: qFontSize,
                      color: '0F172A',
                      font: leftRtl ? 'Tahoma' : 'Calibri',
                      rightToLeft: leftRtl,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 7, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F8FAFC' },
              verticalAlign: VerticalAlign.CENTER,
              borders: rowBorders,
              margins: { top: 40, bottom: 40, left: 15, right: 15 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: lq.orPrompt?.trim() ? 'OR' : '—',
                      bold: true,
                      size: 16,
                      color: '475569',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 38, type: WidthType.PERCENTAGE },
              borders: rowBorders,
              margins: { top: 40, bottom: 40, left: 55, right: 55 },
              children: [
                new Paragraph({
                  bidirectional: rightRtl,
                  alignment: rightRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: lq.orPrompt?.trim() || '',
                      size: qFontSize,
                      color: '0F172A',
                      font: rightRtl ? 'Tahoma' : 'Calibri',
                      rightToLeft: rightRtl,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 8, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F8FAFC' },
              verticalAlign: VerticalAlign.CENTER,
              borders: {
                ...rowBorders,
                right: { style: BorderStyle.SINGLE, size: 6, color: '64748B' },
              },
              margins: { top: 40, bottom: 40, left: 20, right: 20 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: `[${formatMarksBadge(lq.marks)}]`,
                      bold: true,
                      size: 17,
                      color: '334155',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      });

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [longHeaderRow, ...longTableRows],
        }),
      );
    } else {
      longQuestions.forEach((lq, idx) => {
        const rowRtl = isRtlSubject || hasRtlScript(lq.prompt) || hasRtlScript(lq.orPrompt);
        children.push(
          new Paragraph({
            bidirectional: rowRtl,
            alignment: rowRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            keepNext: Boolean(lq.orPrompt?.trim()),
            spacing: { before: compactLayout ? 40 : 90, after: lq.orPrompt?.trim() ? 15 : 65 },
            children: [
              new TextRun({
                text: `Q.${longStartNum + idx} `,
                bold: true,
                size: qFontSize,
                color: '0F172A',
                font: 'Calibri',
              }),
              new TextRun({
                text: lq.prompt,
                size: qFontSize,
                color: '0F172A',
                font: rowRtl ? 'Tahoma' : 'Calibri',
                rightToLeft: rowRtl,
              }),
              new TextRun({
                text: `\t[${formatMarksBadge(lq.marks)} Marks]`,
                bold: true,
                size: 17,
                color: '475569',
                font: 'Calibri',
              }),
            ],
          }),
        );

        if (lq.orPrompt?.trim()) {
          children.push(
            new Paragraph({
              indent: { left: convertInchesToTwip(0.3) },
              keepNext: true,
              spacing: { before: 8, after: 8 },
              children: [
                new TextRun({
                  text: '— OR —',
                  bold: true,
                  size: 16,
                  color: '475569',
                  font: 'Calibri',
                }),
              ],
            }),
          );
          children.push(
            new Paragraph({
              bidirectional: rowRtl,
              alignment: rowRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
              indent: { left: convertInchesToTwip(0.3) },
              spacing: { before: 0, after: 65 },
              children: [
                new TextRun({
                  text: lq.orPrompt.trim(),
                  size: qFontSize,
                  color: '0F172A',
                  font: rowRtl ? 'Tahoma' : 'Calibri',
                  rightToLeft: rowRtl,
                }),
              ],
            }),
          );
        }
      });
    }
  }

  // End of Paper Credit Row
  children.push(
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: '64748B' } },
      spacing: { before: 220, after: 40 },
      children: [
        new TextRun({
          text: '*** END OF QUESTION PAPER ***',
          bold: true,
          size: 18,
          color: '475569',
          font: 'Calibri',
        }),
        new TextRun({
          text: '\tDeveloped by Muhammad Asim Khan · 03165552001',
          bold: true,
          size: 18,
          color: '0F172A',
          font: 'Calibri',
        }),
      ],
    }),
  );

  // 5. Optional Answer Key & Marking Scheme
  if (includeAnswerKey) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '0F172A' } },
        spacing: { before: 0, after: 140 },
        children: [
          new TextRun({
            text: `Answer Key & Marking Scheme — ${title.trim() || 'Question Paper'}`,
            bold: true,
            size: 26,
            color: '0F172A',
            font: 'Calibri',
          }),
        ],
      }),
    );

    if (questions.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({
              text: `Question ${mcqQuestionNum} — MCQ Answer Key`,
              bold: true,
              size: 20,
              color: '334155',
              font: 'Calibri',
            }),
          ],
        }),
      );

      // 5-column answer key grid
      const keyRows: TableRow[] = [];
      for (let i = 0; i < questions.length; i += 5) {
        const rowCells: TableCell[] = [];
        for (let c = 0; c < 5; c += 1) {
          const idx = i + c;
          const q = questions[idx];
          rowCells.push(
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
              },
              margins: { top: 45, bottom: 45, left: 70, right: 70 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: q
                    ? [
                        new TextRun({
                          text: `${idx + 1}: `,
                          size: 19,
                          color: '334155',
                          font: 'Consolas',
                        }),
                        new TextRun({
                          text: String.fromCharCode(65 + q.correctIndex),
                          bold: true,
                          size: 19,
                          color: '0F172A',
                          font: 'Consolas',
                        }),
                      ]
                    : [],
                }),
              ],
            }),
          );
        }
        keyRows.push(new TableRow({ cantSplit: true, children: rowCells }));
      }

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: keyRows,
        }),
      );
    }

    if (shortQuestions.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 160, after: 60 },
          children: [
            new TextRun({
              text: `Q.${shortQuestionNum} — Short Questions Key Points (Section B)`,
              bold: true,
              size: 20,
              color: '334155',
              font: 'Calibri',
            }),
          ],
        }),
      );

      shortQuestions.forEach((sq, idx) => {
        children.push(
          new Paragraph({
            spacing: { before: 60, after: 20 },
            children: [
              new TextRun({
                text: `${formatRomanPart(idx)} (${sq.marks} Marks): ${sq.prompt}`,
                bold: true,
                size: 19,
                color: '0F172A',
                font: 'Calibri',
              }),
            ],
          }),
        );
        children.push(
          new Paragraph({
            indent: { left: convertInchesToTwip(0.25) },
            spacing: { before: 0, after: 40 },
            children: createMultilineTextRuns(sq.suggestedAnswer || '', 18, '334155'),
          }),
        );
        if (sq.orPrompt?.trim()) {
          children.push(
            new Paragraph({
              indent: { left: convertInchesToTwip(0.25) },
              spacing: { before: 20, after: 10 },
              children: [
                new TextRun({
                  text: `OR: ${sq.orPrompt.trim()}`,
                  bold: true,
                  size: 18,
                  color: '0F172A',
                  font: 'Calibri',
                }),
              ],
            }),
          );
          if (sq.orSuggestedAnswer?.trim()) {
            children.push(
              new Paragraph({
                indent: { left: convertInchesToTwip(0.25) },
                spacing: { before: 0, after: 40 },
                children: createMultilineTextRuns(sq.orSuggestedAnswer.trim(), 18, '334155'),
              }),
            );
          }
        }
      });
    }

    if (longQuestions.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 160, after: 60 },
          children: [
            new TextRun({
              text: `Q.${longStartNum}${longQuestions.length > 1 ? `–Q.${longStartNum + longQuestions.length - 1}` : ''} — Long Questions Solution Outline (Section C)`,
              bold: true,
              size: 20,
              color: '334155',
              font: 'Calibri',
            }),
          ],
        }),
      );

      longQuestions.forEach((lq, idx) => {
        children.push(
          new Paragraph({
            spacing: { before: 60, after: 20 },
            children: [
              new TextRun({
                text: `Q.${longStartNum + idx} (${lq.marks} Marks): ${lq.prompt}`,
                bold: true,
                size: 19,
                color: '0F172A',
                font: 'Calibri',
              }),
            ],
          }),
        );
        children.push(
          new Paragraph({
            indent: { left: convertInchesToTwip(0.25) },
            spacing: { before: 0, after: 40 },
            children: createMultilineTextRuns(lq.suggestedAnswer || '', 18, '334155'),
          }),
        );
        if (lq.orPrompt?.trim()) {
          children.push(
            new Paragraph({
              indent: { left: convertInchesToTwip(0.25) },
              spacing: { before: 20, after: 10 },
              children: [
                new TextRun({
                  text: `OR: ${lq.orPrompt.trim()}`,
                  bold: true,
                  size: 18,
                  color: '0F172A',
                  font: 'Calibri',
                }),
              ],
            }),
          );
          if (lq.orSuggestedAnswer?.trim()) {
            children.push(
              new Paragraph({
                indent: { left: convertInchesToTwip(0.25) },
                spacing: { before: 0, after: 40 },
                children: createMultilineTextRuns(lq.orSuggestedAnswer.trim(), 18, '334155'),
              }),
            );
          }
        }
      });
    }
  }

  const pageMargin = convertInchesToTwip(compactLayout ? 0.36 : 0.62);
  const isLegalDoc = paperSize === 'legal';
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertInchesToTwip(isLegalDoc ? 8.5 : 8.27),
              height: convertInchesToTwip(isLegalDoc ? 14.0 : 11.69),
            },
            margin: {
              top: pageMargin,
              bottom: pageMargin,
              left: pageMargin,
              right: pageMargin,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
                children: [
                  new TextRun({
                    text: 'MeritExam · Board Assessment Paper',
                    size: 16,
                    color: '64748B',
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: '\tDeveloped by Muhammad Asim Khan · 03165552001',
                    size: 16,
                    bold: true,
                    color: '334155',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerBlobDownload(blob, `${sanitizeFileName(title)}.docx`);
}
