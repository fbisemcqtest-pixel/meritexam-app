import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
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
  WidthType,
  convertInchesToTwip,
} from 'docx';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import {
  BOARD_PRINT_LABELS,
  ExamBoard,
  GRADE_LABELS,
  GradeLevel,
  MCQQuestion,
  SubjectName,
  SubjectiveQuestion,
} from '../types';

export interface WordPaperExportInput {
  title: string;
  board: ExamBoard;
  schoolName: string;
  examLabel: string;
  formattedDate: string;
  grade: GradeLevel;
  subject: SubjectName;
  topic?: string;
  durationMinutes: number;
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
  paperStyle: 'fbise_official' | 'standard';
  paperSize: 'a4' | 'legal';
  compactLayout: boolean;
  sideBySideOr: boolean;
  twoColumnMcqs: boolean;
  separateSectionA: boolean;
  includeAnswerKey: boolean;
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

/**
 * Renders the printable paper DOM into a crisp, multi-page A4 PDF
 * without slicing questions across page boundaries.
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
  clonedSheet.style.width = `${targetWidthPx}px`;
  clonedSheet.style.maxWidth = `${targetWidthPx}px`;
  clonedSheet.style.margin = '0';
  clonedSheet.style.border = 'none';
  clonedSheet.style.boxShadow = 'none';
  clonedSheet.style.padding = compactLayout ? '10px 16px' : '20px 26px';
  clonedSheet.style.backgroundColor = '#ffffff';

  cloneHost.appendChild(clonedSheet);
  document.body.appendChild(cloneHost);

  try {
    // Allow browser layout/fonts to settle on clone
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const sheetRect = clonedSheet.getBoundingClientRect();
    const blockNodes = Array.from(
      clonedSheet.querySelectorAll<HTMLElement>('[data-pdf-block], [data-pdf-page-break]'),
    );

    const blocks: PdfBlockMetric[] = blockNodes
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

    const canvas = await html2canvas(clonedSheet, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: targetWidthPx + 24,
    });

    const pageWidthMm = isLegal ? 215.9 : 210;
    const pageHeightMm = isLegal ? 355.6 : 297;
    const marginMm = compactLayout ? 7 : 10;
    const contentWidthMm = pageWidthMm - marginMm * 2;
    const contentHeightMm = pageHeightMm - marginMm * 2;

    const totalCssWidth = clonedSheet.offsetWidth || targetWidthPx;
    const totalCssHeight = clonedSheet.offsetHeight || canvas.height / 2;
    const scaleX = canvas.width / totalCssWidth;
    const scaleY = canvas.height / totalCssHeight;

    // Max CSS px that fit inside one A4 / Legal printable height
    const maxPageHeightCss = totalCssWidth * (contentHeightMm / contentWidthMm);

    const pageRanges: Array<{ start: number; end: number }> = [];
    let pageStart = 0;

    for (let i = 0; i < blocks.length; i += 1) {
      const blk = blocks[i];

      if (blk.forceBreakBefore && blk.top > pageStart + 12) {
        pageRanges.push({ start: pageStart, end: blk.top });
        pageStart = blk.top;
        continue;
      }

      if (blk.keepWithNext && i + 1 < blocks.length) {
        const nextBlk = blocks[i + 1];
        if (nextBlk.bottom - pageStart > maxPageHeightCss && blk.top > pageStart + 12) {
          pageRanges.push({ start: pageStart, end: blk.top });
          pageStart = blk.top;
          continue;
        }
      }

      if (blk.bottom - pageStart > maxPageHeightCss) {
        if (blk.top > pageStart + 12 && blk.bottom - blk.top <= maxPageHeightCss) {
          pageRanges.push({ start: pageStart, end: blk.top });
          pageStart = blk.top;
        } else {
          // Single block exceeds page height; advance by page slices
          while (blk.bottom - pageStart > maxPageHeightCss) {
            const sliceEnd = pageStart + maxPageHeightCss;
            pageRanges.push({ start: pageStart, end: sliceEnd });
            pageStart = sliceEnd;
          }
        }
      }
    }

    while (totalCssHeight - pageStart > maxPageHeightCss + 4) {
      const sliceEnd = pageStart + maxPageHeightCss;
      pageRanges.push({ start: pageStart, end: sliceEnd });
      pageStart = sliceEnd;
    }

    if (totalCssHeight > pageStart + 2) {
      pageRanges.push({ start: pageStart, end: totalCssHeight });
    }

    if (pageRanges.length === 0) {
      pageRanges.push({ start: 0, end: totalCssHeight });
    }

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
    formattedDate,
    grade,
    subject,
    topic,
    durationMinutes,
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
    separateSectionA,
    includeAnswerKey,
  } = input;

  const qFontSize = compactLayout ? 18 : 20;
  const optFontSize = compactLayout ? 17 : 19;

  const isOfficial = paperStyle === 'fbise_official';
  const mcqQuestionNum = questions.length > 0 ? 1 : 0;
  const shortQuestionNum = shortQuestions.length > 0 ? mcqQuestionNum + 1 : 0;
  const longQuestionNum = longQuestions.length > 0 ? (shortQuestionNum || mcqQuestionNum) + 1 : 0;
  const hasShortOr = shortQuestions.some((q) => Boolean(q.orPrompt?.trim()));
  const hasLongOr = longQuestions.some((q) => Boolean(q.orPrompt?.trim()));

  const children: Array<Paragraph | Table> = [];

  // 1. Header Block
  if (isOfficial) {
    const headerRows: TableRow[] = [];

    // Title Row
    const headerParagraphs: Paragraph[] = [];
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
        spacing: { before: 0, after: 30 },
        children: [
          new TextRun({
            text:
              board === 'punjab_ptb'
                ? 'PUNJAB BOARD (BISE · PTB / PCTB) — EXAMINATION PAPER'
                : 'FEDERAL BOARD OF INTERMEDIATE & SECONDARY EDUCATION (FBISE), ISLAMABAD',
            bold: true,
            size: 21,
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
            text: `${(examLabel.trim() || 'Model Question Paper').toUpperCase()} · ${(title.trim() || 'Assessment Paper').toUpperCase()}`,
            bold: true,
            size: 19,
            color: '334155',
            font: 'Calibri',
          }),
        ],
      }),
    );

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

    // Roll No. + Invigilator Bar
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
            margins: { top: 70, bottom: 70, left: 120, right: 80 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({ text: 'ROLL NO:  ', bold: true, size: 19, font: 'Calibri' }),
                  new TextRun({
                    text: '[   ] [   ] [   ] [   ] [   ] [   ]',
                    bold: true,
                    size: 19,
                    font: 'Consolas',
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
            margins: { top: 70, bottom: 70, left: 80, right: 120 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: 'Name: ___________________   Sign. Dy. Supdt.: ____________',
                    size: 18,
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

    // Metadata Row
    const metaValues = [
      `Class: ${GRADE_LABELS[grade]}`,
      `Subject: ${subject}`,
      `Total Marks: ${totalMarks}`,
      `Time: ${durationMinutes} Min${formattedDate ? ` · ${formattedDate}` : ''}`,
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
                      size: 19,
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

    if (topic?.trim()) {
      headerRows.push(
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              columnSpan: 4,
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
                left: NO_CELL_BORDERS.left,
                right: NO_CELL_BORDERS.right,
                bottom: NO_CELL_BORDERS.bottom,
              },
              margins: { top: 55, bottom: 65, left: 100, right: 100 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: 'Syllabus / Chapters: ',
                      size: 18,
                      color: '475569',
                      font: 'Calibri',
                    }),
                    new TextRun({
                      text: topic.trim(),
                      bold: true,
                      size: 18,
                      color: '0F172A',
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
            text: `Class: ${GRADE_LABELS[grade]}   ·   Subject: ${subject}${topic?.trim() ? `   ·   Syllabus: ${topic.trim()}` : ''}`,
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
    children.push(
      createSectionBanner(
        isOfficial
          ? `SECTION — A · Question ${mcqQuestionNum} (Objective / MCQs)`
          : `Question ${mcqQuestionNum}: Multiple Choice Questions (Objective)`,
        `Marks: ${mcqTotalMarks} (${questions.length} × ${marksPerQuestion})`,
        isOfficial,
      ),
    );

    children.push(
      new Paragraph({
        spacing: { before: 70, after: compactLayout ? 80 : 120 },
        children: [
          new TextRun({
            text: isOfficial
              ? 'Note: Section-A is compulsory. Answer all parts by selecting the correct option (A, B, C, or D). Deleting or overwriting is not allowed.'
              : 'Note: Choose the correct option (A, B, C, or D) for each statement below.',
            bold: true,
            size: 18,
            color: '334155',
            font: 'Calibri',
          }),
        ],
      }),
    );

    if (twoColumnMcqs) {
      const mcqPairRows: TableRow[] = [];
      for (let i = 0; i < questions.length; i += 2) {
        const leftQ = questions[i];
        const rightQ = questions[i + 1];

        const buildMcqCellParagraphs = (qItem: MCQQuestion | undefined, num: number): Paragraph[] => {
          if (!qItem) return [new Paragraph({ children: [] })];
          const optLine1 = [0, 1]
            .filter((idx) => qItem.options[idx] !== undefined)
            .map((idx) => `(${String.fromCharCode(65 + idx)}) ${qItem.options[idx]}`)
            .join('    ');
          const optLine2 = [2, 3]
            .filter((idx) => qItem.options[idx] !== undefined)
            .map((idx) => `(${String.fromCharCode(65 + idx)}) ${qItem.options[idx]}`)
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
          const leftLetter = String.fromCharCode(65 + r);
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
                          text: `(${leftLetter}) `,
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
                              text: `(${rightLetter}) `,
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
  }

  // Optional Separate Page for Subjective Part
  if (
    isOfficial &&
    separateSectionA &&
    questions.length > 0 &&
    (shortQuestions.length > 0 || longQuestions.length > 0)
  ) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      createSectionBanner(
        `${title.trim() || 'Question Paper'} — Subjective Part (Sections B & C)`,
        `Subjective Marks: ${Math.round((shortTotalMarks + longTotalMarks) * 100) / 100}`,
        true,
      ),
    );
    children.push(new Paragraph({ spacing: { before: 60, after: 60 }, children: [] }));
  } else if (questions.length > 0 && (shortQuestions.length > 0 || longQuestions.length > 0)) {
    children.push(new Paragraph({ spacing: { before: 80, after: 80 }, children: [] }));
  }

  // 3. Section B: Short Questions
  if (shortQuestions.length > 0) {
    children.push(
      createSectionBanner(
        isOfficial
          ? `SECTION — B · Question ${shortQuestionNum} (Short Response Questions)`
          : `Question ${shortQuestionNum}: Short Answer Questions`,
        `Marks: ${shortTotalMarks} (${shortQuestions.length} Parts)`,
        isOfficial,
      ),
    );

    const shortNote = shortChoiceNote.trim()
      ? `Note: ${shortChoiceNote.trim()}`
      : hasShortOr
        ? 'Note: Write concise answers. Where "OR" is given, attempt either the first question or the alternative question.'
        : 'Note: Write concise, to-the-point answers for the short questions below.';

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

    if (sideBySideOr && hasShortOr) {
      const shortTableRows = shortQuestions.map(
        (sq, idx) =>
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: 46, type: WidthType.PERCENTAGE },
                borders: {
                  top: NO_CELL_BORDERS.top,
                  left: NO_CELL_BORDERS.left,
                  right: NO_CELL_BORDERS.right,
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                },
                margins: { top: 35, bottom: 35, left: 40, right: 60 },
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 0 },
                    children: [
                      new TextRun({
                        text: `${idx + 1}. `,
                        bold: true,
                        size: qFontSize,
                        color: '0F172A',
                        font: 'Calibri',
                      }),
                      new TextRun({
                        text: sq.prompt,
                        size: qFontSize,
                        color: '0F172A',
                        font: 'Calibri',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 8, type: WidthType.PERCENTAGE },
                borders: {
                  top: NO_CELL_BORDERS.top,
                  left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                  right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                },
                margins: { top: 35, bottom: 35, left: 20, right: 20 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 0 },
                    children: [
                      new TextRun({
                        text: sq.orPrompt?.trim() ? 'OR' : '—',
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
                width: { size: 46, type: WidthType.PERCENTAGE },
                borders: {
                  top: NO_CELL_BORDERS.top,
                  left: NO_CELL_BORDERS.left,
                  right: NO_CELL_BORDERS.right,
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                },
                margins: { top: 35, bottom: 35, left: 60, right: 40 },
                children: [
                  new Paragraph({
                    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
                    spacing: { before: 0, after: 0 },
                    children: [
                      new TextRun({
                        text: sq.orPrompt?.trim() || '',
                        size: qFontSize,
                        color: '0F172A',
                        font: 'Calibri',
                      }),
                      new TextRun({
                        text: `\t[${sq.marks}]`,
                        bold: true,
                        size: 17,
                        color: '475569',
                        font: 'Calibri',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
      );

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: shortTableRows,
        }),
      );
    } else {
      shortQuestions.forEach((sq, idx) => {
        children.push(
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            keepNext: Boolean(sq.orPrompt?.trim()),
            spacing: { before: compactLayout ? 35 : 80, after: sq.orPrompt?.trim() ? 15 : 50 },
            children: [
              new TextRun({
                text: `${idx + 1}. `,
                bold: true,
                size: qFontSize,
                color: '0F172A',
                font: 'Calibri',
              }),
              new TextRun({
                text: sq.prompt,
                size: qFontSize,
                color: '0F172A',
                font: 'Calibri',
              }),
              new TextRun({
                text: `\t[${sq.marks} Marks]`,
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
              indent: { left: convertInchesToTwip(0.3) },
              spacing: { before: 0, after: 45 },
              children: [
                new TextRun({
                  text: sq.orPrompt.trim(),
                  size: qFontSize,
                  color: '0F172A',
                  font: 'Calibri',
                }),
              ],
            }),
          );
        }
      });
    }
  }

  // 4. Section C: Long Questions
  if (longQuestions.length > 0) {
    if (shortQuestions.length > 0) {
      children.push(new Paragraph({ spacing: { before: compactLayout ? 40 : 80, after: compactLayout ? 40 : 80 }, children: [] }));
    }

    children.push(
      createSectionBanner(
        isOfficial
          ? `SECTION — C · Question ${longQuestionNum} (Extended / Long Questions)`
          : `Question ${longQuestionNum}: Long / Descriptive Questions`,
        `Marks: ${longTotalMarks} (${longQuestions.length} ${longQuestions.length === 1 ? 'Question' : 'Questions'})`,
        isOfficial,
      ),
    );

    const longNote = longChoiceNote.trim()
      ? `Note: ${longChoiceNote.trim()}`
      : hasLongOr
        ? 'Note: Write detailed answers. Where "OR" is given, attempt either the first question or the alternative question.'
        : 'Note: Attempt detailed answers with diagrams, equations, or headings where applicable.';

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
      const longTableRows = longQuestions.map(
        (lq, idx) =>
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: 46, type: WidthType.PERCENTAGE },
                borders: {
                  top: NO_CELL_BORDERS.top,
                  left: NO_CELL_BORDERS.left,
                  right: NO_CELL_BORDERS.right,
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                },
                margins: { top: 40, bottom: 40, left: 40, right: 60 },
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 0 },
                    children: [
                      new TextRun({
                        text: `${idx + 1}. `,
                        bold: true,
                        size: qFontSize,
                        color: '0F172A',
                        font: 'Calibri',
                      }),
                      new TextRun({
                        text: lq.prompt,
                        size: qFontSize,
                        color: '0F172A',
                        font: 'Calibri',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 8, type: WidthType.PERCENTAGE },
                borders: {
                  top: NO_CELL_BORDERS.top,
                  left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                  right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                },
                margins: { top: 40, bottom: 40, left: 20, right: 20 },
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
                width: { size: 46, type: WidthType.PERCENTAGE },
                borders: {
                  top: NO_CELL_BORDERS.top,
                  left: NO_CELL_BORDERS.left,
                  right: NO_CELL_BORDERS.right,
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                },
                margins: { top: 40, bottom: 40, left: 60, right: 40 },
                children: [
                  new Paragraph({
                    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
                    spacing: { before: 0, after: 0 },
                    children: [
                      new TextRun({
                        text: lq.orPrompt?.trim() || '',
                        size: qFontSize,
                        color: '0F172A',
                        font: 'Calibri',
                      }),
                      new TextRun({
                        text: `\t[${lq.marks}]`,
                        bold: true,
                        size: 17,
                        color: '475569',
                        font: 'Calibri',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
      );

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: longTableRows,
        }),
      );
    } else {
      longQuestions.forEach((lq, idx) => {
        children.push(
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            keepNext: Boolean(lq.orPrompt?.trim()),
            spacing: { before: compactLayout ? 40 : 90, after: lq.orPrompt?.trim() ? 15 : 65 },
            children: [
              new TextRun({
                text: `${idx + 1}. `,
                bold: true,
                size: qFontSize,
                color: '0F172A',
                font: 'Calibri',
              }),
              new TextRun({
                text: lq.prompt,
                size: qFontSize,
                color: '0F172A',
                font: 'Calibri',
              }),
              new TextRun({
                text: `\t[${lq.marks} Marks]`,
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
              indent: { left: convertInchesToTwip(0.3) },
              spacing: { before: 0, after: 65 },
              children: [
                new TextRun({
                  text: lq.orPrompt.trim(),
                  size: qFontSize,
                  color: '0F172A',
                  font: 'Calibri',
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
              text: `Question ${shortQuestionNum} — Short Questions Key Points`,
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
                text: `${idx + 1} (${sq.marks} Marks): ${sq.prompt}`,
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
              text: `Question ${longQuestionNum} — Long Questions Solution Outline`,
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
                text: `${idx + 1} (${lq.marks} Marks): ${lq.prompt}`,
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

  const pageMargin = convertInchesToTwip(compactLayout ? 0.42 : 0.65);
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
