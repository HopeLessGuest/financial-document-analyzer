
export interface ExtractedDataItem {
  name: string;
  subcategory?: string;
  value: number | string; // Allow string initially, as AI might return it, then parse
  unit: string;
  period: string; // To capture specific dates like '30 Jun 2024'. Can be 'N/A'.
  year: number; // The financial year (e.g. 2024). This is mandatory.
  page: number;
  source: string;
  file: string;
  bankName?: string;
  documentType?: string;
}

export interface PageText {
  pageNumber: number;
  text: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
}

export interface QuerySource {
  id: string; // Added for unique identification
  name: string;
  data: ExtractedDataItem[];
  type: 'pdf' | 'json';
}