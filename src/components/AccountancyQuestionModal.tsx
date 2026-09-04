/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { InquiryQuestionObj, AccountancyTabConfig, AccountancyTableType, AccountancyColumn } from '../types';
import { 
  X, Plus, Trash2, Edit3, Check, AlertCircle, RotateCw,
  HelpCircle, Eye, EyeOff, Calculator, Layers, FileText, ChevronRight, Sparkles
} from 'lucide-react';
import { renderMathInRawHtml } from '../lib/mathPreprocessor';
import { extractSolutionChips } from '../lib/solutionChipExtractor';

interface AccountancyQuestionModalProps {
  question: string | InquiryQuestionObj;
  questionNumber?: number;
  totalQuestions?: number;
  isOpen: boolean;
  onClose: () => void;
}

class ModalErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Accountancy Modal Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-slate-900/90 text-rose-300 rounded-2xl border border-rose-500/40 text-center my-4 shadow-xl">
          <p className="font-bold text-base">An unexpected error occurred in the table workspace.</p>
          <p className="text-xs font-mono text-rose-400 mt-2 bg-rose-950/60 p-2 rounded border border-rose-800/50 max-w-xl mx-auto overflow-x-auto">
            {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
          </p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 px-4 py-1.5 bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/50 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer"
          >
            Reset Workspace View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function formatIndianNumber(val: string | number | undefined): string {
  if (val === undefined || val === null) return '';
  const strVal = String(val);
  if (!strVal) return '';
  let cleaned = strVal.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';

  const parts = cleaned.split('.');
  let integerPart = parts[0];
  const decimalPart = parts.length > 1 ? '.' + parts.slice(1).join('') : '';

  if (integerPart) {
    if (integerPart.length > 3) {
      const lastThree = integerPart.substring(integerPart.length - 3);
      const otherDigits = integerPart.substring(0, integerPart.length - 3);
      const formattedOther = otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
      integerPart = formattedOther + ',' + lastThree;
    }
  }
  return integerPart + decimalPart;
}

function parseNumericValue(val: string | number | undefined): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function isCellDisabledInRow(rRow: string[], cIdx: number, columns: AccountancyColumn[], tableType: AccountancyTableType): boolean {
  if (!Array.isArray(columns) || !columns[cIdx]) return false;

  const colLabel = (columns[cIdx].label || '').toLowerCase().trim();

  // In T-Shape Account (No Date), the unnamed J.F. columns (index 1 and 4) are ALWAYS ACTIVE
  // Other L.F./J.F. columns with explicit label are still disabled
  if (tableType === 't_shape_ledger_no_date') {
    // Cols 1 and 4 are the unnamed active columns — never disabled
    if (cIdx === 1 || cIdx === 4) return false;
    // Named L.F. or J.F. columns are disabled
    const isLf = colLabel === 'l.f.' || colLabel === 'l.f' || colLabel === 'lf' || colLabel === 'j.f.' || colLabel === 'j.f' || colLabel === 'jf';
    return isLf;
  }

  if (tableType === 'notes_to_accounts') {
    // Col 1 is the unnamed 10% active column — never disabled
    if (cIdx === 1) return false;
    const isLf = colLabel === 'l.f.' || colLabel === 'l.f' || colLabel === 'lf' || colLabel === 'j.f.' || colLabel === 'j.f' || colLabel === 'jf';
    return isLf;
  }


  const isLf = colLabel === 'l.f.' || colLabel === 'l.f' || colLabel === 'lf' || colLabel === 'j.f.' || colLabel === 'j.f' || colLabel === 'jf';
  if (isLf) return true;

  if (tableType === 'journal') {
    let particularsVal = '';
    const pIdx = columns.findIndex(c => (c?.label || '').toLowerCase().includes('particular'));
    if (pIdx >= 0 && Array.isArray(rRow)) {
      const rawP = rRow[pIdx];
      particularsVal = typeof rawP === 'string' ? rawP : (rawP !== undefined && rawP !== null ? String(rawP) : '');
    }

    const hasDr = /(?:\bdr\.?\s*$)/i.test(particularsVal.trim());
    const hasTo = /^to\b/i.test(particularsVal.trim());

    const isDebitCol = colLabel.includes('debit');
    const isCreditCol = colLabel.includes('credit');

    if (isDebitCol && hasTo && !hasDr) {
      return true;
    }
    if (isCreditCol && hasDr && !hasTo) {
      return true;
    }
  }

  return false;
}

function isTextColumnEligibleForChips(columnLabel: string): boolean {
  const l = columnLabel.toLowerCase().trim();
  if (
    l.includes('amount') ||
    l.includes('debit') ||
    l.includes('credit') ||
    l.includes('date') ||
    l === 'j.f.' ||
    l === 'l.f.' ||
    l.includes('s.no') ||
    l.includes('s.n') ||
    l === 'dr' ||
    l === 'cr' ||
    l.includes('amt') ||
    l.includes('note') ||
    l.includes('year') ||
    l.includes('figure')
  ) {
    return false;
  }
  return true;
}

function JournalCell({
  value,
  isJournal,
  isNumeric,
  isEligibleForChips,
  isDisabled,
  isLastDataRow,
  isTotalRow,
  isTotalMismatch,
  tableType,
  colIdx,
  totalCols,
  solutionChips,
  presetTerms,
  onFocus,
  onChange,
  onSelectTotalChip,
  onRefreshTotal,
  onClearTotalRow,
  hasRowText,
  onClearRow,
}: {
  value: string;
  isJournal: boolean;
  isNumeric: boolean;
  isEligibleForChips?: boolean;
  isDisabled?: boolean;
  isLastDataRow?: boolean;
  isTotalRow?: boolean;
  isTotalMismatch?: boolean;
  tableType?: AccountancyTableType;
  colIdx?: number;
  totalCols?: number;
  solutionChips?: string[];
  presetTerms?: string[];
  hasRowText?: boolean;
  onFocus: () => void;
  onChange: (val: string) => void;
  onSelectTotalChip?: () => void;
  onRefreshTotal?: () => void;
  onClearTotalRow?: () => void;
  onClearRow?: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  const hasSolutionChips = Boolean(solutionChips && solutionChips.length > 0);

  const displayedChips = useMemo(() => {
    try {
      const rawChips = hasSolutionChips ? (solutionChips || []) : (presetTerms || []);
      const cleanRaw = rawChips.filter((c) => {
        if (!c || typeof c !== 'string') return false;
        const lower = c.trim().toLowerCase();
        return lower !== 'to' && lower !== 'by' && lower !== 'total';
      });
      
      const result: string[] = [];
      if (isJournal) {
        result.push('To');
      } else if (tableType === 't_shape_ledger_no_date') {
        result.push('To', 'By');
      }
      result.push(...cleanRaw);
      if (isLastDataRow) {
        result.push('Total');
      }
      return Array.from(new Set(result.filter(Boolean)));
    } catch (e) {
      return ['To', 'By', 'Total'];
    }
  }, [hasSolutionChips, solutionChips, presetTerms, isJournal, tableType, isLastDataRow]);

  const safeVal = typeof value === 'string' ? value : (value !== undefined && value !== null ? String(value) : '');
  const trimmedStart = safeVal.trimStart();
  const hasTo = isJournal && !isNumeric && (trimmedStart.toLowerCase().startsWith('to ') || trimmedStart.toLowerCase() === 'to');

  // Match "dr." or "dr" at the end of the text (case-insensitive)
  const drMatch = (isJournal && !isNumeric) ? safeVal.match(/^(.*?)(?:\s+)?(\bdr\.?)\s*$/i) : null;
  const hasDr = Boolean(drMatch);
  const mainPart = drMatch ? drMatch[1] : safeVal;
  const drPart = drMatch ? 'Dr.' : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawVal = e.target.value;
    if (isNumeric) {
      let cleaned = rawVal.replace(/[^0-9.]/g, '');
      const parts = cleaned.split('.');
      if (parts.length > 2) {
        cleaned = parts[0] + '.' + parts.slice(1).join('');
      }
      const formatted = formatIndianNumber(cleaned);
      onChange(formatted);
    } else {
      if (isJournal && hasTo && rawVal.trim() && !rawVal.toLowerCase().startsWith('to ')) {
        onChange(`To ${rawVal}`);
      } else {
        onChange(rawVal);
      }
    }
  };

  let displayVal = isNumeric ? formatIndianNumber(safeVal) : safeVal;
  if (isJournal && !isNumeric && hasTo) {
    displayVal = safeVal.replace(/^to\s*/i, '');
  }

  if (isDisabled) {
    return (
      <div className="w-full min-h-[32px] md:min-h-[40px] flex items-center justify-center bg-slate-950/40 rounded opacity-25 cursor-not-allowed select-none pointer-events-none p-1.5 md:p-2.5">
        <span className="text-slate-600 text-xs md:text-sm font-mono font-bold">—</span>
      </div>
    );
  }

  const handleChipClick = (chipText: string) => {
    const textToInsertRaw = (chipText || '').trim();
    if (!textToInsertRaw) return;
    let textToInsert = textToInsertRaw;

    if (textToInsert.toLowerCase() === 'total') {
      if (onSelectTotalChip) {
        onSelectTotalChip();
      } else {
        onChange('Total');
      }
      return;
    }

    const currentCellVal = safeVal;

    if (textToInsert.toLowerCase() === 'to') {
      textToInsert = 'To';
    } else if (textToInsert.toLowerCase() === 'by') {
      textToInsert = 'By';
    } else if (isJournal) {
      // In Journal tab: if cell or chip starts with "To", don't append Dr., otherwise append Dr.
      const cellAlreadyHasTo = /^to\b/i.test(currentCellVal.trim());
      const chipStartsWithTo = /^to\b/i.test(textToInsert);
      const endsWithDr = /\bdr\.?$/i.test(textToInsert);

      if (!cellAlreadyHasTo && !chipStartsWithTo && !endsWithDr) {
        textToInsert = `${textToInsert} Dr.`;
      }
    } else if (tableType === 't_shape_ledger') {
      // In standard T-Shape Ledger tab (with date): add 'To ' for Debit side (left half), add 'By ' for Credit side (right half)
      const numCols = totalCols ?? 8;
      const isDebitSide = (colIdx ?? 0) < numCols / 2;

      if (isDebitSide) {
        const startsWithTo = /^to\b/i.test(textToInsert) || /^to\b/i.test(currentCellVal.trim());
        if (!startsWithTo) {
          textToInsert = `To ${textToInsert}`;
        }
      } else {
        const startsWithBy = /^by\b/i.test(textToInsert) || /^by\b/i.test(currentCellVal.trim());
        if (!startsWithBy) {
          textToInsert = `By ${textToInsert}`;
        }
      }
    }

    let newVal = '';
    const trimmedCell = currentCellVal.trim();
    if (!trimmedCell) {
      if (textToInsert === 'To') {
        newVal = 'To ';
      } else if (textToInsert === 'By') {
        newVal = 'By ';
      } else {
        newVal = textToInsert;
      }
    } else if (trimmedCell.toLowerCase() === 'to') {
      if (textToInsert === 'To' || textToInsert.toLowerCase() === 'to') {
        newVal = 'To ';
      } else {
        newVal = `To ${textToInsert}`;
      }
    } else if (trimmedCell.toLowerCase() === 'by') {
      if (textToInsert === 'By' || textToInsert.toLowerCase() === 'by') {
        newVal = 'By ';
      } else {
        newVal = `By ${textToInsert}`;
      }
    } else {
      newVal = `${trimmedCell} ${textToInsert}`;
    }

    onChange(newVal);
  };

  const isCellBlankOrJustTo = !safeVal.trim() || safeVal.trim().toLowerCase() === 'to' || safeVal.trim().toLowerCase() === 'by';

  const showChipsDropdown = Boolean(
    isEligibleForChips &&
    isFocused &&
    isCellBlankOrJustTo &&
    displayedChips.length > 0
  );

  const isRowTotal = Boolean(isTotalRow);
  const isTotalNumeric = isRowTotal && isNumeric;

  if (isJournal && !isNumeric && !isFocused && safeVal.trim()) {
    const textToShow = hasTo ? safeVal.replace(/^to\s*/i, '') : mainPart;
    return (
      <div
        onClick={() => {
          setIsFocused(true);
          onFocus();
        }}
        className="w-full min-h-[32px] md:min-h-[40px] lg:min-h-[46px] xl:min-h-[54px] 2xl:min-h-[64px] flex items-center justify-between p-1.5 md:p-2.5 cursor-text rounded hover:bg-slate-900/80 transition-colors relative"
      >
        {hasTo && (
          <span className="absolute left-8 md:left-12 lg:left-14 xl:left-16 text-[#f8fafc] text-xs md:text-sm lg:text-base xl:text-lg 2xl:text-xl min-[3840px]:text-2xl font-serif pointer-events-none select-none">
            To
          </span>
        )}
        <span className={`text-[#f8fafc] text-xs md:text-sm lg:text-base xl:text-lg 2xl:text-xl min-[3840px]:text-2xl font-serif truncate ${hasTo ? 'pl-16 md:pl-20 lg:pl-22 xl:pl-24' : ''}`}>
          {textToShow}
        </span>
        {hasDr && (
          <span className="text-amber-400 font-bold font-mono text-[11px] md:text-xs lg:text-sm xl:text-base 2xl:text-lg min-[3840px]:text-xl shrink-0 ml-2 select-none">
            {drPart}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full flex items-center">
      {colIdx === 0 && hasRowText && onClearRow && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onClearRow();
          }}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-30 w-4 h-4 md:w-5 md:h-5 rounded-full bg-rose-500/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/40 flex items-center justify-center transition-all shadow-sm cursor-pointer active:scale-95 shrink-0"
          title="Delete text of entire row"
        >
          <X className="w-2.5 h-2.5 md:w-3 md:h-3" />
        </button>
      )}
      {isJournal && hasTo && isFocused && (
        <span className="absolute left-8 md:left-12 lg:left-14 xl:left-16 text-[#f8fafc] text-xs md:text-sm lg:text-base xl:text-lg 2xl:text-xl min-[3840px]:text-2xl font-serif pointer-events-none select-none">
          To
        </span>
      )}
      <input
        type="text"
        value={displayVal}
        inputMode={isEligibleForChips && isCellBlankOrJustTo && displayedChips.length > 0 ? "none" : (isNumeric ? "decimal" : undefined)}
        onFocus={() => {
          setIsFocused(true);
          onFocus();
        }}
        onBlur={() => {
          setTimeout(() => setIsFocused(false), 200);
        }}
        onChange={handleChange}
        placeholder="—"
        style={{
          paddingRight: (isJournal && hasDr) ? '3rem' : '0.5rem',
        }}
        className={`w-full text-xs md:text-sm lg:text-base xl:text-lg 2xl:text-xl min-[3840px]:text-2xl p-1.5 md:p-2.5 outline-none rounded transition-all ${
          colIdx === 0 && hasRowText ? 'pl-7 md:pl-8' : (hasTo ? 'pl-16 md:pl-20 lg:pl-22 xl:pl-24' : 'pl-2')
        } ${
          isTotalNumeric && isTotalMismatch
            ? 'bg-rose-950/90 text-rose-100 font-mono font-black text-right border-2 border-rose-500 animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.6)]'
            : isTotalNumeric
            ? 'bg-amber-500/20 text-amber-300 font-mono font-black text-right border border-amber-500/50 shadow-sm'
            : isNumeric
            ? 'bg-transparent text-right font-mono font-semibold text-emerald-300 text-slate-100 focus:bg-slate-900/80 focus:ring-1 focus:ring-amber-500/50'
            : 'bg-transparent text-left font-serif text-slate-100 focus:bg-slate-900/80 focus:ring-1 focus:ring-amber-500/50'
        }`}
      />
      {isJournal && hasDr && isFocused && (
        <span className="absolute right-2 font-bold font-mono text-amber-400 text-[11px] md:text-xs lg:text-sm xl:text-base 2xl:text-lg min-[3840px]:text-xl pointer-events-none select-none opacity-80">
          {drPart}
        </span>
      )}

      {/* Refresh & Clear Total Row Buttons (Rendered ONLY in cell containing 'Total') */}
      {isTotalRow && safeVal.trim().toLowerCase() === 'total' && (
        <div className="absolute right-1.5 flex items-center gap-1 shrink-0 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onRefreshTotal) onRefreshTotal();
            }}
            className="w-5 h-5 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/50 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
            title="Re-calculate column totals"
          >
            <RotateCw className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onClearTotalRow) onClearTotalRow();
            }}
            className="w-5 h-5 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/50 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
            title="Delete/Clear total row"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {showChipsDropdown && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 top-full mt-1.5 w-[576px] max-w-[90vw] max-h-64 overflow-y-auto bg-slate-950/95 backdrop-blur-md border border-amber-500/40 rounded-xl p-3 shadow-2xl z-[150] space-y-2.5 text-left animate-fade-in"
        >
          <div className="space-y-1">
            <div className="text-[10px] font-mono font-extrabold uppercase tracking-wider flex items-center gap-1 px-1 text-emerald-400">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>{hasSolutionChips ? 'Solution Chips' : 'Quick Account Terms'}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {displayedChips.map((chip, chipIdx) => (
                <button
                  key={`chip_${chip}_${chipIdx}`}
                  onClick={() => handleChipClick(chip)}
                  className={`px-2 py-1 rounded-md text-xs font-mono font-bold transition-all text-left truncate max-w-full cursor-pointer active:scale-95 border ${
                    chip.toLowerCase() === 'total'
                      ? 'bg-amber-500 hover:bg-amber-400 border-amber-400 text-slate-950 shadow-md font-extrabold scale-105 ml-auto'
                      : chip.toLowerCase() === 'to'
                      ? 'bg-amber-500/20 hover:bg-amber-500/35 border-amber-500/50 text-amber-300'
                      : chip.toLowerCase() === 'by'
                      ? 'bg-sky-500/20 hover:bg-sky-500/35 border-sky-500/50 text-sky-300'
                      : hasSolutionChips
                      ? 'bg-emerald-500/20 hover:bg-emerald-500/35 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-900 hover:bg-amber-500/20 border-slate-800 hover:border-amber-500/40 text-slate-200 hover:text-amber-300'
                  }`}
                >
                  {chip === 'Total' ? '⚡ Total' : chip}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Table-Specific Column Percentage Width Resolver:
// 1. Journal: Date 10%, Particulars 55%, J.F./L.F. 5%, Debit 15%, Credit 15%
// 2. Ledger: Date 10%, Particulars 40%, J.F. 5%, Amount 15%
// Table-Specific Column Percentage Width Resolver:
function getColumnPercentWidthForTable(label: string | undefined, tableType: AccountancyTableType | undefined): number {
  const l = (label || '').toLowerCase().trim();
  const tType = tableType || 'journal';

  if (tType === 'journal') {
    if (l === 'date') return 10;
    if (l === 'particulars') return 55;
    if (l === 'l.f.' || l === 'j.f.') return 5;
    if (l.includes('debit') || l.includes('credit')) return 15;
    return 15;
  }

  if (tType === 't_shape_ledger') {
    if (l.includes('date')) return 10;
    if (l.includes('particulars')) return 40;
    if (l === 'j.f.' || l === 'l.f.') return 5;
    if (l.includes('amount')) return 15;
    return 15;
  }

  if (tType === 't_shape_ledger_no_date') {
    if (l.includes('particulars')) return 35;
    if (l === '' || l === 'j.f.' || l === 'l.f.' || l.includes('amount')) return 15;
    return 15;
  }

  if (tType === 'balance_sheet') {
    if (l.includes('liabilities') || l.includes('assets')) return 35;
    if (l.includes('amount')) return 15;
    return 20;
  }

  if (tType === 'balance_sheet_company') {
    if (l.includes('particulars')) return 60;
    if (l.includes('note')) return 5;
    if (l.includes('year') || l.includes('amount') || l.includes('figure')) return 15;
    return 15;
  }

  if (tType === 'notes_to_accounts') {
    if (l.includes('particulars')) return 70;
    if (l === '' || l.includes('amount')) return 15;
    return 15;
  }

  if (tType === 'trial_balance') {
    if (l === 's.no.' || l === 's.no' || l === 's.n.' || l === 's.n') return 5;
    if (l.includes('particulars') || l.includes('name of account')) return 55;
    if (l === 'l.f.' || l === 'j.f.') return 5;
    if (l.includes('debit') || l.includes('credit') || l.includes('amount')) return 15;
    return 15;
  }

  // Fallback custom grid
  if (l.includes('date')) return 10;
  if (l.includes('particulars') || l.includes('name')) return 55;
  if (l === 'j.f.' || l === 'l.f.' || l.includes('s.n')) return 5;
  if (l.includes('debit') || l.includes('credit') || l.includes('amount')) return 15;
  return 15;
}

function getEffectiveColumnPercentWidth(col: AccountancyColumn | undefined, colIdx: number, tableType: AccountancyTableType | undefined): number {
  if (tableType === 't_shape_ledger_no_date') {
    const l = (col?.label || '').toLowerCase().trim();
    if (l.includes('particulars')) return 35;
    if (colIdx === 1 || colIdx === 4 || l === '' || l === 'j.f.' || l === 'l.f.' || l.includes('amount')) return 15;
    return 15;
  }
  if (tableType === 'balance_sheet_company') {
    const l = (col?.label || '').toLowerCase().trim();
    if (l.includes('particulars')) return 60;
    if (l.includes('note')) return 5;
    if (l.includes('year') || l.includes('amount') || l.includes('figure')) return 15;
    return 15;
  }
  if (tableType === 'notes_to_accounts') {
    const l = (col?.label || '').toLowerCase().trim();
    if (l.includes('particulars')) return 70;
    if (colIdx === 1 || l === '' || l.includes('amount')) return 15;
    return 15;
  }
  const fallback = getColumnPercentWidthForTable(col?.label, tableType);
  return col?.percentWidth || fallback;
}

const PRESET_TABLES: Record<AccountancyTableType, { name: string; headers: { label: string; percentWidth: number }[] }> = {
  journal: {
    name: 'Journal Entries (5 Columns)',
    headers: [
      { label: 'Date', percentWidth: 10 },
      { label: 'Particulars', percentWidth: 55 },
      { label: 'L.F.', percentWidth: 5 },
      { label: 'Debit (₹)', percentWidth: 15 },
      { label: 'Credit (₹)', percentWidth: 15 },
    ],
  },
  t_shape_ledger: {
    name: 'T-Shape Ledger Account (8 Columns)',
    headers: [
      { label: 'Date', percentWidth: 10 },
      { label: 'Particulars', percentWidth: 40 },
      { label: 'J.F.', percentWidth: 5 },
      { label: 'Amount (₹)', percentWidth: 15 },
      { label: 'Date', percentWidth: 10 },
      { label: 'Particulars', percentWidth: 40 },
      { label: 'J.F.', percentWidth: 5 },
      { label: 'Amount (₹)', percentWidth: 15 },
    ],
  },
  t_shape_ledger_no_date: {
    name: 'T-Shape Account (No Date - 6 Columns)',
    headers: [
      { label: 'Particulars', percentWidth: 35 },
      { label: '', percentWidth: 15 },
      { label: 'Amount (₹)', percentWidth: 15 },
      { label: 'Particulars', percentWidth: 35 },
      { label: '', percentWidth: 15 },
      { label: 'Amount (₹)', percentWidth: 15 },
    ],
  },
  balance_sheet: {
    name: 'Balance Sheet (4 Columns)',
    headers: [
      { label: 'Liabilities', percentWidth: 35 },
      { label: 'Amount (₹)', percentWidth: 15 },
      { label: 'Assets', percentWidth: 35 },
      { label: 'Amount (₹)', percentWidth: 15 },
    ],
  },
  balance_sheet_company: {
    name: 'Company Balance Sheet (Schedule III)',
    headers: [
      { label: 'Particulars', percentWidth: 60 },
      { label: 'Note No.', percentWidth: 5 },
      { label: 'Current Year (₹)', percentWidth: 15 },
      { label: 'Previous Year (₹)', percentWidth: 15 },
    ],
  },
  notes_to_accounts: {
    name: 'Notes to Accounts (3 Columns)',
    headers: [
      { label: 'Particulars', percentWidth: 70 },
      { label: '', percentWidth: 15 },
      { label: 'Amount (₹)', percentWidth: 15 },
    ],
  },
  trial_balance: {
    name: 'Trial Balance (5 Columns)',
    headers: [
      { label: 'S.No.', percentWidth: 5 },
      { label: 'Name of Account', percentWidth: 55 },
      { label: 'L.F.', percentWidth: 5 },
      { label: 'Debit (₹)', percentWidth: 15 },
      { label: 'Credit (₹)', percentWidth: 15 },
    ],
  },
  custom: {
    name: 'Custom Table Grid',
    headers: [
      { label: 'Column 1', percentWidth: 10 },
      { label: 'Column 2', percentWidth: 55 },
      { label: 'Column 3', percentWidth: 5 },
      { label: 'Column 4', percentWidth: 15 },
      { label: 'Column 5', percentWidth: 15 },
    ],
  },
};

// Removed 'To ', 'By ', 'Dr.', 'Cr.' as requested
const ACCOUNT_TERMS = [
  'Cash A/c', 'Bank A/c', 'Capital A/c', 'Purchases A/c', 'Sales A/c',
  'Machinery A/c', 'Debtors A/c', 'Creditors A/c', 'Furniture A/c',
  'Salary A/c', 'Rent A/c'
];

function getCleanTableTypeName(type: AccountancyTableType): string {
  switch (type) {
    case 'journal':
      return 'Journal';
    case 't_shape_ledger':
      return 'T-Shape Ledger';
    case 't_shape_ledger_no_date':
      return 'T-Shape Account (No Date)';
    case 'balance_sheet':
      return 'Balance Sheet';
    case 'balance_sheet_company':
      return 'Company Balance Sheet';
    case 'notes_to_accounts':
      return 'Notes to Accounts';
    case 'trial_balance':
      return 'Trial Balance';
    case 'custom':
      return 'Custom Table';
    default:
      return 'Journal';
  }
}

function formatTabDisplayTitle(tab: AccountancyTabConfig): string {
  if (!tab?.title) return getCleanTableTypeName(tab?.tableType || 'journal');
  let title = tab.title;
  title = title.replace(/^Tab\s+\d+\s*\((.*?)\)$/i, '$1');
  title = title.replace(/^\((.*?)\)$/, '$1').trim();
  return title || getCleanTableTypeName(tab.tableType);
}

export default function AccountancyQuestionModal({
  question,
  questionNumber,
  totalQuestions,
  isOpen,
  onClose,
}: AccountancyQuestionModalProps) {
  // Process raw question item
  const qObj: InquiryQuestionObj = useMemo(() => {
    if (!question) {
      return { id: 'temp-q', text: 'No question details available.' };
    }
    if (typeof question === 'string') {
      return { id: 'temp-q', text: question };
    }
    return question;
  }, [question]);

  const qId = qObj?.id || 'temp-q';

  // Tab State (loaded from local storage if available)
  const [tabs, setTabs] = useState<AccountancyTabConfig[]>(() => {
    const savedLocal = localStorage.getItem(`accountancy_tabs_${qId}`);
    if (savedLocal) {
      try {
        const parsed = JSON.parse(savedLocal);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    if (qObj.tabs && qObj.tabs.length > 0) return qObj.tabs;
    return [];
  });
  const [activeTabId, setActiveTabId] = useState<string>('q_tab');
  const [showAnswer, setShowAnswer] = useState<boolean>(false);

  // Tab Editing state
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabTitle, setEditingTabTitle] = useState<string>('');

  // Focused cell state for quick term insertion
  const [focusedCell, setFocusedCell] = useState<{ rowIdx: number; colIdx: number } | null>(null);

  const [isSavedLocally, setIsSavedLocally] = useState<boolean>(false);

  // Active Tab Object
  const activeTab = tabs.find(t => t.id === activeTabId);

  // Extract Solution Chips dynamically from the question's answer / solution text & tables for active table type
  const solutionChips = useMemo(() => {
    const currentTableType = activeTab?.tableType || 'journal';
    return extractSolutionChips(qObj.answerText, qObj.tabs, currentTableType);
  }, [qObj.answerText, qObj.tabs, activeTab?.tableType]);

  // Auto-save changes to localStorage and ensure tabs update on qId change
  useEffect(() => {
    const savedLocal = localStorage.getItem(`accountancy_tabs_${qId}`);
    if (savedLocal) {
      try {
        const parsed = JSON.parse(savedLocal);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTabs(parsed);
          return;
        }
      } catch (e) {}
    }
    if (qObj.tabs && Array.isArray(qObj.tabs) && qObj.tabs.length > 0) {
      setTabs(qObj.tabs);
    } else {
      const defaultPreset = PRESET_TABLES.journal;
      const initialTab: AccountancyTabConfig = {
        id: `tab_${Date.now()}`,
        title: getCleanTableTypeName('journal'),
        tableType: 'journal',
        columns: defaultPreset.headers.map((h, idx) => ({ id: `col_${idx}`, label: h.label, percentWidth: h.percentWidth })),
        rows: Array.from({ length: 20 }, () => Array(defaultPreset.headers.length).fill('')),
      };
      setTabs([initialTab]);
    }
  }, [qId]);

  useEffect(() => {
    if (tabs && tabs.length > 0) {
      localStorage.setItem(`accountancy_tabs_${qId}`, JSON.stringify(tabs));
    }
  }, [tabs, qId]);

  // Handler when user selects the "Total" chip in targetRowIdx, targetColIdx
  const handleSelectTotalChip = (targetRowIdx: number, targetColIdx: number) => {
    if (!activeTab || !Array.isArray(activeTab.columns) || !Array.isArray(activeTab.rows)) return;

    // 1. Calculate column sums from row 0 up to targetRowIdx - 1
    const totals: Record<number, number> = {};
    activeTab.columns.forEach((col, cIdx) => {
      const colLabel = (col?.label || '').toLowerCase().trim();
      const isDateCol = colLabel.includes('date');
      // Auto-total ONLY columns with explicit amount/debit/credit/year headers (excludes J.F./L.F.)
      const isTotalableCol = !isDateCol && (
                             colLabel.includes('debit') ||
                             colLabel.includes('credit') ||
                             colLabel.includes('amount') ||
                             colLabel.includes('dr') ||
                             colLabel.includes('cr') ||
                             colLabel.includes('amt') ||
                             colLabel.includes('year') ||
                             (activeTab.tableType === 'notes_to_accounts' && cIdx === 1));

      if (isTotalableCol) {
        let sum = 0;
        for (let r = 0; r < targetRowIdx; r++) {
          const rRow = activeTab.rows[r];
          if (Array.isArray(rRow)) {
            // Ignore disabled cells in column summation
            if (isCellDisabledInRow(rRow, cIdx, activeTab.columns, activeTab.tableType)) {
              continue;
            }
            const val = rRow[cIdx];
            if (typeof val === 'string' && val.trim()) {
              const num = parseNumericValue(val);
              sum += num;
            }
          }
        }
        totals[cIdx] = sum;
      }
    });

    // 2. Set target cell to "Total" and populate numeric column cells with totals
    const updatedRows = activeTab.rows.map((row, rIdx) => {
      if (rIdx === targetRowIdx) {
        const safeRow = Array.isArray(row) ? [...row] : Array(activeTab.columns.length).fill('');
        safeRow[targetColIdx] = 'Total';
        activeTab.columns.forEach((col, cIdx) => {
          if (totals[cIdx] !== undefined) {
            safeRow[cIdx] = formatIndianNumber(totals[cIdx].toString());
          }
        });
        return safeRow;
      }
      return row;
    });

    setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, rows: updatedRows } : t));
  };

  // Clear all text and values in targetRowIdx
  const handleClearTotalRow = (targetRowIdx: number) => {
    if (!activeTab || !Array.isArray(activeTab.rows)) return;
    const updatedRows = activeTab.rows.map((row, rIdx) => {
      if (rIdx === targetRowIdx) {
        return Array(activeTab.columns.length).fill('');
      }
      return row;
    });
    setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, rows: updatedRows } : t));
  };

  // Dynamic Percentage Table Width


  // Dynamic Percentage Table Width
  const totalTablePercent = useMemo(() => {
    if (!activeTab || !activeTab.columns) return 100;
    const sum = activeTab.columns.reduce((acc, col, cIdx) => acc + getEffectiveColumnPercentWidth(col, cIdx, activeTab.tableType), 0);
    return Math.max(sum, 100);
  }, [activeTab]);

  if (!isOpen) return null;

  // Add a new tab
  const handleAddTab = () => {
    const newId = `tab_${Date.now()}`;
    const defaultPreset = PRESET_TABLES.journal;
    const newTab: AccountancyTabConfig = {
      id: newId,
      title: getCleanTableTypeName('journal'),
      tableType: 'journal',
      columns: defaultPreset.headers.map((h, idx) => ({ id: `col_${idx}`, label: h.label, percentWidth: h.percentWidth })),
      rows: Array.from({ length: 20 }, () => Array(defaultPreset.headers.length).fill('')),
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Delete a tab
  const handleDeleteTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTabId === tabId) {
      setActiveTabId('q_tab');
    }
  };

  // Start editing tab name
  const handleStartRenameTab = (tab: AccountancyTabConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTabId(tab.id);
    setEditingTabTitle(tab.title);
  };

  const handleSaveTabRename = (tabId: string) => {
    if (editingTabTitle.trim()) {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, title: editingTabTitle.trim() } : t));
    }
    setEditingTabId(null);
  };

  // Change Table Type for active tab
  const handleTableTypeChange = (newType: AccountancyTableType) => {
    if (!activeTab) return;
    const preset = PRESET_TABLES[newType] || PRESET_TABLES.journal;
    const newCols = preset.headers.map((h, idx) => ({ id: `col_${idx}_${Date.now()}`, label: h.label, percentWidth: h.percentWidth }));
    
    // Adjust rows to match new column count with minimum 20 rows
    const existingRows = Array.isArray(activeTab.rows) ? activeTab.rows : [];
    const updatedRows = existingRows.map(row => {
      const safeRow = Array.isArray(row) ? row : [];
      const newRow = Array(newCols.length).fill('');
      for (let i = 0; i < Math.min(safeRow.length, newCols.length); i++) {
        newRow[i] = safeRow[i] || '';
      }
      return newRow;
    });

    const rowsWith20Min = updatedRows.length < 20
      ? [...updatedRows, ...Array.from({ length: 20 - updatedRows.length }, () => Array(newCols.length).fill(''))]
      : updatedRows;

    setTabs(prev => prev.map(t => {
      if (t.id === activeTab.id) {
        return {
          ...t,
          tableType: newType,
          title: getCleanTableTypeName(newType),
          columns: newCols,
          rows: rowsWith20Min,
        };
      }
      return t;
    }));
  };

  // Cell Change
  const handleCellChange = (rowIdx: number, colIdx: number, val: string) => {
    if (!activeTab) return;
    const updatedRows = activeTab.rows.map((row, rIdx) => {
      if (rIdx === rowIdx) {
        const newRow = [...row];
        newRow[colIdx] = val;
        return newRow;
      }
      return row;
    });

    setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, rows: updatedRows } : t));
  };

  // Insert quick account term into focused cell
  const handleInsertTerm = (term: string) => {
    if (!activeTab || !focusedCell) return;
    const { rowIdx, colIdx } = focusedCell;
    const currentVal = activeTab.rows[rowIdx]?.[colIdx] || '';
    const newVal = currentVal ? `${currentVal} ${term}` : term;
    handleCellChange(rowIdx, colIdx, newVal);
  };

  // Synchronized Amount column addition for T-Shape Account (Dr & Cr together at 15% width each)
  const handleAddAmountColumnTShape = () => {
    if (!activeTab) return;
    const cols = [...activeTab.columns];

    // Find last Dr Amount column index and last Cr Amount column index
    let lastDrAmountIdx = -1;
    let lastCrAmountIdx = -1;

    cols.forEach((col, idx) => {
      const l = col.label.toLowerCase();
      if (l.includes('amount') && idx < cols.length / 2) {
        lastDrAmountIdx = idx;
      } else if (l.includes('amount')) {
        lastCrAmountIdx = idx;
      }
    });

    if (lastDrAmountIdx === -1) lastDrAmountIdx = 3;
    if (lastCrAmountIdx === -1) lastCrAmountIdx = cols.length - 1;

    const newDrCol: AccountancyColumn = { id: `col_dr_amt_${Date.now()}`, label: 'Amount (₹)', percentWidth: 15 };
    const newCrCol: AccountancyColumn = { id: `col_cr_amt_${Date.now()}`, label: 'Amount (₹)', percentWidth: 15 };

    // Insert Cr first so Dr index doesn't shift
    cols.splice(lastCrAmountIdx + 1, 0, newCrCol);
    cols.splice(lastDrAmountIdx + 1, 0, newDrCol);

    const updatedRows = activeTab.rows.map(row => {
      const newRow = [...row];
      newRow.splice(lastCrAmountIdx + 1, 0, '');
      newRow.splice(lastDrAmountIdx + 1, 0, '');
      return newRow;
    });

    setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, columns: cols, rows: updatedRows } : t));
  };

  // Synchronized Amount column removal for T-Shape Account (Dr & Cr together)
  const handleRemoveAmountColumnTShape = () => {
    if (!activeTab) return;

    // Count Amount columns on Debit and Credit sides
    const drAmountCols = activeTab.columns.filter((c, idx) => c.label.toLowerCase().includes('amount') && idx < activeTab.columns.length / 2);
    const crAmountCols = activeTab.columns.filter((c, idx) => c.label.toLowerCase().includes('amount') && idx >= activeTab.columns.length / 2);

    // Keep minimum 1 Amount column on each side
    if (drAmountCols.length <= 1 || crAmountCols.length <= 1) return;

    const cols = [...activeTab.columns];
    let lastDrIdx = -1;
    let lastCrIdx = -1;

    cols.forEach((col, idx) => {
      const l = col.label.toLowerCase();
      if (l.includes('amount') && idx < cols.length / 2) lastDrIdx = idx;
      else if (l.includes('amount')) lastCrIdx = idx;
    });

    if (lastDrIdx !== -1 && lastCrIdx !== -1) {
      const removeFirst = Math.max(lastDrIdx, lastCrIdx);
      const removeSecond = Math.min(lastDrIdx, lastCrIdx);

      cols.splice(removeFirst, 1);
      cols.splice(removeSecond, 1);

      const updatedRows = activeTab.rows.map(row => {
        const newRow = [...row];
        newRow.splice(removeFirst, 1);
        newRow.splice(removeSecond, 1);
        return newRow;
      });

      setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, columns: cols, rows: updatedRows } : t));
    }
  };

  // Real-Time Auto-Balancing Calculation
  const autoBalanceSummary = useMemo(() => {
    if (!activeTab || !Array.isArray(activeTab.columns) || !Array.isArray(activeTab.rows)) return null;
    
    let debitTotal = 0;
    let creditTotal = 0;
    let hasDebitCol = false;
    let hasCreditCol = false;

    activeTab.columns.forEach((col, cIdx) => {
      if (!col || !col.label) return;
      const labelLower = col.label.toLowerCase();
      const isDebit = labelLower.includes('debit') || labelLower.includes('dr');
      const isCredit = labelLower.includes('credit') || labelLower.includes('cr');

      if (isDebit) {
        hasDebitCol = true;
        activeTab.rows.forEach(r => {
          if (!Array.isArray(r)) return;
          const val = r[cIdx];
          const num = parseFloat(typeof val === 'string' ? val.replace(/[^0-9.-]+/g, '') : '0');
          if (!isNaN(num)) debitTotal += num;
        });
      }
      if (isCredit) {
        hasCreditCol = true;
        activeTab.rows.forEach(r => {
          if (!Array.isArray(r)) return;
          const val = r[cIdx];
          const num = parseFloat(typeof val === 'string' ? val.replace(/[^0-9.-]+/g, '') : '0');
          if (!isNaN(num)) creditTotal += num;
        });
      }
    });

    if (!hasDebitCol && !hasCreditCol) {
      activeTab.rows.forEach(r => {
        if (!Array.isArray(r) || r.length < 2) return;
        const v1 = r[r.length - 2];
        const v2 = r[r.length - 1];
        const num1 = parseFloat(typeof v1 === 'string' ? v1.replace(/[^0-9.-]+/g, '') : '0');
        const num2 = parseFloat(typeof v2 === 'string' ? v2.replace(/[^0-9.-]+/g, '') : '0');
        if (!isNaN(num1)) debitTotal += num1;
        if (!isNaN(num2)) creditTotal += num2;
      });
      hasDebitCol = true;
      hasCreditCol = true;
    }

    const diff = Math.abs(debitTotal - creditTotal);
    const isBalanced = diff < 0.01;

    return {
      debitTotal,
      creditTotal,
      isBalanced,
      diff,
      hasDebitCol,
      hasCreditCol,
    };
  }, [activeTab]);

  return (
    <ModalErrorBoundary>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in font-sans text-slate-100 selection:bg-amber-500/30">
        <div className="w-full h-full flex flex-col bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          {/* ── MINIMAL TOP HEADER BAR ── */}
      <div className="bg-slate-950 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-2 font-mono text-xs text-slate-400 flex-wrap">
          {questionNumber && totalQuestions && (
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
              Question {questionNumber} of {totalQuestions}
            </span>
          )}
          {qObj.topicTitle && (
            <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold uppercase">
              Topic: {qObj.topicTitle}
            </span>
          )}
          {qObj.marks !== undefined && qObj.marks !== null && (
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
              {qObj.marks} Marks
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isSavedLocally && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-md font-bold animate-fade-in">
              <Check className="w-3 h-3" /> Saved Locally
            </span>
          )}

          <button
            onClick={() => {
              if (tabs && tabs.length > 0) {
                localStorage.setItem(`accountancy_tabs_${qId}`, JSON.stringify(tabs));
              }
              setIsSavedLocally(true);
              setTimeout(() => setIsSavedLocally(false), 2500);
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold font-mono transition-all cursor-pointer shadow-sm active:scale-95"
            title="Save all tables and cells locally on this device"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Local Changes</span>
          </button>

          {/* Close Modal Button */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-transparent text-rose-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 shrink-0"
            title="Close Workspace"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── TOP/MAIN WORKSPACE AREA: TABLE OR QUESTION DISPLAY ── */}
      <div className="flex-1 overflow-hidden relative flex flex-col p-4">
        
        {/* TAB 1: QUESTION & ANSWER VIEW */}
        {activeTabId === 'q_tab' && (
          <div className="flex-1 overflow-y-auto space-y-6 bg-slate-950/70 border border-slate-900 rounded-2xl p-6 md:p-8 shadow-2xl relative z-10">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <h2 className="text-amber-400 font-extrabold text-xs uppercase tracking-widest font-mono">
                  Lesson Question Details
                </h2>
              </div>

              {(qObj.answerText || qObj.answerImage) && (
                <button
                  onClick={() => setShowAnswer(!showAnswer)}
                  className={`p-2 rounded-xl transition-all border cursor-pointer ${
                    showAnswer
                      ? 'bg-slate-700 text-slate-100 border-slate-500 shadow-md'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white hover:border-slate-500'
                  }`}
                  title={showAnswer ? "Hide Solution/Answer" : "Show Solution/Answer"}
                  aria-label={showAnswer ? "Hide Solution/Answer" : "Show Solution/Answer"}
                >
                  {showAnswer ? <EyeOff className="w-4 h-4 text-slate-300" /> : <Eye className="w-4 h-4 text-slate-300" />}
                </button>
              )}
            </div>

            {/* Question Text & Media */}
            <div className="space-y-6">
              <div className="text-slate-100 text-xs md:text-base lg:text-lg xl:text-xl 2xl:text-2xl min-[3840px]:text-3xl font-medium leading-relaxed font-serif tracking-wide bg-[#181e2a] p-6 md:p-8 rounded-2xl border border-slate-800/40 shadow-lg">
                <div 
                  dangerouslySetInnerHTML={{ __html: renderMathInRawHtml(qObj.text) }} 
                  className="prose prose-invert max-w-none text-xs md:text-base lg:text-lg xl:text-xl 2xl:text-2xl min-[3840px]:text-3xl"
                />
              </div>

              {qObj.image && (
                <div className={`flex ${qObj.imagePosition === 'left' ? 'justify-start' : qObj.imagePosition === 'right' ? 'justify-end' : 'justify-center'} my-4`}>
                  <img
                    src={qObj.image}
                    alt="Question Diagram"
                    className="max-h-96 rounded-xl border border-slate-800 shadow-xl object-contain"
                  />
                </div>
              )}

              {/* Toggle Answer Button Beneath Question */}
              {(qObj.answerText || qObj.answerImage) && (
                <div className="pt-2 flex justify-end w-full">
                  <button
                    onClick={() => setShowAnswer(!showAnswer)}
                    className={`p-2.5 rounded-xl transition-all border cursor-pointer ${
                      showAnswer
                        ? 'bg-slate-700 text-slate-100 border-slate-500 shadow-md shadow-slate-950/40'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white hover:border-slate-500 shadow-sm'
                    }`}
                    title={showAnswer ? "Hide Solution/Answer" : "Show Solution/Answer"}
                    aria-label={showAnswer ? "Hide Solution/Answer" : "Show Solution/Answer"}
                  >
                    {showAnswer ? <EyeOff className="w-5 h-5 text-slate-300" /> : <Eye className="w-5 h-5 text-slate-300" />}
                  </button>
                </div>
              )}
            </div>

            {/* Answer Display Section */}
            {showAnswer && (qObj.answerText || qObj.answerImage) && (
              <div className="mt-8 pt-6 border-t border-emerald-500/30 bg-emerald-950/20 border rounded-2xl p-6 space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs md:text-sm lg:text-base xl:text-lg 2xl:text-xl uppercase tracking-wider font-mono">
                  <Check className="w-4 h-4" />
                  <span>Verified Solution & Answer</span>
                </div>

                {qObj.answerText && (
                  <div
                    dangerouslySetInnerHTML={{ __html: renderMathInRawHtml(qObj.answerText) }}
                    className="text-slate-200 text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl min-[3840px]:text-3xl leading-relaxed font-serif"
                  />
                )}

                {qObj.answerImage && (
                  <div className={`flex ${qObj.answerImagePosition === 'left' ? 'justify-start' : qObj.answerImagePosition === 'right' ? 'justify-end' : 'justify-center'} mt-3`}>
                    <img
                      src={qObj.answerImage}
                      alt="Solution Illustration"
                      className="max-h-80 rounded-xl border border-emerald-500/30 shadow-lg object-contain"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* USER-CREATED ACCOUNTANCY TABLE TABS */}
        {activeTab && activeTabId !== 'q_tab' && (
          <ModalErrorBoundary>
            <div className="flex-1 flex flex-col bg-slate-950/80 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl relative z-10">
            
            {/* Interactive Grid Table Area */}
            <div className="flex-1 overflow-auto p-4 md:p-6 relative pointer-events-auto">
              {/* Dr. and Cr. Header Strip for T-Shape Ledger */}
              {(activeTab.tableType === 't_shape_ledger' || activeTab.tableType === 't_shape_ledger_no_date') && (
                <div 
                  className="flex items-center justify-between px-4 py-2 bg-slate-900 border-x border-t border-slate-800/90 rounded-t-xl font-mono text-xs md:text-sm lg:text-base xl:text-lg 2xl:text-xl font-black tracking-wider shadow-inner"
                  style={{ width: `${totalTablePercent}%`, minWidth: '100%' }}
                >
                  <span className="text-emerald-400 font-extrabold text-xs md:text-sm lg:text-base xl:text-lg 2xl:text-xl min-[3840px]:text-2xl">Dr.</span>
                  {editingTabId === activeTab.id ? (
                    <div className="flex items-center gap-2 pointer-events-auto">
                      <input
                        type="text"
                        value={editingTabTitle}
                        onChange={(e) => setEditingTabTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveTabRename(activeTab.id)}
                        autoFocus
                        className="bg-slate-950 text-white text-center font-bold px-2 py-0.5 rounded border border-emerald-400 text-xs md:text-sm lg:text-base outline-none max-w-[200px]"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveTabRename(activeTab.id);
                        }}
                        className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 transition-all border border-emerald-500/30 cursor-pointer"
                        title="Save rename"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={(e) => handleStartRenameTab(activeTab, e)}
                      className="flex items-center gap-1.5 cursor-pointer group pointer-events-auto"
                      title="Click to rename account"
                    >
                      <span className="text-slate-400 group-hover:text-white transition-colors text-[11px] md:text-xs lg:text-sm xl:text-base 2xl:text-lg min-[3840px]:text-xl font-bold uppercase tracking-widest">
                        {activeTab.title}
                      </span>
                      <Edit3 className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors shrink-0" />
                    </div>
                  )}
                  <span className="text-sky-400 font-extrabold text-xs md:text-sm lg:text-base xl:text-lg 2xl:text-xl min-[3840px]:text-2xl">Cr.</span>
                </div>
              )}

              {/* Dynamic Percentage Width Table */}
              <table 
                className="border-collapse text-left font-sans table-fixed"
                style={{ width: `${totalTablePercent}%`, minWidth: '100%' }}
              >
                <thead>
                  <tr className="bg-slate-900 border-b-2 border-amber-500/40 text-amber-300 font-mono text-[11px] md:text-xs lg:text-sm xl:text-base 2xl:text-lg min-[3840px]:text-xl uppercase tracking-wider">
                    {(activeTab.columns || []).map((col, colIdx) => {
                      const pWidth = getEffectiveColumnPercentWidth(col, colIdx, activeTab.tableType);
                      const isAmountCol = (col?.label || '').toLowerCase().includes('amount');

                      return (
                        <th
                          key={col.id}
                          style={{ width: `${pWidth}%` }}
                          onDoubleClick={() => handleStartRenameTab(activeTab, {} as any)}
                          className="p-2.5 md:p-3.5 border border-slate-800 font-extrabold select-none hover:bg-slate-850 transition-colors group"
                        >
                          <div className="flex items-center justify-between overflow-hidden">
                            <span className="truncate">{col.label}</span>
                            
                            {/* '+' and '-' buttons placed ONLY on Amount columns */}
                            {isAmountCol && (
                              <div className="flex items-center gap-1 shrink-0 ml-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddAmountColumnTShape();
                                  }}
                                  className="w-4 h-4 md:w-5 md:h-5 rounded bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 flex items-center justify-center font-black text-[10px] md:text-xs lg:text-sm cursor-pointer border border-emerald-500/40 shadow-sm"
                                  title="Add Amount Column to both Debit & Credit sides"
                                >
                                  +
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveAmountColumnTShape();
                                  }}
                                  className="w-4 h-4 md:w-5 md:h-5 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 flex items-center justify-center font-black text-[10px] md:text-xs lg:text-sm cursor-pointer border border-rose-500/40 shadow-sm"
                                  title="Remove Amount Column from both Debit & Credit sides"
                                >
                                  -
                                </button>
                              </div>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {(activeTab.rows || []).map((row, rowIdx) => {
                    const safeRow = Array.isArray(row) ? row : [];

                    // Check if Particulars or text cell in this row contains "Total"
                    const isTotalRow = safeRow.some(val => typeof val === 'string' && /\btotal\b/i.test(val));

                    // Calculate Debit vs Credit mismatch for Total rows
                    let isTotalMismatch = false;
                    if (isTotalRow && activeTab) {
                      let dSum = 0;
                      let cSum = 0;

                      if (activeTab.tableType === 'journal' || activeTab.tableType === 'trial_balance') {
                        const dIdx = (activeTab.columns || []).findIndex(c => (c?.label || '').toLowerCase().includes('debit'));
                        const cIdx = (activeTab.columns || []).findIndex(c => (c?.label || '').toLowerCase().includes('credit'));
                        if (dIdx >= 0) dSum = parseNumericValue(safeRow[dIdx]);
                        if (cIdx >= 0) cSum = parseNumericValue(safeRow[cIdx]);
                      } else if (activeTab.tableType === 't_shape_ledger') {
                        dSum = parseNumericValue(safeRow[3]);
                        cSum = parseNumericValue(safeRow[7]);
                      } else if (activeTab.tableType === 't_shape_ledger_no_date') {
                        dSum = parseNumericValue(safeRow[2]);
                        cSum = parseNumericValue(safeRow[5]);
                      } else if (activeTab.tableType === 'balance_sheet') {
                        dSum = parseNumericValue(safeRow[1]);
                        cSum = parseNumericValue(safeRow[3]);
                      } else if (activeTab.tableType === 'balance_sheet_company') {
                        dSum = parseNumericValue(safeRow[2]);
                        cSum = parseNumericValue(safeRow[3]);
                      }

                      if (dSum > 0 || cSum > 0) {
                        isTotalMismatch = Math.abs(dSum - cSum) > 0.01;
                      }
                    }

                    // Check if no rows after rowIdx contain any text/values
                    let isLastDataRow = true;
                    for (let r = rowIdx + 1; r < (activeTab.rows || []).length; r++) {
                      const nextR = activeTab.rows[r];
                      if (Array.isArray(nextR) && nextR.some(c => c && typeof c === 'string' && c.trim() !== '')) {
                        isLastDataRow = false;
                        break;
                      }
                    }

                    let particularsVal = '';
                    if (activeTab.tableType === 'journal') {
                      const pIdx = (activeTab.columns || []).findIndex(c => (c?.label || '').toLowerCase().includes('particular'));
                      if (pIdx >= 0) {
                        const rawP = safeRow[pIdx];
                        particularsVal = typeof rawP === 'string' ? rawP : (rawP !== undefined && rawP !== null ? String(rawP) : '');
                      }
                    }

                    const hasDr = /\bdr\.?/i.test(particularsVal);
                    const hasTo = /^to\b/i.test(particularsVal.trim());
                    const hasRowText = safeRow.some(val => val !== undefined && val !== null && String(val).trim() !== '');

                    return (
                      <tr key={rowIdx} className="border-b border-slate-850 hover:bg-slate-900/30 transition-colors">
                        {(activeTab.columns || []).map((col, colIdx) => {
                          const rawCell = safeRow[colIdx];
                          const safeRowCell = typeof rawCell === 'string' ? rawCell : (rawCell !== undefined && rawCell !== null ? String(rawCell) : '');
                          const pWidth = getEffectiveColumnPercentWidth(col, colIdx, activeTab.tableType);
                          const colLabel = (col?.label || '').toLowerCase().trim();

                          const isUnnamedJfCol = activeTab.tableType === 't_shape_ledger_no_date' && (colIdx === 1 || colIdx === 4);
                          const isUnnamedNotesCol = activeTab.tableType === 'notes_to_accounts' && colIdx === 1;
                          const isDateCol = colLabel.includes('date');
                          const isNumeric = isUnnamedJfCol || isUnnamedNotesCol || (!isDateCol && (
                                            colLabel.includes('debit') ||
                                            colLabel.includes('credit') ||
                                            colLabel.includes('amount') ||
                                            colLabel.includes('dr') ||
                                            colLabel.includes('cr') ||
                                            colLabel.includes('amt') ||
                                            colLabel.includes('year') ||
                                            colLabel.includes('note')));

                          const isEligibleForChips = !isUnnamedJfCol && !isUnnamedNotesCol && isTextColumnEligibleForChips(colLabel);


                          let isDisabled = isCellDisabledInRow(safeRow, colIdx, activeTab.columns, activeTab.tableType);

                          return (
                            <td
                              key={col?.id || colIdx}
                              style={{ width: `${pWidth}%` }}
                              className="p-1 border border-slate-850"
                            >
                              <JournalCell
                                value={safeRowCell}
                                isJournal={activeTab.tableType === 'journal'}
                                isNumeric={isNumeric}
                                isEligibleForChips={isEligibleForChips}
                                isDisabled={isDisabled}
                                isLastDataRow={isLastDataRow}
                                isTotalRow={isTotalRow}
                                isTotalMismatch={isTotalMismatch}
                                tableType={activeTab.tableType}
                                colIdx={colIdx}
                                totalCols={activeTab.columns.length}
                                solutionChips={solutionChips}
                                presetTerms={ACCOUNT_TERMS}
                                hasRowText={hasRowText}
                                onClearRow={() => handleClearTotalRow(rowIdx)}
                                onFocus={() => setFocusedCell({ rowIdx, colIdx })}
                                onChange={(val) => handleCellChange(rowIdx, colIdx, val)}
                                onSelectTotalChip={() => handleSelectTotalChip(rowIdx, colIdx)}
                                onRefreshTotal={() => handleSelectTotalChip(rowIdx, colIdx)}
                                onClearTotalRow={() => handleClearTotalRow(rowIdx)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </ModalErrorBoundary>
        )}
      </div>

      {/* ── BENEATH TABLE RIBBON: QUICK TABS & FORMAT RIBBON ── */}

      {/* ── BENEATH TABLE RIBBON 2: QUICK TABS & FORMAT RIBBON ── */}
      <div className="bg-slate-950 border-t border-slate-900 px-4 py-2 flex items-center justify-between shrink-0 gap-3 shadow-2xl">
        {/* Tab Navigation List */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-2xl">
          {/* Tab 1: Question */}
          <button
            onClick={() => setActiveTabId('q_tab')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-bold text-xs md:text-sm lg:text-base transition-all cursor-pointer border ${
              activeTabId === 'q_tab'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-950/30'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Question</span>
          </button>

          {/* User Added Dynamic Tabs */}
          {tabs.map((tab) => {
            const isActive = activeTabId === tab.id;
            const isEditing = editingTabId === tab.id;
            const displayTitle = formatTabDisplayTitle(tab);

            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                onDoubleClick={(e) => handleStartRenameTab(tab, e)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs md:text-sm lg:text-base transition-all cursor-pointer border group ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-950/30'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <Calculator className="w-3.5 h-3.5 opacity-70" />
                
                {isEditing ? (
                  <input
                    type="text"
                    value={editingTabTitle}
                    onChange={(e) => setEditingTabTitle(e.target.value)}
                    onBlur={() => handleSaveTabRename(tab.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveTabRename(tab.id)}
                    autoFocus
                    className="bg-slate-950 text-white px-1.5 py-0.5 rounded border border-emerald-400 text-xs outline-none w-28"
                  />
                ) : (
                  <span>{displayTitle}</span>
                )}

                <button
                  onClick={(e) => handleDeleteTab(tab.id, e)}
                  className="w-4 h-4 rounded hover:bg-rose-500/30 hover:text-rose-400 text-slate-500 flex items-center justify-center transition-colors ml-1"
                  title="Delete Tab"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* "+ Add Tab" Button */}
          <button
            onClick={handleAddTab}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-amber-400 font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-95"
            title="Add a new custom Accountancy table tab"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Tab</span>
          </button>
        </div>

        {/* Format Selector */}
        <div className="flex items-center gap-3 shrink-0">
          {activeTab && activeTabId !== 'q_tab' && (
            <select
              value={activeTab.tableType}
              onChange={(e) => handleTableTypeChange(e.target.value as AccountancyTableType)}
              className="bg-slate-900 border border-slate-700 text-amber-300 font-bold text-xs py-1 px-2.5 rounded-lg outline-none cursor-pointer hover:border-amber-500/60 transition-colors"
            >
              {Object.entries(PRESET_TABLES).map(([key, item]) => (
                <option key={key} value={key}>{item.name}</option>
              ))}
            </select>
          )}
        </div>
        </div>
      </div>
    </div>
  </ModalErrorBoundary>
  );
}
