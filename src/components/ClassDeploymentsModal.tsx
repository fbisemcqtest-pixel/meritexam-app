import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Layers,
  X,
} from 'lucide-react';
import { CLASS_EDITIONS, ClassEditionMeta } from '../config/appEdition';

interface ClassDeploymentsModalProps {
  getIdToken: () => Promise<string>;
  onClose: () => void;
}

async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // fallback below
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export function ClassDeploymentsModal({ getIdToken, onClose }: ClassDeploymentsModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const linksSummaryText = useMemo(() => {
    const lines = [
      'MeritExam — 5 Portal Links (4 Class-Wise + 1 Complete All-Classes)',
      '====================================================================',
      ...CLASS_EDITIONS.map(
        (ed, idx) =>
          `${idx + 1}. ${ed.title} / ${ed.urduTitle}\n   ${origin}${ed.slug}`,
      ),
      '',
      'نوٹ: چاروں کلاسز کے علیحدہ لنکس اور پانچواں مکمل لنک (چاروں کلاسز اکٹھی) یہاں موجود ہیں۔',
    ];
    return lines.join('\n');
  }, [origin]);

  async function handleCopyLink(key: string, text: string) {
    await copyToClipboard(text);
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2200);
  }

  async function handleDownloadEditionZip(ed: ClassEditionMeta) {
    setDownloadError(null);
    setDownloadingKey(ed.queryKey);
    try {
      const idToken = await getIdToken();
      const response = await fetch(
        `/api/admin/export-zip?class=${encodeURIComponent(ed.queryKey)}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Failed to download ${ed.zipFilename}.`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = ed.zipFilename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : 'Unable to export class ZIP package.',
      );
    } finally {
      setDownloadingKey(null);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="5 Class Links & Deployment Packages"
        className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-teal-500 to-amber-500 shrink-0" />

        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/70 shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center shrink-0 mt-0.5">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                5 Portal Links &amp; Separate GitHub Deployment ZIPs
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                4 dedicated single-class editions (9th, 10th, 1st Year, 2nd Year) + 1 Complete All-Classes edition.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
            aria-label="Close 5 Links & ZIPs modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Copy All 5 Links Strip */}
        <div className="px-5 sm:px-6 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-slate-600">
            Share direct links right away, or download pre-locked ZIPs to deploy each class on its own GitHub + Domain + Free Firebase.
          </p>
          <button
            type="button"
            onClick={() => void handleCopyLink('all_5_links', linksSummaryText)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              copiedKey === 'all_5_links'
                ? 'bg-emerald-700 text-white'
                : 'bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white'
            }`}
          >
            {copiedKey === 'all_5_links' ? (
              <>
                <Check className="w-3.5 h-3.5" />
                All 5 Links Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy All 5 Links
              </>
            )}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50 space-y-4">
          {downloadError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-800">
              {downloadError}
            </div>
          )}

          <div className="space-y-3">
            {CLASS_EDITIONS.map((ed, idx) => {
              const fullUrl = `${origin}${ed.slug}`;
              const isCopied = copiedKey === ed.queryKey;
              const isDownloading = downloadingKey === ed.queryKey;
              return (
                <div
                  key={ed.queryKey}
                  className={`bg-white border ${ed.borderClass} rounded-xl overflow-hidden shadow-xs`}
                >
                  <div className={`h-1 w-full bg-gradient-to-r ${ed.accentGradient}`} />
                  <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 tabular-nums">
                          #{idx + 1}
                        </span>
                        <h3 className="font-display text-sm sm:text-base font-bold text-slate-900">
                          {ed.title}
                        </h3>
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 rounded">
                          {ed.badge}
                        </span>
                      </div>
                      <p dir="rtl" className="text-xs font-semibold text-blue-800 text-right sm:text-left">
                        {ed.urduTitle} — {ed.urduDescription}
                      </p>
                      <p className="text-xs text-slate-500">{ed.description}</p>
                      <div className="pt-1 flex items-center gap-2 text-xs font-mono text-slate-700 truncate">
                        <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded truncate">
                          {fullUrl}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleCopyLink(ed.queryKey, fullUrl)}
                        className={`px-3 py-2 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                          isCopied
                            ? 'bg-emerald-700 border-emerald-700 text-white'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Link
                          </>
                        )}
                      </button>

                      <a
                        href={ed.slug}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open
                      </a>

                      <button
                        type="button"
                        disabled={Boolean(downloadingKey)}
                        onClick={() => void handleDownloadEditionZip(ed)}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {isDownloading ? 'Preparing...' : `Download ${ed.badge} ZIP`}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bilingual Free Scaling Instructions */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 sm:p-5 space-y-2.5 text-xs text-slate-800">
            <h3 className="font-display text-sm font-bold text-amber-950">
              How 5 Separate Deployments Multiply Your Free Quota (فری چلانے کا آسان طریقہ)
            </h3>
            <p dir="rtl" className="text-right leading-loose text-slate-800">
              <strong>طریقہ نمبر 1 (فوری استعمال):</strong> اوپر دیے گئے 4 کلاسز کے لنکس (/9th، /10th، /1st-year، /2nd-year) اور 5واں مکمل لنک فوراً شیئر کریں—ہر لنک پر صرف اس کلاس کے طلبہ اور پیپرز کھلیں گے۔<br />
              <strong>طریقہ نمبر 2 (4 الگ GitHub اکاؤنٹس اور 4 فری ڈومینز پر لگانا):</strong> ہر کلاس کی الگ <strong>ZIP</strong> ڈاؤن لوڈ کریں۔ ہر ZIP پہلے ہی اس ایک کلاس کے لیے لاک ہے۔ جب آپ ہر کلاس کو الگ GitHub + Vercel/Netlify ڈومین + الگ فری Firebase Spark پروجیکٹ اور الگ فری GEMINI_API_KEY پر لگائیں گے تو آپ کو <strong>4 سے 5 گنا زیادہ فری یومیہ گنجائش</strong> ملے گی اور ایک کلاس کے رش سے باقی کلاسز متاثر نہیں ہوں گی۔ ہر ZIP کے اندر مکمل رہنمائی فائل (DEPLOYMENT_GUIDE_URDU_ENGLISH.txt) بھی شامل ہے۔
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
