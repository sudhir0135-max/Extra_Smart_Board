/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { InquiryQuestionObj, AccountancyTabConfig, AccountancyTableType, AccountancyColumn } from '../types';
import { 
  X, Plus, Trash2, Edit3, Check, AlertCircle, 
  HelpCircle, Eye, EyeOff, Calculator, Layers, FileText, ChevronRight
} from 'lucide-react';
import { renderMathInRawHtml } from '../lib/mathPreprocessor';

interface AccountancyQuestionModalProps {
  question: string | InquiryQuestionObj;
  questionNumber?: number;
  totalQuestions?: number;
  isOpen: boolean;
  onClose: () => void;
}

function formatIndianNumber(val: string): string {
  if (!val) return '';
  let cleaned = val.replace(/[^0-9.]/g, '');
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

function JournalCell({
  value,
  isJournal,
  isNumeric,
  onFocus,
  onChange,
}: {
  value: string;
  isJournal: boolean;
  isNumeric: boolean;
  onFocus: () => void;
  onChange: (val: string) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  const trimmedStart = value.trimStart();
  const hasTo = isJournal && !isNumeric && trimmedStart.toLowerCase().startsWith('to ');

  // Match "dr." or "dr" at the end of the text (case-insensitive)
  const drMatch = (isJournal && !isNumeric) ? value.match(/^(.*?)(?:\s+)?(\bdr\.?)\s*$/i) : null;
  const hasDr = Boolean(drMatch);
  const mainPart = drMatch ? drMatch[1] : value;
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
      onChange(rawVal);
    }
  };

  const displayVal = isNumeric ? formatIndianNumber(value) : value;

  if (isJournal && hasDr && !isFocused) {
    return (
      <div
        onClick={() => setIsFocused(true)}
        className="w-full min-h-[32px] md:min-h-[40px] lg:min-h-[46px] xl:min-h-[54px] 2xl:min-h-[64px] flex items-center justify-between p-1.5 md:p-2.5 cursor-text rounded hover:bg-slate-900/80 transition-colors"
      >
        <span className={`text-[#f8fafc] text-xs md:text-sm lg:text-base xl:text-lg 2xl:text-xl min-[3840px]:text-2xl font-serif truncate ${hasTo ? 'pl-5 md:pl-8 lg:pl-12' : ''}`}>
          {mainPart}
        </span>
        <span className="text-amber-400 font-bold font-mono text-[11px] md:text-xs lg:text-sm xl:text-base 2xl:text-lg min-[3840px]:text-xl shrink-0 ml-2 select-none">
          {drPart}
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full flex items-center">
      <input
        type="text"
        value={displayVal}
        onFocus={() => {
          setIsFocused(true);
          onFocus();
        }}
        onBlur={() => setIsFocused(false)}
        onChange={handleChange}
        placeholder="—"
        style={{
          paddingLeft: hasTo ? '2.2rem' : '0.5rem',
          paddingRight: (isJournal && hasDr) ? '3rem' : '0.5rem',
        }}
        className={`w-full bg-transparent text-slate-100 text-xs md:text-sm lg:text-base xl:text-lg 2xl:text-xl min-[3840px]:text-2xl p-1.5 md:p-2.5 outline-none focus:bg-slate-900/80 focus:ring-1 focus:ring-amber-500/50 rounded ${
          isNumeric ? 'text-right font-mono font-semibold text-emerald-300' : 'text-left font-serif'
        }`}
      />
      {isJournal && hasDr && isFocused && (
        <span className="absolute right-2 font-bold font-mono text-amber-400 text-[11px] md:text-xs lg:text-sm xl:text-base 2xl:text-lg min-[3840px]:text-xl pointer-events-none select-none opacity-80">
          {drPart}
        </span>
      )}
    </div>
  );
}

// Table-Specific Column Percentage Width Resolver:
// 1. Journal: Date 10%, Particulars 55%, J.F./L.F. 5%, Debit 15%, Credit 15%
// 2. Ledger: Date 10%, Particulars 40%, J.F. 5%, Amount 15%
// 3. Balance Sheet: Liabilities 35%, Amount 15%, Assets 35%, Amount 15%
// 4. Trial Balance: S.N. 5%, Particulars/Name 65%, Debit 15%, Credit 15%
function getColumnPercentWidthForTable(label: string, tableType: AccountancyTableType): number {
  const l = label.toLowerCase().trim();

  if (tableType === 'journal') {
    if (l === 'date') return 10;
    if (l === 'particulars') return 55;
    if (l === 'l.f.' || l === 'j.f.') return 5;
    if (l.includes('debit') || l.includes('credit')) return 15;
    return 15;
  }

  if (tableType === 't_shape_ledger') {
    if (l.includes('date')) return 10;
    if (l.includes('particulars')) return 40;
    if (l === 'j.f.' || l === 'l.f.') return 5;
    if (l.includes('amount')) return 15;
    return 15;
  }

  if (tableType === 'balance_sheet') {
    if (l.includes('liabilities') || l.includes('assets')) return 35;
    if (l.includes('amount')) return 15;
    return 20;
  }

  if (tableType === 'trial_balance') {
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
  balance_sheet: {
    name: 'Balance Sheet (4 Columns)',
    headers: [
      { label: 'Liabilities', percentWidth: 35 },
      { label: 'Amount (₹)', percentWidth: 15 },
      { label: 'Assets', percentWidth: 35 },
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
    case 'balance_sheet':
      return 'Balance Sheet';
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
    if (typeof question === 'string') {
      return { id: 'temp-q', text: question };
    }
    return question;
  }, [question]);

  const qId = qObj.id || 'temp-q';

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

  // Auto-save changes to localStorage
  useEffect(() => {
    if (tabs && tabs.length > 0) {
      localStorage.setItem(`accountancy_tabs_${qId}`, JSON.stringify(tabs));
    }
  }, [tabs, qId]);

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

  // Active Tab Object
  const activeTab = tabs.find(t => t.id === activeTabId);

  // Dynamic Percentage Table Width (Expands beyond 100% when columns are added without shrinking existing columns)
  const totalTablePercent = useMemo(() => {
    if (!activeTab || !activeTab.columns) return 100;
    const sum = activeTab.columns.reduce((acc, col) => acc + (col.percentWidth || getColumnPercentWidthForTable(col.label, activeTab.tableType)), 0);
    return Math.max(sum, 100);
  }, [activeTab]);

  // Change Table Type for active tab
  const handleTableTypeChange = (newType: AccountancyTableType) => {
    if (!activeTab) return;
    const preset = PRESET_TABLES[newType];
    const newCols = preset.headers.map((h, idx) => ({ id: `col_${idx}_${Date.now()}`, label: h.label, percentWidth: h.percentWidth }));
    
    // Adjust rows to match new column count with minimum 20 rows
    const updatedRows = activeTab.rows.map(row => {
      const newRow = Array(newCols.length).fill('');
      for (let i = 0; i < Math.min(row.length, newCols.length); i++) {
        newRow[i] = row[i];
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
    if (!activeTab) return null;
    
    let debitTotal = 0;
    let creditTotal = 0;
    let hasDebitCol = false;
    let hasCreditCol = false;

    activeTab.columns.forEach((col, cIdx) => {
      const labelLower = col.label.toLowerCase();
      const isDebit = labelLower.includes('debit') || labelLower.includes('dr');
      const isCredit = labelLower.includes('credit') || labelLower.includes('cr');

      if (isDebit) {
        hasDebitCol = true;
        activeTab.rows.forEach(r => {
          const num = parseFloat(r[cIdx]?.replace(/[^0-9.-]+/g, '') || '0');
          if (!isNaN(num)) debitTotal += num;
        });
      }
      if (isCredit) {
        hasCreditCol = true;
        activeTab.rows.forEach(r => {
          const num = parseFloat(r[cIdx]?.replace(/[^0-9.-]+/g, '') || '0');
          if (!isNaN(num)) creditTotal += num;
        });
      }
    });

    if (!hasDebitCol && !hasCreditCol) {
      // Fallback: sum 4th and 5th columns or last columns if numeric
      activeTab.rows.forEach(r => {
        const num1 = parseFloat(r[r.length - 2]?.replace(/[^0-9.-]+/g, '') || '0');
        const num2 = parseFloat(r[r.length - 1]?.replace(/[^0-9.-]+/g, '') || '0');
        if (!isNaN(num1)) debitTotal += num1;
        if (!isNaN(num2)) creditTotal += num2;
      });
      hasDebitCol = true;
      hasCreditCol = true;
    }

    const isBalanced = Math.abs(debitTotal - creditTotal) < 0.01;
    const diff = Math.abs(debitTotal - creditTotal);

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
    <div className="fixed inset-0 bg-[#030712]/90 backdrop-blur-md z-[110] flex flex-col animate-fade-in font-sans text-slate-100 selection:bg-amber-500/30">
      
      {/* ── MINIMAL TOP HEADER BAR ── */}
      <div className="bg-slate-950 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
          {questionNumber && totalQuestions && (
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
              Question {questionNumber} of {totalQuestions}
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
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition-all border cursor-pointer ${
                    showAnswer
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {showAnswer ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showAnswer ? 'Hide Solution Answer' : 'Show Solution Answer'}</span>
                </button>
              )}
            </div>

            {/* Question Text & Media */}
            <div className="space-y-6">
              <div className="text-slate-100 text-sm md:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl min-[3840px]:text-4xl font-medium leading-relaxed font-serif tracking-wide bg-[#181e2a] p-6 md:p-8 rounded-2xl border border-slate-800/40 shadow-lg">
                <div 
                  dangerouslySetInnerHTML={{ __html: renderMathInRawHtml(qObj.text) }} 
                  className="prose prose-invert max-w-none text-sm md:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl min-[3840px]:text-4xl"
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
                <div className="pt-2">
                  <button
                    onClick={() => setShowAnswer(!showAnswer)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs md:text-sm lg:text-base transition-all border cursor-pointer ${
                      showAnswer
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-950/30'
                        : 'bg-slate-900/90 text-amber-300 border-amber-500/40 hover:bg-amber-500/10 hover:border-amber-500/60 shadow-sm'
                    }`}
                  >
                    {showAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-amber-400" />}
                    <span>{showAnswer ? 'Hide Solution Answer' : 'Show Solution Answer'}</span>
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
          <div className="flex-1 flex flex-col bg-slate-950/80 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl relative z-10">
            
            {/* Interactive Grid Table Area */}
            <div className="flex-1 overflow-auto p-4 md:p-6 relative pointer-events-auto">
              {/* Dr. and Cr. Header Strip for T-Shape Ledger */}
              {activeTab.tableType === 't_shape_ledger' && (
                <div 
                  className="flex items-center justify-between px-4 py-2 bg-slate-900 border-x border-t border-slate-800/90 rounded-t-xl font-mono text-xs md:text-sm lg:text-base xl:text-lg 2xl:text-xl font-black select-none tracking-wider shadow-inner"
                  style={{ width: `${totalTablePercent}%`, minWidth: '100%' }}
                >
                  <span className="text-emerald-400 font-extrabold text-xs md:text-sm lg:text-base xl:text-lg 2xl:text-xl min-[3840px]:text-2xl">Dr.</span>
                  <span className="text-slate-400 text-[11px] md:text-xs lg:text-sm xl:text-base 2xl:text-lg min-[3840px]:text-xl font-bold uppercase tracking-widest">{activeTab.title}</span>
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
                    {activeTab.columns.map((col, colIdx) => {
                      const pWidth = col.percentWidth || getColumnPercentWidthForTable(col.label, activeTab.tableType);
                      const isAmountCol = col.label.toLowerCase().includes('amount');

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
                  {activeTab.rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-slate-850 hover:bg-slate-900/30 transition-colors">
                      {row.map((cellVal, colIdx) => {
                        const col = activeTab.columns[colIdx];
                        const pWidth = col ? (col.percentWidth || getColumnPercentWidthForTable(col.label, activeTab.tableType)) : 15;
                        const labelLower = (col?.label || '').toLowerCase();
                        const isNumeric = labelLower.includes('debit') ||
                                          labelLower.includes('credit') ||
                                          labelLower.includes('amount') ||
                                          labelLower.includes('dr') ||
                                          labelLower.includes('cr') ||
                                          labelLower.includes('amt');
                        return (
                          <td
                            key={colIdx}
                            style={{ width: `${pWidth}%` }}
                            className="p-1 border border-slate-850"
                          >
                            <JournalCell
                              value={cellVal}
                              isJournal={activeTab.tableType === 'journal'}
                              isNumeric={isNumeric}
                              onFocus={() => setFocusedCell({ rowIdx, colIdx })}
                              onChange={(val) => handleCellChange(rowIdx, colIdx, val)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── BENEATH TABLE RIBBON 1: QUICK TERMS RIBBON ── */}
      {activeTabId !== 'q_tab' && (
        <div className="bg-slate-950/90 border-t border-slate-800/90 px-6 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[11px] md:text-xs lg:text-sm xl:text-base font-mono text-amber-400 font-bold uppercase tracking-wider shrink-0">
            Quick Terms:
          </span>
          {ACCOUNT_TERMS.map((term) => (
            <button
              key={term}
              onClick={() => handleInsertTerm(term)}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 text-[11px] md:text-xs lg:text-sm xl:text-base 2xl:text-lg min-[3840px]:text-xl font-mono transition-all shrink-0 cursor-pointer active:scale-95"
              title={`Insert "${term}" into focused cell`}
            >
              {term}
            </button>
          ))}
        </div>
      )}

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

        {/* Format Selector & Auto-Balancing */}
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

          {autoBalanceSummary && activeTabId !== 'q_tab' && (
            autoBalanceSummary.isBalanced ? (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-extrabold text-[11px]">
                <Check className="w-3 h-3" />
                <span>Balanced ✓</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-extrabold text-[11px]">
                <AlertCircle className="w-3 h-3" />
                <span>Diff: ₹{autoBalanceSummary.diff.toLocaleString()}</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
