
import React from 'react';

interface PageRangeInputProps {
  pageRange: string;
  onPageRangeChange: (value: string) => void;
}

export const PageRangeInput: React.FC<PageRangeInputProps> = ({
  pageRange,
  onPageRangeChange,
}) => {
  return (
    <div>
      <label htmlFor="pageRange" className="block text-sm font-medium text-slate-600 mb-1">
        Page Range (e.g., "1, 3, 5-8", optional)
      </label>
      <input
        type="text"
        id="pageRange"
        value={pageRange}
        onChange={(e) => onPageRangeChange(e.target.value)}
        placeholder="e.g., 1,3,5-8 or leave blank for all pages"
        className="w-full bg-white border border-slate-300 text-slate-800 placeholder-slate-400 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
        aria-describedby="pageRangeHelp"
      />
      <p id="pageRangeHelp" className="mt-1 text-xs text-slate-500">
        Enter specific pages or ranges (e.g., "2-5, 8, 11-13"). If left blank, all pages will be processed.
      </p>
    </div>
  );
};