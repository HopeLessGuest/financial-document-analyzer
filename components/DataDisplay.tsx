
import React, { useState } from 'react';
import { ExtractedDataItem } from '../types';
import { ChevronDown, ChevronUp, FileJson, Maximize2 } from 'lucide-react'; // Using lucide-react for icons

interface DataDisplayProps {
  data: ExtractedDataItem[];
}

const DataItemCard: React.FC<{ item: ExtractedDataItem; onShowSource: (source: string) => void }> = ({ item, onShowSource }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-slate-700/70 shadow-lg rounded-lg p-4 transition-all hover:shadow-sky-500/20 hover:ring-1 hover:ring-sky-600">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-sky-400">{item.name}</h3>
          {item.subcategory && <p className="text-xs text-slate-400 italic">{item.subcategory}</p>}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-sky-400 transition-colors"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>
      
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
        <div className="text-slate-300"><strong className="font-medium text-slate-100">Value:</strong> {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</div>
        <div className="text-slate-300"><strong className="font-medium text-slate-100">Unit:</strong> {item.unit}</div>
        <div className="text-slate-300"><strong className="font-medium text-slate-100">Year:</strong> {item.year}</div>
        <div className="text-slate-300"><strong className="font-medium text-slate-100">Period:</strong> {item.period}</div>
        <div className="text-slate-300"><strong className="font-medium text-slate-100">Page:</strong> {item.page}</div>

        {item.bankName && (
          <div className="text-slate-300"><strong className="font-medium text-slate-100">Bank:</strong> {item.bankName}</div>
        )}
        {item.documentType && (
          <div className="text-slate-300"><strong className="font-medium text-slate-100">Doc Type:</strong> {item.documentType}</div>
        )}
        
        <div className="text-slate-300 sm:col-span-2 md:col-span-3"><strong className="font-medium text-slate-100">File:</strong> <span className="truncate">{item.file}</span></div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-600">
          <p className="text-xs text-slate-400 mb-1 font-medium">Source Text:</p>
          <p className="text-xs text-slate-300 bg-slate-600/50 p-2 rounded max-h-24 overflow-y-auto font-mono">
            {item.source}
          </p>
          <button 
            onClick={() => onShowSource(item.source)}
            className="mt-2 text-xs text-sky-400 hover:text-sky-300 flex items-center space-x-1"
          >
            <Maximize2 size={12} />
            <span>View Full Source</span>
          </button>
        </div>
      )}
    </div>
  );
};

const SourceModal: React.FC<{ source: string; onClose: () => void }> = ({ source, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <h4 className="text-lg font-semibold text-sky-400 mb-3">Full Source Text</h4>
        <div className="overflow-y-auto flex-grow bg-slate-700 p-3 rounded font-mono text-sm text-slate-200">
          {source}
        </div>
        <button
          onClick={onClose}
          className="mt-4 bg-sky-500 hover:bg-sky-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export const DataDisplay: React.FC<DataDisplayProps> = ({ data }) => {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const downloadJson = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
    const link = document.createElement('a');
    link.href = jsonString;
    // Attempt to use bankName or documentType in the filename if available and item.file is generic
    let intelligentFilenamePrefix = data[0]?.file.replace(/\.(pdf|json)$/i, '') || 'extracted_data';
    if (data.length > 0) {
        const firstItem = data[0];
        if (firstItem.bankName && (intelligentFilenamePrefix === 'extracted_data' || !intelligentFilenamePrefix.toLowerCase().includes(firstItem.bankName.toLowerCase().substring(0,5)) ) ) {
            intelligentFilenamePrefix = `${firstItem.bankName}_${intelligentFilenamePrefix}`;
        }
        if (firstItem.documentType && (intelligentFilenamePrefix === 'extracted_data' || !intelligentFilenamePrefix.toLowerCase().includes(firstItem.documentType.toLowerCase().replace(/\s+/g, '_').substring(0,10)) ) ) {
            intelligentFilenamePrefix = `${intelligentFilenamePrefix}_${firstItem.documentType.replace(/\s+/g, '_')}`;
        }
        intelligentFilenamePrefix = intelligentFilenamePrefix.replace(/_{2,}/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50); // Sanitize and shorten
    }

    link.download = `${intelligentFilenamePrefix}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
            onClick={downloadJson}
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg shadow-md transition-colors flex items-center space-x-2"
        >
            <FileJson size={18} />
            <span>Download JSON</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((item, index) => (
          <DataItemCard key={index} item={item} onShowSource={setSelectedSource} />
        ))}
      </div>
      {selectedSource && <SourceModal source={selectedSource} onClose={() => setSelectedSource(null)} />}
    </div>
  );
};