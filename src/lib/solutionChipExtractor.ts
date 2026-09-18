/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccountancyTabConfig, AccountancyTableType } from '../types';

function sanitizeChip(term: string): string {
  if (!term) return '';
  let cleaned = term.trim();
  
  // 1. Remove leading "Add:", "Less:", "Add :", "Less :", "Add -", "Less -", "To ", "By "
  cleaned = cleaned.replace(/^(?:Add|Less)\s*[:\-]\s*/i, '').trim();
  cleaned = cleaned.replace(/^(?:To|By)\s+/i, '').trim();

  // 2. Strip trailing "Dr.", "Dr", "Cr.", "Cr", "(Dr.)", "(Cr.)", "(Dr)", "(Cr)"
  cleaned = cleaned.replace(/\s*(?:\(?\b(?:Dr|Cr)\.?\)?)\s*$/i, '').trim();

  return cleaned.trim();
}

function isValidChipText(cleaned: string): boolean {
  if (!cleaned || cleaned.length < 2 || cleaned.length > 250) return false;
  const lower = cleaned.toLowerCase().trim();

  // 1. Structural / Header / Meta keywords to reject
  const invalidExact = new Set([
    'to', 'by', 'total', 'particulars', 'particular', 'details', 'detail',
    'description', 'amount', 'date', 'l.f.', 'j.f.', 's.no.', 's.no',
    'sr.no.', 'sr.no', 'sr no', 'note no.', 'note no', 'note', 'dr', 'dr.',
    'cr', 'cr.', 'debit', 'credit', 'rs.', 'rs', 'amt', 'amt.', 'year',
    'head of account', 'liabilities', 'assets', 'balance c/d', 'balance b/d',
    'balance', 'particulars:', 'particular:'
  ]);
  if (invalidExact.has(lower)) return false;

  // 2. Reject Journal narrations starting with (being... or being...
  if (
    lower.startsWith('(being') ||
    lower.startsWith('( being') ||
    lower.startsWith('being ') ||
    lower.startsWith('being(')
  ) {
    return false;
  }

  // 3. Reject pure numbers (e.g. "123", "45.00")
  if (/^\d+$/.test(cleaned)) return false;

  // 4. Reject pure currency / monetary strings (e.g. "₹50,000", "Rs. 100", "50,000", "-")
  if (/^[₹$Rs.\s\d,.-]+$/i.test(cleaned)) return false;

  // 5. Reject pure date strings or date formats (e.g. "1/1/2024", "2024-01-01", "Jan 1, 2024", "15th March")
  if (
    /^\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}$/.test(cleaned) ||
    /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\b/i.test(cleaned) ||
    /^\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(cleaned) ||
    /^\d{4}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(cleaned)
  ) {
    return false;
  }

  // 6. Reject serial numbers / note labels alone (e.g. "(a)", "(i)", "Note 1", "Q1", "Option A")
  if (/^(?:\([a-z0-9]+\)|[a-z0-9]\)|note\s+\d+|q\d+|case\s+\d+|option\s+[a-z])$/i.test(cleaned)) {
    return false;
  }

  return true;
}

function processParticularsCell(rawVal: string, chipsSet: Set<string>): void {
  if (!rawVal || typeof rawVal !== 'string') return;
  const cleaned = sanitizeChip(rawVal);
  if (isValidChipText(cleaned)) {
    chipsSet.add(cleaned);
  }
}

function getFallbackParticularsIndices(numCols: number, tableType?: AccountancyTableType, headerTexts?: string[]): number[] {
  // If headers provided, check for explicit keywords
  if (headerTexts && headerTexts.length > 0) {
    const indices: number[] = [];
    headerTexts.forEach((txt, idx) => {
      const l = (txt || '').toLowerCase().trim();
      if (
        l.includes('particular') ||
        l.includes('name') ||
        l.includes('detail') ||
        l.includes('description') ||
        l.includes('liabilit') ||
        l.includes('asset') ||
        l.includes('head of account')
      ) {
        indices.push(idx);
      }
    });
    if (indices.length > 0) return indices;
  }

  // Smart fallback by tableType or column count
  if (tableType === 'journal' || numCols === 5) {
    return [1]; // Standard Journal: Date(0), Particulars(1), L.F.(2), Dr(3), Cr(4)
  }
  if (tableType === 't_shape_ledger' || numCols === 8) {
    return [1, 5]; // T-Shape Ledger with Date: Date(0), Part(1), J.F.(2), Amt(3), Date(4), Part(5), J.F.(6), Amt(7)
  }
  if (tableType === 't_shape_ledger_no_date' || numCols === 6) {
    return [0, 3]; // T-Shape Ledger no date: Part(0), J.F.(1), Amt(2), Part(3), J.F.(4), Amt(5)
  }
  if (tableType === 'notes_to_accounts' || tableType === 'bank_reconciliation_statement' || numCols === 3) {
    return [0]; // Notes to accounts or Bank Reconciliation Statement: Part(0), Unnamed(1), Amt(2)
  }
  if (tableType === 'balance_sheet' || numCols === 4) {
    return [0]; // Balance sheet or Trial balance: Part(0)
  }

  return [0];
}

function isTabTypeMatch(tabType: AccountancyTableType | undefined, targetType: AccountancyTableType): boolean {
  if (!tabType) return false;
  if (targetType === 't_shape_ledger' || targetType === 't_shape_ledger_no_date') {
    return tabType === 't_shape_ledger' || tabType === 't_shape_ledger_no_date';
  }
  if (targetType === 'balance_sheet' || targetType === 'balance_sheet_company') {
    return tabType === 'balance_sheet' || tabType === 'balance_sheet_company';
  }
  if (targetType === 'notes_to_accounts' || targetType === 'bank_reconciliation_statement') {
    return tabType === 'notes_to_accounts' || tabType === 'bank_reconciliation_statement';
  }
  return tabType === targetType;
}

function isTableCaptionOrTitleMatch(title: string, targetType: AccountancyTableType): boolean {
  const t = (title || '').toLowerCase();
  if (targetType === 'notes_to_accounts') {
    return t.includes('note') || t.includes('notes to account');
  }
  if (targetType === 'bank_reconciliation_statement') {
    return t.includes('bank reconciliation') || t.includes('reconciliation statement') || t.includes('brs');
  }
  if (targetType === 'journal') {
    return t.includes('journal') || t.includes('books of');
  }
  if (targetType === 't_shape_ledger' || targetType === 't_shape_ledger_no_date') {
    return t.includes('ledger') || t.includes('t-shape') || t.includes('account') || t.includes('a/c');
  }
  if (targetType === 'balance_sheet' || targetType === 'balance_sheet_company') {
    return t.includes('balance sheet') || t.includes('schedule iii');
  }
  if (targetType === 'trial_balance') {
    return t.includes('trial balance');
  }
  return true;
}

export function extractSolutionChips(
  answerText?: string | null,
  solutionTabs?: AccountancyTabConfig[],
  targetTableType?: AccountancyTableType
): string[] {
  const chipsSet = new Set<string>();

  // 1. Extract cell-by-cell from structured solution tabs matching targetTableType
  if (solutionTabs && Array.isArray(solutionTabs) && solutionTabs.length > 0) {
    const tabsToExtract = targetTableType
      ? solutionTabs.filter(tab => tab && (isTabTypeMatch(tab.tableType, targetTableType) || isTableCaptionOrTitleMatch(tab.title, targetTableType)))
      : solutionTabs;

    if (tabsToExtract.length > 0) {
      tabsToExtract.forEach((tab) => {
        if (tab && tab.rows && Array.isArray(tab.rows)) {
          const colLabels = (tab.columns || []).map(c => c?.label || '');
          const particularsColIndices = getFallbackParticularsIndices(
            tab.columns?.length || 0,
            tab.tableType,
            colLabels
          );

          // Extract cell-by-cell strictly from Particulars column(s)
          tab.rows.forEach((row) => {
            if (Array.isArray(row)) {
              particularsColIndices.forEach((colIdx) => {
                const cellVal = row[colIdx];
                if (cellVal && typeof cellVal === 'string') {
                  processParticularsCell(cellVal, chipsSet);
                }
              });
            }
          });
        }
      });
    }
  }

  // 2. Extract cell-by-cell from HTML <table> elements in answerText
  if (answerText && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(answerText, 'text/html');
      const htmlTables = Array.from(doc.querySelectorAll('table'));

      htmlTables.forEach((tableEl) => {
        // Caption text
        const captionText = tableEl.querySelector('caption')?.textContent || '';
        // Heading text immediately preceding table
        let precedingText = '';
        let prev = tableEl.previousElementSibling;
        while (prev && !prev.textContent?.trim()) {
          prev = prev.previousElementSibling;
        }
        if (prev && (prev.tagName.startsWith('H') || prev.tagName === 'P' || prev.tagName === 'DIV' || prev.tagName === 'B')) {
          precedingText = prev.textContent || '';
        }
        const fullTitle = `${captionText} ${precedingText}`.trim();

        const firstRowCells = Array.from(tableEl.querySelectorAll('tr:first-child th, tr:first-child td'));
        const headerTexts = firstRowCells.map(c => c.textContent || '');

        // Check if table matches targetTableType (checking title or header labels — NEVER entire body text)
        const isMatch = targetTableType
          ? (isTableCaptionOrTitleMatch(fullTitle, targetTableType) || headerTexts.some(h => isTableCaptionOrTitleMatch(h, targetTableType)))
          : true;

        if (isMatch) {
          const rows = Array.from(tableEl.querySelectorAll('tr'));
          if (rows.length > 0) {
            const numCols = firstRowCells.length;
            const particularsColIndices = getFallbackParticularsIndices(numCols, targetTableType, headerTexts);

            // Extract cell-by-cell strictly from Particulars column(s) across all data rows
            const startRowIdx = firstRowCells.some(c => c.tagName === 'TH') ? 1 : 0;
            for (let r = startRowIdx; r < rows.length; r++) {
              const cells = Array.from(rows[r].querySelectorAll('td, th'));
              particularsColIndices.forEach((colIdx) => {
                if (cells[colIdx]) {
                  const rawVal = cells[colIdx].textContent || '';
                  processParticularsCell(rawVal, chipsSet);
                }
              });
            }
          }
        }
      });
    } catch (e) {
      // Ignore parser error and continue to fallback
    }
  }

  // 3. Regex Fallback if no chips found from Particulars columns yet
  if (chipsSet.size === 0 && answerText) {
    const plainText = answerText
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&');

    const acRegex = /\b([A-Za-z0-9][A-Za-z0-9\s'&.-]{1,35}\s+(?:A\/c|Account))\b/gi;
    let match: RegExpExecArray | null;
    while ((match = acRegex.exec(plainText)) !== null) {
      const cleaned = sanitizeChip(match[1]);
      if (isValidChipText(cleaned)) {
        chipsSet.add(cleaned);
      }
    }

    const toByRegex = /(?:^|\s)(?:To|By)\s+([A-Za-z0-9\s'&.-]{1,40}(?:\s+A\/c)?)/gi;
    while ((match = toByRegex.exec(plainText)) !== null) {
      const cleaned = sanitizeChip(match[1]);
      if (isValidChipText(cleaned)) {
        chipsSet.add(cleaned);
      }
    }
  }

  // 4. Fallback across Particulars columns of all solutionTabs if still empty
  if (chipsSet.size === 0 && solutionTabs && Array.isArray(solutionTabs)) {
    solutionTabs.forEach((tab) => {
      if (tab && tab.rows && Array.isArray(tab.rows)) {
        const colLabels = (tab.columns || []).map(c => c?.label || '');
        const particularsColIndices = getFallbackParticularsIndices(
          tab.columns?.length || 0,
          tab.tableType,
          colLabels
        );

        tab.rows.forEach((row) => {
          if (Array.isArray(row)) {
            particularsColIndices.forEach((colIdx) => {
              const cellVal = row[colIdx];
              if (cellVal && typeof cellVal === 'string') {
                processParticularsCell(cellVal, chipsSet);
              }
            });
          }
        });
      }
    });
  }

  return Array.from(chipsSet);
}
