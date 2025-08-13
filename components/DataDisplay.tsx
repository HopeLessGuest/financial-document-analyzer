
import React, { useState } from 'react';
import { ExtractedDataItem } from '../types';
import { ChevronDown, ChevronUp, FileJson, Maximize2 } from 'lucide-react'; // Using lucide-react for icons

interface DataDisplayProps {
  data: ExtractedDataItem[];
}

const DataItemCard: React.FC<{ item: ExtractedDataItem; onShowSource: (source: string) => void }> = ({ item, onShowSource }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-4 transition-all hover:shadow-blue-500/10 hover:border-blue-400">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-blue-600">{item.name}</h3>
          {item.subcategory && <p className="text-xs text-slate-500 italic">{item.subcategory}</p>}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-500 hover:text-blue-600 transition-colors"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>
      
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
        <div className="text-slate-600"><strong className="font-medium text-slate-800">Value:</strong> {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</div>
        <div className="text-slate-600"><strong className="font-medium text-slate-800">Unit:</strong> {item.unit}</div>
        <div className="text-slate-600"><strong className="font-medium text-slate-800">Year:</strong> {item.year}</div>
        <div className="text-slate-600"><strong className="font-medium text-slate-800">Period:</strong> {item.period}</div>
        <div className="text-slate-600"><strong className="font-medium text-slate-800">Page:</strong> {item.page}</div>

        {item.bankName && (
          <div className="text-slate-600"><strong className="font-medium text-slate-800">Bank:</strong> {item.bankName}</div>
        )}
        {item.documentType && (
          <div className="text-slate-600"><strong className="font-medium text-slate-800">Doc Type:</strong> {item.documentType}</div>
        )}
        
        <div className="text-slate-600 sm:col-span-2 md:col-span-3"><strong className="font-medium text-slate-800">File:</strong> <span className="truncate">{item.file}</span></div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-500 mb-1 font-medium">Source Text:</p>
          <p className="text-xs text-slate-700 bg-slate-100 p-2 rounded max-h-24 overflow-y-auto font-mono">
            {item.source}
          </p>
          <button 
            onClick={() => onShowSource(item.source)}
            className="mt-2 text-xs text-blue-500 hover:text-blue-700 flex items-center space-x-1"
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <h4 className="text-lg font-semibold text-blue-600 mb-3">Full Source Text</h4>
        <div className="overflow-y-auto flex-grow bg-slate-100 p-3 rounded font-mono text-sm text-slate-700 border border-slate-200">
          {source}
        </div>
        <button
          onClick={onClose}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
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
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-lg shadow-md transition-colors flex items-center space-x-2"
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