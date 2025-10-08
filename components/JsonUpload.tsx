import React, { useRef, useState } from 'react';
import { UploadCloud, FileJson } from 'lucide-react';

interface JsonUploadProps {
  onJsonFileChange: (file: File | null) => void;
  currentJsonFileName: string | null;
}

export const JsonUpload: React.FC<JsonUploadProps> = ({ onJsonFileChange, currentJsonFileName }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file && file.type !== 'application/json') {
        alert("Invalid file type. Please upload a .json file.");
        onJsonFileChange(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        return;
    }
    onJsonFileChange(file);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

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
    if (file && file.type !== "application/json") {
        alert("Invalid file type. Please upload a .json file.");
        onJsonFileChange(null); 
    } else {
        onJsonFileChange(file);
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
        accept=".json"
        onChange={handleFileSelect}
        className="hidden"
        ref={fileInputRef}
      />
      <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
        <UploadCloud size={48} className="text-blue-500" />
        {currentJsonFileName ? (
          <div className="flex items-center space-x-2 text-slate-700">
            <FileJson size={20} className="text-emerald-500" />
            <span className="font-medium">{currentJsonFileName}</span>
          </div>
        ) : (
          <p className="text-slate-500">
            {isDragging ? 'Drop the JSON file here' : 'Click to browse or drag & drop a JSON file here.'}
          </p>
        )}
        <span className="text-xs text-slate-500">Must be a .json file</span>
      </div>
    </div>
  );
};