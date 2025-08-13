
import React, { useRef } from 'react';
import { UploadCloud, FileJson } from 'lucide-react';

interface JsonUploadProps {
  onJsonFileChange: (file: File | null) => void;
  currentJsonFileName: string | null;
}

export const JsonUpload: React.FC<JsonUploadProps> = ({ onJsonFileChange, currentJsonFileName }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    onJsonFileChange(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0] || null;
    if (file && file.type === "application/json") {
        onJsonFileChange(file);
    } else if (file) {
        // Optionally, handle wrong file type error here or let parent handle
        alert("Invalid file type. Please upload a .json file.");
        onJsonFileChange(null); 
    } else {
        onJsonFileChange(null);
    }
  };


  return (
    <div 
        className="w-full p-5 border-2 border-dashed border-slate-500 hover:border-sky-400 transition-colors duration-300 rounded-lg text-center cursor-pointer bg-slate-600/40" 
        // onClick={() => fileInputRef.current?.click()} // REMOVED THIS LINE
        onDragOver={handleDragOver}
        onDrop={handleDrop}
    >
      <input
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        className="hidden"
        ref={fileInputRef}
        id="json-file-upload" // Keep ID for the label
      />
      {/* The label will trigger the input when clicked due to htmlFor */}
      <label htmlFor="json-file-upload" className="cursor-pointer flex flex-col items-center justify-center space-y-2 w-full h-full">
        <UploadCloud size={36} className="text-sky-400" />
        {currentJsonFileName ? (
          <div className="flex items-center space-x-2 text-slate-300 text-sm">
            <FileJson size={18} className="text-green-400" />
            <span className="font-medium">{currentJsonFileName}</span>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">
            Click to browse or drag & drop a JSON file here.
          </p>
        )}
        <span className="text-xs text-slate-500">Must be a .json file</span>
      </label>
    </div>
  );
};
