
import React, { useRef } from 'react';
import { UploadCloud, FileText } from 'lucide-react'; // Using lucide-react for icons

interface FileUploadProps {
  onFileChange: (file: File | null) => void;
  currentFileName: string | null;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileChange, currentFileName }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    onFileChange(file);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full p-6 border-2 border-dashed border-slate-300 hover:border-blue-500 transition-colors duration-300 rounded-lg text-center cursor-pointer bg-slate-50" onClick={handleButtonClick}>
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        className="hidden"
        ref={fileInputRef}
      />
      <div className="flex flex-col items-center justify-center space-y-3">
        <UploadCloud size={48} className="text-blue-500" />
        {currentFileName ? (
          <div className="flex items-center space-x-2 text-slate-700">
            <FileText size={20} className="text-emerald-500" />
            <span className="font-medium">{currentFileName}</span>
          </div>
        ) : (
          <p className="text-slate-500">
            Click to browse or drag & drop a PDF file here.
          </p>
        )}
        <span className="text-xs text-slate-500">Max file size: 50MB (Recommended)</span>
      </div>
    </div>
  );
};