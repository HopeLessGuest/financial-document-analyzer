
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

export interface ExtractedChartItem {
  id: string; // unique id for key
  pageNumber: number;
  title: string;
  file: string; // source file name
}

export interface PageText {
  pageNumber: number;
  text: string;
}

export interface ChatMessage {
  id:string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
}

export type DataType = 'numerical' | 'chart';

export interface QuerySource {
  id: string;
  name: string;
  data: ExtractedDataItem[] | ExtractedChartItem[];
  type: 'pdf' | 'json';
  dataType: DataType;
}