/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccountancyTabConfig } from '../types';

function sanitizeChip(term: string): string {
  if (!term) return '';
  let cleaned = term.trim();
  
  // 1. Strip leading numbers, zeroes, bullets like "01. ", "0 ", "0. ", "(0) "
  cleaned = cleaned.replace(/^[0-9\s.()-]+/g, '').trim();

  // 2. Remove any leading "To " or "By " added to account names so chips are clean (e.g. "Realisation A/c", "Cash A/c")
  cleaned = cleaned.replace(/^(?:To|By)\s+/i, '').trim();

  // 3. Strip trailing "Dr." or "Dr" if present
  cleaned = cleaned.replace(/\s+Dr\.?$/i, '').trim();

  return cleaned.trim();
}

export function extractSolutionChips(
  answerText?: string | null,
  solutionTabs?: AccountancyTabConfig[]
): string[] {
  const chipsSet = new Set<string>();

  // 1. Extract from answerText HTML string
  if (answerText) {
    // Strip HTML tags & decode common HTML entities
    const plainText = answerText
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');

    // Match lines or phrases containing "To ..." or "By ..." or Account names
    const acRegex = /\b([A-Za-z0-9][A-Za-z0-9\s'&.-]{1,35}\s+(?:A\/c|Account))\b/gi;
    let match: RegExpExecArray | null;

    while ((match = acRegex.exec(plainText)) !== null) {
      const cleaned = sanitizeChip(match[1]);
      if (cleaned.length >= 3 && cleaned.length <= 45 && cleaned.toLowerCase() !== 'to') {
        chipsSet.add(cleaned);
      }
    }

    const toByRegex = /(?:^|\s)(?:To|By)\s+([A-Za-z0-9\s'&.-]{1,40}(?:\s+A\/c)?)/gi;
    while ((match = toByRegex.exec(plainText)) !== null) {
      const cleaned = sanitizeChip(match[1]);
      if (cleaned.length >= 3 && cleaned.length <= 45 && cleaned.toLowerCase() !== 'to') {
        chipsSet.add(cleaned);
      }
    }
  }

  // 2. Extract from pre-filled solution tabs if available
  if (solutionTabs && Array.isArray(solutionTabs)) {
    solutionTabs.forEach((tab) => {
      if (tab && tab.rows && Array.isArray(tab.rows)) {
        tab.rows.forEach((row) => {
          if (Array.isArray(row)) {
            row.forEach((cellVal) => {
              if (cellVal && typeof cellVal === 'string') {
                const cleaned = sanitizeChip(cellVal);
                // If it looks like a Particulars entry (non-numeric, not a plain number or date)
                if (
                  cleaned.length >= 3 &&
                  cleaned.length <= 45 &&
                  cleaned.toLowerCase() !== 'to' &&
                  !/^\d+$/.test(cleaned) &&
                  !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cleaned) &&
                  !/^\d+[\d,.]*$/.test(cleaned)
                ) {
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
