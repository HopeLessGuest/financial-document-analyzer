
import React, { useState, useCallback, useEffect } from 'react';
import { ExtractedDataItem, PageText, ChatMessage, QuerySource } from './types';
import { FileUpload } from './components/FileUpload';
import { JsonUpload } from './components/JsonUpload';
import { PageRangeInput } from './components/PageRangeInput';
import { DataDisplay } from './components/DataDisplay';
import { Spinner } from './components/Spinner';
import { extractTextFromPdf } from './services/pdfParser';
import { analyzeDocument, queryExtractedData } from './services/geminiService';
import { ChatInterface } from './components/ChatInterface';
import { AlertTriangle, KeyRound, Info, MessageSquare, FileText, UploadCloud, Table2, Database, Trash2, ChevronDown, ListChecks } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// PDF.js worker configuration
import * as pdfjsLib from 'pdfjs-dist';
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.min.js`;
}

type ActiveTab = 'analyze' | 'aiChat' | 'viewData';

const App: React.FC = () => {
  // --- State Management ---

  // API Key State (replaces process.env)
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  
  // Common state
  const [activeTab, setActiveTab] = useState<ActiveTab>('analyze');

  // PDF Analysis Input State
  const [pdfFileToAnalyze, setPdfFileToAnalyze] = useState<File | null>(null);
  const [pdfFileNameToAnalyze, setPdfFileNameToAnalyze] = useState<string>('');
  const [pageRange, setPageRange] = useState<string>('');
  const [pdfProcessingLoading, setPdfProcessingLoading] = useState<boolean>(false);
  const [pdfProcessingError, setPdfProcessingError] = useState<string | null>(null);
  const [pdfProcessingInfoMessage, setPdfProcessingInfoMessage] = useState<string | null>(null);

  // JSON Upload Input State (primarily for View Data tab)
  const [jsonFileToUpload, setJsonFileToUpload] = useState<File | null>(null); 
  const [jsonFileNameToUpload, setJsonFileNameToUpload] = useState<string>('');
  const [jsonProcessingLoading, setJsonProcessingLoading] = useState<boolean>(false);
  const [jsonProcessingError, setJsonProcessingError] = useState<string | null>(null);
  const [jsonProcessingInfoMessage, setJsonProcessingInfoMessage] = useState<string | null>(null);
  
  // Data Sources State
  const [dataSources, setDataSources] = useState<QuerySource[]>([]);
  const [activeDataSourceId, setActiveDataSourceId] = useState<string | null>(null);

  // Derived state for current display and query
  const [currentDisplayData, setCurrentDisplayData] = useState<ExtractedDataItem[] | null>(null);
  const [currentDisplayDataSourceName, setCurrentDisplayDataSourceName] = useState<string | null>(null);
  const [currentQuerySource, setCurrentQuerySource] = useState<QuerySource | null>(null);


  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // --- Handlers & Effects ---

  const handleApiKeyChange = (newKey: string) => {
    setApiKey(newKey);
    localStorage.setItem('gemini_api_key', newKey);
  };

  const resetPdfInputState = () => {
    setPdfFileToAnalyze(null);
    setPdfFileNameToAnalyze('');
    setPdfProcessingError(null);
    setPdfProcessingInfoMessage(null);
  };

  const resetJsonInputState = () => {
    setJsonFileToUpload(null);
    setJsonProcessingError(null);
    setJsonProcessingInfoMessage(null);
  };
  
  useEffect(() => {
    if (activeDataSourceId && dataSources.length > 0) {
      const activeSource = dataSources.find(src => src.id === activeDataSourceId);
      if (activeSource) {
        setCurrentDisplayData(activeSource.data);
        setCurrentDisplayDataSourceName(activeSource.name);
        setCurrentQuerySource(activeSource); 
      } else {
        const newActiveId = dataSources.length > 0 ? dataSources[dataSources.length - 1].id : null;
        setActiveDataSourceId(newActiveId);
      }
    } else if (dataSources.length > 0 && !activeDataSourceId) {
      setActiveDataSourceId(dataSources[dataSources.length - 1].id);
    } else { 
      setCurrentDisplayData(null);
      setCurrentDisplayDataSourceName(null);
      setCurrentQuerySource(null);
    }
  }, [activeDataSourceId, dataSources]);


  const handlePdfFileSelected = (file: File | null) => {
    resetPdfInputState();
    setPdfFileToAnalyze(file);
    setPdfFileNameToAnalyze(file ? file.name : '');
  };

  const handleJsonFileSelectedForUpload = async (file: File | null) => {
    resetJsonInputState(); 
    setJsonFileToUpload(file); 
    setJsonFileNameToUpload(file ? file.name : ''); 

    if (file) {
      setJsonProcessingLoading(true);
      setJsonProcessingError(null);
      setJsonProcessingInfoMessage(`Processing JSON file: ${file.name}...`);
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'object' && item !== null)) {
          const newSource: QuerySource = {
            id: uuidv4(),
            name: file.name,
            data: parsed as ExtractedDataItem[],
            type: 'json',
          };
          setDataSources(prev => [...prev, newSource]);
          setActiveDataSourceId(newSource.id);
          
          let infoMsg = `Successfully loaded ${newSource.data.length} items from ${file.name}.`;
          if (newSource.data.length > 0) {
             const firstItem = newSource.data[0];
             const expectedKeys = ['name', 'value', 'period', 'year'];
             const hasSomeExpectedKeys = expectedKeys.some(key => key in firstItem);
             if(!hasSomeExpectedKeys) {
                 infoMsg += " Warning: JSON structure might not be optimal. Ensure items have 'name', 'value', 'period', 'year', etc.";
             }
          }
          setJsonProcessingInfoMessage(infoMsg);
          setJsonFileNameToUpload(file.name); 
          setActiveTab('viewData'); 
        } else {
          throw new Error('Invalid JSON format. Expected an array of objects.');
        }
      } catch (err) {
        console.error('JSON processing error:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setJsonProcessingError(`Error processing JSON file: ${errorMessage}`);
        setJsonProcessingInfoMessage(null);
      } finally {
        setJsonProcessingLoading(false);
        setJsonFileToUpload(null); 
      }
    } else {
      setJsonFileNameToUpload(''); 
    }
  };

  const handlePdfSubmit = useCallback(async () => {
    if (!pdfFileToAnalyze) {
      setPdfProcessingError('Please upload a PDF file.');
      return;
    }

    if (!apiKey) {
        setPdfProcessingError('Please enter your Gemini API Key in the configuration section above.');
        setPdfProcessingInfoMessage(null); 
        return;
    }
    
    setPdfProcessingLoading(true);
    setPdfProcessingError(null);
    setPdfProcessingInfoMessage('Processing PDF... this may take a few moments.');

    try {
      const pageTexts: PageText[] = await extractTextFromPdf(pdfFileToAnalyze, pageRange);

      if (pageTexts.length === 0) {
        setPdfProcessingError('Could not extract text from the specified page range or PDF. Please check the page range format (e.g., "1,3,5-7") or the document content.');
        setPdfProcessingInfoMessage(null);
        setPdfProcessingLoading(false);
        return;
      }
      
      setPdfProcessingInfoMessage(`Text extracted from ${pageTexts.length} page(s). Analyzing with AI...`);

      const data = await analyzeDocument(pageTexts, pdfFileNameToAnalyze, apiKey);
      
      const processedData = data.map(item => ({
        ...item,
        value: typeof item.value === 'string' ? parseFloat(item.value.replace(/[^0-9.-]/g, '')) : item.value,
      }));
      
      const newSource: QuerySource = {
        id: uuidv4(),
        name: pdfFileNameToAnalyze,
        data: processedData,
        type: 'pdf',
      };
      setDataSources(prev => [...prev, newSource]);
      setActiveDataSourceId(newSource.id);

      if (processedData.length > 0) {
        setPdfProcessingInfoMessage(`Successfully extracted ${processedData.length} data items. '${pdfFileNameToAnalyze}' is now available as a data source.`);
      } else {
        setPdfProcessingInfoMessage(`Analysis of '${pdfFileNameToAnalyze}' complete. No specific data items were extracted, but it's available as a data source.`);
      }
      resetPdfInputState(); 
      setPageRange(''); 
      setActiveTab('viewData');
      
    } catch (err) {
      console.error('Analysis error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('API Key')) {
         setPdfProcessingError(errorMessage);
      } else {
         setPdfProcessingError(`An error occurred during document analysis: ${errorMessage}.`);
      }
      setPdfProcessingInfoMessage(null);
    } finally {
      setPdfProcessingLoading(false);
    }
  }, [pdfFileToAnalyze, pdfFileNameToAnalyze, pageRange, apiKey]);


  const handleSendChatMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || dataSources.length === 0) {
        if (dataSources.length === 0) {
            setChatError("Cannot send message: No data sources are available.");
        }
        return;
    }
    // Check if all available data sources are empty
    const allSourcesEmpty = dataSources.every(ds => ds.data.length === 0);
    if (allSourcesEmpty) {
        setChatError("Cannot send message: All available data sources are empty.");
        return;
    }

    const newUserMessage: ChatMessage = {
      id: uuidv4(),
      sender: 'user',
      text: messageText,
      timestamp: Date.now(),
    };
    
    const updatedChatMessages = [...chatMessages, newUserMessage];
    setChatMessages(updatedChatMessages);
    setIsChatLoading(true);
    setChatError(null);

    try {
      const aiResponseText = await queryExtractedData(messageText, dataSources, updatedChatMessages, apiKey);
      const newAiMessage: ChatMessage = {
        id: uuidv4(),
        sender: 'ai',
        text: aiResponseText,
        timestamp: Date.now(),
      };
      setChatMessages(prev => [...prev, newAiMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      const chatErrorMessage = err instanceof Error ? err.message : String(err);
      setChatError(`Chat error: ${chatErrorMessage}`);
      const errorAiMessage: ChatMessage = {
        id: uuidv4(),
        sender: 'ai',
        text: `Sorry, I encountered an error trying to respond: ${chatErrorMessage}`,
        timestamp: Date.now(),
      };
      setChatMessages(prev => [...prev, errorAiMessage]);
    } finally {
      setIsChatLoading(false);
    }
  }, [dataSources, chatMessages, apiKey]); 

  const handleRemoveActiveDataSource = () => {
    if (!activeDataSourceId) return;
    const sourceToRemove = dataSources.find(s => s.id === activeDataSourceId);
    if (!sourceToRemove) return;

    setDataSources(prev => prev.filter(src => src.id !== activeDataSourceId));
    
    const remainingSources = dataSources.filter(src => src.id !== activeDataSourceId);
    if (remainingSources.length > 0) {
      setActiveDataSourceId(remainingSources[remainingSources.length - 1].id);
    } else {
      setActiveDataSourceId(null); 
    }
  };
  
  const getChatContextInfo = (): string => {
    if (dataSources.length === 0) {
      return "No data sources available for chat.";
    }
    if (dataSources.length === 1) {
      return `Querying data from: ${dataSources[0].name}`;
    }
    return `Querying data from all ${dataSources.length} available sources.`;
  };


  const TabButton: React.FC<{tabId: ActiveTab; currentTab: ActiveTab; onClick: (tabId: ActiveTab) => void; children: React.ReactNode;}> = 
    ({ tabId, currentTab, onClick, children }) => (
    <button
      role="tab"
      aria-selected={currentTab === tabId}
      onClick={() => onClick(tabId)}
      className={`py-3 px-6 font-medium text-sm transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-t-lg
        ${currentTab === tabId 
          ? 'text-blue-600 border-b-2 border-blue-600' 
          : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
        }`}
    >
      {children}
    </button>
  );

  return (
    <div className="min-h-screen bg-white text-slate-800 p-4 sm:p-8 flex flex-col items-center">
      <header className="w-full max-w-4xl mb-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-blue-600">
          Financial Document Analyzer
        </h1>
        <p className="mt-3 text-slate-600 text-lg">
          Extract, view, and query structured data from PDFs or your JSON files using AI.
        </p>
      </header>

      <div className="w-full max-w-4xl mb-6">
        <div className="bg-slate-50 border border-slate-200 shadow-sm rounded-xl p-4 sm:p-6">
          <label htmlFor="api-key-input" className="block text-lg font-semibold text-slate-700 mb-2 flex items-center">
            <KeyRound size={20} className="mr-2 text-blue-500" />
            Gemini API Key Configuration
          </label>
          <div className="flex items-center gap-2">
            <input
              id="api-key-input"
              type="password"
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="Enter your Gemini API Key here"
              className="flex-grow bg-white border border-slate-300 text-slate-800 placeholder-slate-400 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
              aria-describedby="api-key-help"
            />
          </div>
          <p id="api-key-help" className="mt-2 text-xs text-slate-500">
            Required for all AI features. Your key is stored in your browser's local storage and is not sent to any server except Google's.
          </p>
        </div>
      </div>

      <div className="w-full max-w-4xl">
        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mb-px">
          <TabButton tabId="analyze" currentTab={activeTab} onClick={setActiveTab}>
            <FileText size={18} className="inline mr-2" /> Analyze Document
          </TabButton>
           <TabButton tabId="viewData" currentTab={activeTab} onClick={setActiveTab}>
            <Table2 size={18} className="inline mr-2" /> View Data
          </TabButton>
          <TabButton tabId="aiChat" currentTab={activeTab} onClick={setActiveTab}>
            <MessageSquare size={18} className="inline mr-2" /> AI Chat
          </TabButton>
        </div>

        <main className="w-full bg-white shadow-lg border border-slate-200 rounded-b-xl p-6 sm:p-8">
          {/* Analyze Document Tab Content */}
          {activeTab === 'analyze' && (
            <section aria-labelledby="analysis-section-title">
              <h2 id="analysis-section-title" className="text-2xl font-semibold text-slate-800 mb-6">
                Analyze PDF Document
              </h2>
              <div className="space-y-6">
                <FileUpload onFileChange={handlePdfFileSelected} currentFileName={pdfFileNameToAnalyze} />
                <PageRangeInput pageRange={pageRange} onPageRangeChange={setPageRange} />
                <button
                  onClick={handlePdfSubmit}
                  disabled={pdfProcessingLoading || !pdfFileToAnalyze}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  aria-live="polite"
                >
                  {pdfProcessingLoading ? <Spinner /> : <span>Analyze Document</span>}
                </button>
              </div>

              {pdfProcessingInfoMessage && !pdfProcessingError && (
                <div role="status" className="mt-6 p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg flex items-center space-x-3">
                  <Info size={20} />
                  <span>{pdfProcessingInfoMessage}</span>
                </div>
              )}
              {pdfProcessingError && (
                <div role="alert" className="mt-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center space-x-3">
                  <AlertTriangle size={20} />
                  <span>{pdfProcessingError}</span>
                </div>
              )}
              {pdfProcessingLoading && (
                 <div role="status" className="mt-8 text-center">
                   <Spinner size="large"/>
                   <p className="text-slate-500 mt-2">{pdfProcessingInfoMessage || 'Processing...'}</p>
                 </div>
              )}
              {pdfFileToAnalyze && !pdfProcessingLoading && !pdfProcessingError && !pdfProcessingInfoMessage && ( 
                  <div className="mt-8 text-center p-6 bg-blue-50/70 rounded-lg">
                    <Info size={32} className="mx-auto text-blue-500 mb-3" />
                    <p className="text-slate-700 text-lg">Document '{pdfFileNameToAnalyze}' ready. Click "Analyze Document" to extract data.</p>
                  </div>
               )}
            </section>
          )}

          {/* View Data Tab Content */}
          {activeTab === 'viewData' && (
             <section aria-labelledby="view-data-section-title">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h2 id="view-data-section-title" className="text-2xl font-semibold text-slate-800">
                            View & Manage Data Sources
                        </h2>
                        {currentDisplayDataSourceName && (
                             <p className="text-sm text-slate-500">
                                Active source for viewing: <span className="font-medium text-blue-600">{currentDisplayDataSourceName}</span>
                            </p>
                        )}
                    </div>
                    {dataSources.length > 0 && (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-grow sm:flex-grow-0">
                                <select
                                    value={activeDataSourceId || ''}
                                    onChange={(e) => setActiveDataSourceId(e.target.value)}
                                    className="w-full appearance-none bg-white border border-slate-300 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 pr-8"
                                    aria-label="Select data source to view"
                                >
                                    {dataSources.map(src => (
                                    <option key={src.id} value={src.id}>
                                        {src.name} ({src.type}, {src.data.length} items)
                                    </option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/>
                            </div>
                            <button
                                onClick={handleRemoveActiveDataSource}
                                disabled={!activeDataSourceId}
                                className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Remove Selected Data Source"
                                aria-label="Remove selected data source"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    )}
                </div>

                <div className="mb-8 p-6 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="text-lg font-semibold text-blue-600 mb-3 flex items-center">
                        <UploadCloud size={20} className="mr-2"/> Upload JSON File
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">
                        Upload your own JSON file (array of data items). It will be added as a new data source.
                    </p>
                    <JsonUpload onJsonFileChange={handleJsonFileSelectedForUpload} currentJsonFileName={jsonFileNameToUpload} />
                    {jsonProcessingLoading && (
                        <div role="status" className="mt-4 text-center">
                            <Spinner size="medium"/>
                            <p className="text-slate-500 mt-1 text-sm">{jsonProcessingInfoMessage || 'Processing JSON...'}</p>
                        </div>
                    )}
                    {jsonProcessingInfoMessage && !jsonProcessingError && !jsonProcessingLoading && ( 
                        <div role="status" className={`mt-4 p-3 rounded-md text-sm flex items-center space-x-2 ${jsonProcessingInfoMessage.toLowerCase().includes('warning') ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-blue-50 border border-blue-200 text-blue-800'}`}>
                            <Info size={18} />
                            <span>{jsonProcessingInfoMessage}</span>
                        </div>
                    )}
                    {jsonProcessingError && (
                        <div role="alert" className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm flex items-center space-x-2">
                            <AlertTriangle size={18} />
                            <span>{jsonProcessingError}</span>
                        </div>
                    )}
                </div>
                
                {currentDisplayData && currentDisplayData.length > 0 ? (
                    <DataDisplay data={currentDisplayData} />
                ) : dataSources.length > 0 && (!currentDisplayData || currentDisplayData.length === 0) && currentDisplayDataSourceName ? (
                     <div className="text-center p-8 bg-slate-50 rounded-lg border border-slate-200">
                        <Database size={40} className="mx-auto text-blue-500 mb-4" />
                        <p className="text-slate-700 text-lg">The selected data source '{currentDisplayDataSourceName}' is empty or contains no displayable items.</p>
                        <p className="text-slate-500">
                            Try selecting another source or analyzing/uploading a new one.
                        </p>
                    </div>
                ) : (
                    <div className="text-center p-8 bg-slate-50 rounded-lg border border-slate-200">
                        <Database size={40} className="mx-auto text-blue-500 mb-4" />
                        <p className="text-slate-700 text-lg">No data sources available.</p>
                        <p className="text-slate-500">
                            Please analyze a PDF document in the "Analyze Document" tab or upload a JSON file above to add a data source.
                        </p>
                    </div>
                )}
             </section>
          )}

          {/* AI Chat Tab Content */}
          {activeTab === 'aiChat' && (
            <section aria-labelledby="ai-chat-section-title">
              <h2 id="ai-chat-section-title" className="text-2xl font-semibold text-slate-800 mb-6">
                AI Chat
              </h2>
              
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold text-blue-600 mb-3 flex items-center">
                    <ListChecks size={20} className="mr-2"/> Data Sources for Chat Context
                </h3>
                 <p className="text-sm text-slate-500 mb-3">
                    The AI will consider all available data sources listed below. Click a source to view its details in the "View Data" tab.
                  </p>
                {dataSources.length > 0 ? (
                    <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                        {dataSources.map(src => (
                            <li key={src.id}>
                                <button
                                    onClick={() => {
                                        setActiveDataSourceId(src.id);
                                        setActiveTab('viewData');
                                    }}
                                    className="w-full text-left p-2.5 rounded-lg text-sm transition-colors duration-150 bg-white border border-blue-500 text-blue-600 font-medium shadow-sm hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                                >
                                    {src.name} ({src.type}, {src.data.length} items)
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-slate-500 text-sm">
                        No data sources available for chat. Please add a source via the "Analyze Document" or "View Data" tabs.
                    </p>
                )}
              </div>
              
              {dataSources.length > 0 && !dataSources.every(ds => ds.data.length === 0) ? (
                <div>
                  <ChatInterface
                    messages={chatMessages}
                    onSendMessage={handleSendChatMessage}
                    isLoading={isChatLoading}
                    error={chatError}
                    chatContextInfo={getChatContextInfo()}
                  />
                </div>
              ) : (
                 dataSources.length > 0 && dataSources.every(ds => ds.data.length === 0) ? (
                    <div className="text-center p-8 bg-slate-50 rounded-lg border border-slate-200">
                        <Info size={40} className="mx-auto text-blue-500 mb-4" />
                        <p className="text-slate-700 text-lg">All available data sources are empty.</p>
                        <p className="text-slate-500">
                            Chat is disabled. Please add or analyze a file with data.
                        </p>
                    </div>
                 ) : ( // No data sources at all
                    <div className="text-center p-8 bg-slate-50 rounded-lg border border-slate-200">
                        <Info size={40} className="mx-auto text-blue-500 mb-4" />
                        <p className="text-slate-700 text-lg">No data sources available for chat.</p>
                        <p className="text-slate-500">
                           Please add a data source (via "Analyze Document" or "View Data" tab) to begin chatting.
                        </p>
                    </div>
                 )
              )}
            </section>
          )}
        </main>
      </div>

      <footer className="w-full max-w-4xl mt-12 text-center text-slate-500 text-sm">
        <p>&copy; {new Date().getFullYear()} AI Document Analyzer. Powered by Gemini.</p>
      </footer>
    </div>
  );
};

export default App;