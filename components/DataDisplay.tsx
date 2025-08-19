import React, { useState } from 'react';
import JSZip from 'jszip';
import { ExtractedDataItem, ExtractedChartItem, QuerySource } from '../types';
import { ChevronDown, ChevronUp, FileJson, Maximize2, Download, Info, Archive, ImageIcon } from 'lucide-react';
import { Spinner } from './Spinner';

interface DataDisplayProps {
  dataSource: QuerySource;
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

const ChartItemCard: React.FC<{ item: ExtractedChartItem }> = ({ item }) => {
  const handleDownload = () => {
    if (!item.imageDataUrl) return;
    const link = document.createElement('a');
    link.href = item.imageDataUrl;
    // Sanitize title for filename
    const sanitizedTitle = item.title.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 50);
    link.download = `${item.file.replace(/\.pdf$/i, '')}_p${item.pageNumber}_${sanitizedTitle}.jpeg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-4 transition-all hover:shadow-blue-500/10 hover:border-blue-400 flex flex-col">
      <h3 className="text-base font-semibold text-blue-600 truncate mb-2" title={item.title}>{item.title}</h3>
      <div className="flex-grow bg-slate-100 rounded flex items-center justify-center p-2 mb-3 min-h-48">
        {item.imageDataUrl ? (
          <img src={item.imageDataUrl} alt={item.title} className="max-w-full max-h-60 object-contain"/>
        ) : (
          <div className="text-center text-slate-500 p-4 flex flex-col items-center justify-center">
            <ImageIcon size={32} className="mx-auto mb-2 opacity-50"/>
            <p className="text-xs font-semibold">Image data not available</p>
            <p className="text-xs mt-1 italic">This is chart metadata, likely from an imported JSON file.</p>
          </div>
        )}
      </div>
      <div className="flex justify-between items-center text-xs text-slate-500">
        <span>Page: {item.pageNumber}</span>
        <button
          onClick={handleDownload}
          disabled={!item.imageDataUrl}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-1 px-3 rounded-md shadow transition-colors text-xs flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={14} />
          <span>Download</span>
        </button>
      </div>
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

export const DataDisplay: React.FC<DataDisplayProps> = ({ dataSource }) => {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  if (dataSource.dataType === 'chart') {
    const chartData = dataSource.data as ExtractedChartItem[];

    const downloadChartJson = () => {
      const metadata = chartData.map(({ imageDataUrl, ...rest }) => rest);
      const exportData = {
        name: dataSource.name,
        dataType: 'chart',
        data: metadata,
      };
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportData, null, 2))}`;
      const link = document.createElement('a');
      link.href = jsonString;
      const fileName = dataSource.name.replace(/\s*\(Charts\)$/i, '').replace(/\.pdf$/i, '');
      link.download = `${fileName}_charts_metadata.json`;
      link.click();
    };

    const downloadAllChartsAsZip = async () => {
      if (isZipping) return;
      const chartsWithImages = chartData.filter(item => item.imageDataUrl);
      if (chartsWithImages.length === 0) {
        alert("There are no images to download for this data source.");
        return;
      }

      setIsZipping(true);
      
      const zip = new JSZip();
      const folderName = dataSource.name.replace(/\s*\(Charts\)$/i, '').replace(/\.pdf$/i, '');
      const chartFolder = zip.folder(folderName);

      if (chartFolder) {
        for (const item of chartsWithImages) {
          if (item.imageDataUrl) {
            const base64Data = item.imageDataUrl.split(',')[1];
            const sanitizedTitle = item.title.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 50) || 'chart';
            const fileName = `p${item.pageNumber}_${sanitizedTitle}.jpeg`;
            chartFolder.file(fileName, base64Data, { base64: true });
          }
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${folderName}_charts.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      setIsZipping(false);
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-start space-x-3 flex-grow">
              <Info size={18} className="flex-shrink-0 mt-0.5"/>
              <span>Displaying {chartData.length} extracted charts. Use the download buttons to save the images or metadata.</span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={downloadChartJson}
                  className="bg-sky-500 hover:bg-sky-600 text-white font-medium py-2 px-4 rounded-lg shadow-md transition-colors flex items-center space-x-2"
                  title="Download chart metadata as JSON"
              >
                  <FileJson size={18} />
                  <span>JSON</span>
              </button>
              <button
                  onClick={downloadAllChartsAsZip}
                  disabled={isZipping || chartData.every(c => !c.imageDataUrl)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-lg shadow-md transition-colors flex items-center space-x-2 disabled:opacity-60 disabled:cursor-wait"
                  title="Download all charts as a ZIP file"
              >
                  {isZipping ? <Spinner size="small" color="text-white"/> : <Archive size={18} />}
                  <span>Download All (ZIP)</span>
              </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chartData.map((item) => (
            <ChartItemCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    );
  }

  // Default to numerical data display
  const data = dataSource.data as ExtractedDataItem[];

  const downloadJson = () => {
    const exportData = {
      name: dataSource.name,
      dataType: 'numerical',
      data: data,
    };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportData, null, 2))}`;
    const link = document.createElement('a');
    link.href = jsonString;

    let intelligentFilenamePrefix = dataSource.name.replace(/\.(pdf|json)$/i, '') || 'extracted_data';
    intelligentFilenamePrefix = intelligentFilenamePrefix.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);

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