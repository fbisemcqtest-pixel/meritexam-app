import React from 'react';
import { Phone, Sparkles } from 'lucide-react';
import { CURRICULUM_BOARD_LABEL } from '../types';

export function DeveloperFooter() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto no-print">
      <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-teal-500 to-amber-500" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1">
          <span className="font-display font-bold text-slate-900">MeritExam</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>{CURRICULUM_BOARD_LABEL}</span>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <Sparkles className="w-3.5 h-3.5 text-blue-700 shrink-0" />
            <span>
              Developed by{' '}
              <strong className="font-semibold text-slate-900">Muhammad Asim Khan</strong>
            </span>
          </span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <a
            href="tel:03165552001"
            className="inline-flex items-center gap-1.5 font-semibold text-blue-700 hover:text-blue-800 transition-colors tabular-nums"
          >
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <span>03165552001</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
