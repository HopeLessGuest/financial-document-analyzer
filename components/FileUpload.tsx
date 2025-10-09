import React, { useRef, useState } from 'react';
import { UploadCloud, FileText } from 'lucide-react'; // Using lucide-react for icons

interface FileUploadProps {
  onFileChange: (file: File | null) => void;
  currentFileName: string | null;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileChange, currentFileName }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file && file.type !== 'application/pdf') {
        alert("Invalid file type. Please upload a PDF file.");
        onFileChange(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        return;
    }
    onFileChange(file);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  // --- Drag and Drop Handlers ---
  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current++;
    if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); // Necessary to allow dropping
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const file = event.dataTransfer.files?.[0] || null;
    if (file && file.type !== 'application/pdf') {
      alert('Invalid file type. Please upload a PDF file.');
      onFileChange(null);
    } else {
      onFileChange(file);
    }
  };

  const baseClasses = "w-full p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all duration-300";
  const stateClasses = isDragging
    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500"
    : "border-slate-300 hover:border-blue-500 bg-slate-50";

  return (
    <div
      className={`${baseClasses} ${stateClasses}`}
      onClick={handleButtonClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        className="hidden"
        ref={fileInputRef}
      />
      <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
        <UploadCloud size={48} className="text-blue-500" />
        {currentFileName ? (
          <div className="flex items-center space-x-2 text-slate-700">
            <FileText size={20} className="text-emerald-500" />
            <span className="font-medium">{currentFileName}</span>
          </div>
        ) : (
          <p className="text-slate-500">
            {isDragging ? 'Drop the PDF file here' : 'Click to browse or drag & drop a PDF file here.'}
          </p>
        )}
        <span className="text-xs text-slate-500">Max file size: 50MB (Recommended)</span>
      </div>
    </div>
  );
};