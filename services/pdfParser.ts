
import * as pdfjsLib from 'pdfjs-dist';
import { PageText } from '../types';

// Helper function to parse the page range string
const parsePageRangeString = (rangeStr: string, maxPage: number): number[] => {
  if (!rangeStr || rangeStr.trim() === '') {
    // If string is empty or just whitespace, return all pages
    return Array.from({ length: maxPage }, (_, i) => i + 1);
  }

  const pageNumbers = new Set<number>();
  const parts = rangeStr.split(',');

  for (const part of parts) {
    const trimmedPart = part.trim();
    if (trimmedPart === '') continue;

    if (trimmedPart.includes('-')) {
      const rangeParts = trimmedPart.split('-');
      if (rangeParts.length !== 2) {
        throw new Error(`Invalid range format: "${trimmedPart}". Expected format like "start-end".`);
      }
      
      const start = parseInt(rangeParts[0], 10);
      const end = parseInt(rangeParts[1], 10);

      if (isNaN(start) || isNaN(end)) {
        throw new Error(`Invalid page numbers in range: "${trimmedPart}". Pages must be numbers.`);
      }
      if (start < 1 || end > maxPage || start > end) {
        throw new Error(`Invalid page range: "${trimmedPart}". Ensure pages are within 1-${maxPage} and start <= end.`);
      }
      for (let i = start; i <= end; i++) {
        pageNumbers.add(i);
      }
    } else {
      const pageNum = parseInt(trimmedPart, 10);
      if (isNaN(pageNum)) {
        throw new Error(`Invalid page number: "${trimmedPart}". Pages must be numbers.`);
      }
      if (pageNum < 1 || pageNum > maxPage) {
        throw new Error(`Invalid page number: ${pageNum}. Page must be within 1-${maxPage}.`);
      }
      pageNumbers.add(pageNum);
    }
  }

  if (pageNumbers.size === 0) {
    // This case should ideally be caught if rangeStr was not empty but resulted in no valid pages.
    // However, if rangeStr was genuinely trying to specify pages but all were invalid, this is appropriate.
    throw new Error(`No valid pages found in the provided range string: "${rangeStr}".`);
  }
  
  return Array.from(pageNumbers).sort((a, b) => a - b);
};

export const extractTextFromPdf = async (
  file: File,
  pageRangeString?: string
): Promise<PageText[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const maxPage = pdf.numPages;

  let pagesToProcess: number[];
  try {
    pagesToProcess = parsePageRangeString(pageRangeString || '', maxPage);
  } catch (e) {
    // Re-throw parsing errors to be caught by the caller (App.tsx)
    throw e;
  }
  
  if (pagesToProcess.length === 0 && (!pageRangeString || pageRangeString.trim() === '')) {
    // This means parsePageRangeString decided to return all pages, but maxPage was 0 (empty PDF?)
    // Or if parsePageRangeString was called with an empty string and maxPage > 0, it returns all pages.
    // If it's truly an empty PDF.
     if (maxPage === 0) {
        return []; // No pages to process
     }
     // If parsePageRangeString returned empty for a non-empty PDF (should not happen with current logic for empty string)
     // This condition is mostly a safeguard; parsePageRangeString handles empty string by returning all pages.
  } else if (pagesToProcess.length === 0) {
    // This means the pageRangeString was provided, but resulted in no valid pages after parsing.
    // The error for this case is thrown by parsePageRangeString itself.
    // For safety, return empty array if it somehow reaches here without throwing.
    return [];
  }


  const pageTexts: PageText[] = [];

  for (const pageNum of pagesToProcess) {
    if (pageNum < 1 || pageNum > maxPage) {
        console.warn(`Skipping page ${pageNum} as it's out of document range (1-${maxPage}).`);
        continue;
    }
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      // Filter out empty strings from textContent items before joining
      const pageText = textContent.items
        .map(item => ('str' in item ? item.str : ''))
        .filter(s => s.trim() !== '') // Filter out items that are just whitespace
        .join(' ');
      
      // Only add page if text was actually extracted
      if (pageText.trim()) {
         pageTexts.push({ pageNumber: pageNum, text: pageText });
      } else {
         pageTexts.push({ pageNumber: pageNum, text: ""}); // Push empty text if page had no extractable text.
         console.warn(`No text content extracted from page ${pageNum}. It might be an image-only page or scanned.`);
      }

    } catch (error) {
      console.warn(`Could not process page ${pageNum}:`, error);
      pageTexts.push({ pageNumber: pageNum, text: `Error extracting text from page ${pageNum}.` });
    }
  }

  return pageTexts;
};
