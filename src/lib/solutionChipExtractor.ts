/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccountancyTabConfig, AccountancyTableType } from '../types';

function sanitizeChip(term: string): string {
  if (!term) return '';
  let cleaned = term.trim();
  
  // 1. Remove any leading "To " or "By " added to account names so chips are clean (e.g. "Realisation A/c", "Cash A/c")
  cleaned = cleaned.replace(/^(?:To|By)\s+/i, '').trim();

  // 2. Strip trailing "Dr." or "Dr" if present
  cleaned = cleaned.replace(/\s+Dr\.?$/i, '').trim();

  return cleaned.trim();
}

function isValidChipText(cleaned: string): boolean {
  if (!cleaned || cleaned.length < 2 || cleaned.length > 85) return false;
  const lower = cleaned.toLowerCase();
  if (
    lower === 'to' ||
    lower === 'by' ||
    lower === 'total' ||
    lower === 'particulars' ||
    lower === 'amount' ||
    lower === 'date' ||
    lower === 'l.f.' ||
    lower === 'j.f.' ||
    lower === 's.no.' ||
    lower === 'note no.' ||
    lower === 'note no'
  ) {
    return false;
  }
  if (lower.startsWith('(being') || lower.startsWith('( being') || lower.startsWith('being ')) return false;
  if (
    /^\d+$/.test(cleaned) ||
    /^\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}$/.test(cleaned) ||
    /^[₹$Rs.\s\d,.-]+$/i.test(cleaned)
  ) {
    return false;
  }
  return true;
}

function isTabTypeMatch(tabType: AccountancyTableType | undefined, targetType: AccountancyTableType): boolean {
  if (!tabType) return false;
  if (targetType === 't_shape_ledger' || targetType === 't_shape_ledger_no_date') {
    return tabType === 't_shape_ledger' || tabType === 't_shape_ledger_no_date';
  }
  if (targetType === 'balance_sheet' || targetType === 'balance_sheet_company') {
    return tabType === 'balance_sheet' || tabType === 'balance_sheet_company';
  }
  return tabType === targetType;
}

function isTableCaptionOrTitleMatch(title: string, targetType: AccountancyTableType): boolean {
  const t = (title || '').toLowerCase();
  if (targetType === 'notes_to_accounts') {
    return t.includes('note') || t.includes('notes to account');
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
  let extractedFromMatchingTab = false;

  // 1. Extract cell-by-cell from structured solution tabs matching targetTableType
  if (solutionTabs && Array.isArray(solutionTabs) && solutionTabs.length > 0) {
    const tabsToExtract = targetTableType
      ? solutionTabs.filter(tab => tab && (isTabTypeMatch(tab.tableType, targetTableType) || isTableCaptionOrTitleMatch(tab.title, targetTableType)))
      : solutionTabs;

    if (tabsToExtract.length > 0) {
      extractedFromMatchingTab = true;
      tabsToExtract.forEach((tab) => {
        if (tab && tab.rows && Array.isArray(tab.rows)) {
          // Identify Particulars column indices in tab.columns
          let particularsColIndices: number[] = [];
          if (Array.isArray(tab.columns)) {
            tab.columns.forEach((col, cIdx) => {
              const lbl = (col?.label || '').toLowerCase().trim();
              if (
                lbl.includes('particular') ||
                lbl.includes('name') ||
                lbl.includes('detail') ||
                lbl.includes('description') ||
                lbl.includes('liabilit') ||
                lbl.includes('asset')
              ) {
                particularsColIndices.push(cIdx);
              }
            });
          }
          if (particularsColIndices.length === 0) {
            particularsColIndices = [0];
            if (tab.columns && tab.columns.length >= 6) {
              particularsColIndices.push(3);
            }
          }

          // Consolidated cell-by-cell extraction from Particulars column(s)
          tab.rows.forEach((row) => {
            if (Array.isArray(row)) {
              particularsColIndices.forEach((colIdx) => {
                const cellVal = row[colIdx];
                if (cellVal && typeof cellVal === 'string') {
                  const cleaned = sanitizeChip(cellVal);
                  if (isValidChipText(cleaned)) {
                    chipsSet.add(cleaned);
                  }
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

        // Check if table matches targetTableType
        const isMatch = targetTableType
          ? (isTableCaptionOrTitleMatch(fullTitle, targetTableType) || isTableCaptionOrTitleMatch(tableEl.textContent || '', targetTableType))
          : true;

        if (isMatch) {
          const rows = Array.from(tableEl.querySelectorAll('tr'));
          if (rows.length > 0) {
            let particularsColIndices: number[] = [];

            // Inspect first row (headers)
            const firstRowCells = Array.from(rows[0].querySelectorAll('th, td'));
            firstRowCells.forEach((cell, idx) => {
              const txt = (cell.textContent || '').toLowerCase().trim();
              if (
                txt.includes('particular') ||
                txt.includes('name') ||
                txt.includes('detail') ||
                txt.includes('description') ||
                txt.includes('liabilit') ||
                txt.includes('asset')
              ) {
                particularsColIndices.push(idx);
              }
            });

            if (particularsColIndices.length === 0) {
              particularsColIndices = [0];
              if (firstRowCells.length >= 6) {
                particularsColIndices.push(3);
              }
            }

            // Extract cell-by-cell from Particulars column(s) across all data rows
            const startRowIdx = firstRowCells.some(c => c.tagName === 'TH') ? 1 : 0;
            for (let r = startRowIdx; r < rows.length; r++) {
              const cells = Array.from(rows[r].querySelectorAll('td, th'));
              particularsColIndices.forEach((colIdx) => {
                if (cells[colIdx]) {
                  const rawVal = cells[colIdx].textContent || '';
                  const cleaned = sanitizeChip(rawVal);
                  if (isValidChipText(cleaned)) {
                    chipsSet.add(cleaned);
                  }
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

  // 3. Regex Fallback if no chips found yet
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

  // 4. Fallback across all solutionTabs if still empty
  if (chipsSet.size === 0 && solutionTabs && Array.isArray(solutionTabs)) {
    solutionTabs.forEach((tab) => {
      if (tab && tab.rows && Array.isArray(tab.rows)) {
        tab.rows.forEach((row) => {
          if (Array.isArray(row)) {
            row.forEach((cellVal) => {
              if (cellVal && typeof cellVal === 'string') {
                const cleaned = sanitizeChip(cellVal);
                if (isValidChipText(cleaned)) {
                  chipsSet.add(cleaned);
                }
              }
            });
          }
        });
      }
    });
  }

  return Array.from(chipsSet);
}
