

import React, { useState, useCallback, useEffect } from 'react';
import { ExtractedDataItem, ExtractedChartItem, PageText, ChatMessage, QuerySource, StructuredTemplateResponse } from './types';
import { FileUpload } from './components/FileUpload';
import { JsonUpload } from './components/JsonUpload';
import { PageRangeInput } from './components/PageRangeInput';
import { DataDisplay } from './components/DataDisplay';
import { Spinner } from './components/Spinner';
import { extractTextFromPdf, renderPdfPagesToImages } from './services/pdfParser';
import { analyzeDocument as analyzeDocumentGemini, queryExtractedData as queryExtractedDataGemini, analyzeImagesForCharts as analyzeImagesForChartsGemini, fillTemplateWithData as fillTemplateWithDataGemini } from './services/geminiService';
import * as ollamaService from './services/ollamaService';
import * as gptService from './services/gptService';
import { ChatInterface } from './components/ChatInterface';
import { SettingsMenu } from './components/SettingsMenu';
import { AlertTriangle, KeyRound, Info, MessageSquare, FileText, UploadCloud, Table2, Database, Trash2, ChevronDown, ListChecks, BarChart3 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// PDF.js worker configuration
import * as pdfjsLib from 'pdfjs-dist';
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.min.js`;
}

type ActiveTab = 'analyze' | 'extractCharts' | 'viewData' | 'aiChat';
type ModelProvider = 'gemini' | 'ollama' | 'gpt';
type GptModel = 'gpt-4o' | 'gpt-5';

const App: React.FC = () => {
  // --- State Management ---

  // API Key & Model State
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [gptApiKey, setGptApiKey] = useState<string>(() => localStorage.getItem('gpt_api_key') || '');
  const [modelProvider, setModelProvider] = useState<ModelProvider>(() => (localStorage.getItem('model_provider') as ModelProvider) || 'gemini');
  const [gptModelName, setGptModelName] = useState<GptModel>(() => (localStorage.getItem('gpt_model_name') as GptModel) || 'gpt-4o');

  // Common state
  const [activeTab, setActiveTab] = useState<ActiveTab>('analyze');

  // PDF Numerical Analysis State
  const [pdfFileToAnalyze, setPdfFileToAnalyze] = useState<File | null>(null);
  const [pdfFileNameToAnalyze, setPdfFileNameToAnalyze] = useState<string>('');
  const [numericalPageRange, setNumericalPageRange] = useState<string>('');
  const [numericalProcessingLoading, setNumericalProcessingLoading] = useState<boolean>(false);
  const [numericalProcessingError, setNumericalProcessingError] = useState<string | null>(null);
  const [numericalProcessingInfoMessage, setNumericalProcessingInfoMessage] = useState<string | null>(null);
  const [numericalProcessingProgress, setNumericalProcessingProgress] = useState<number>(0);

  // PDF Chart Extraction State
  const [chartFileToAnalyze, setChartFileToAnalyze] = useState<File | null>(null);
  const [chartFileNameToAnalyze, setChartFileNameToAnalyze] = useState<string>('');
  const [chartPageRange, setChartPageRange] = useState<string>('');
  const [chartProcessingLoading, setChartProcessingLoading] = useState<boolean>(false);
  const [chartProcessingError, setChartProcessingError] = useState<string | null>(null);
  const [chartProcessingInfoMessage, setChartProcessingInfoMessage] = useState<string | null>(null);
  const [chartProcessingProgress, setChartProcessingProgress] = useState(0);

  // JSON Upload Input State
  const [jsonFileToUpload, setJsonFileToUpload] = useState<File | null>(null); 
  const [jsonFileNameToUpload, setJsonFileNameToUpload] = useState<string>('');
  const [jsonProcessingLoading, setJsonProcessingLoading] = useState<boolean>(false);
  const [jsonProcessingError, setJsonProcessingError] = useState<string | null>(null);
  const [jsonProcessingInfoMessage, setJsonProcessingInfoMessage] = useState<string | null>(null);
  
  // Data Sources State
  const [dataSources, setDataSources] = useState<QuerySource[]>([]);
  const [activeDataSourceId, setActiveDataSourceId] = useState<string | null>(null);
  const activeDataSource = dataSources.find(src => src.id === activeDataSourceId) || null;

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isTemplateMode, setIsTemplateMode] = useState<boolean>(false);

  // --- Handlers & Effects ---

  const handleApiKeyChange = (newKey: string) => {
    setApiKey(newKey);
    localStorage.setItem('gemini_api_key', newKey);
  };
  
  const handleGptApiKeyChange = (newKey: string) => {
    setGptApiKey(newKey);
    localStorage.setItem('gpt_api_key', newKey);
  };
  
  const handleGptModelNameChange = (model: GptModel) => {
    setGptModelName(model);
    localStorage.setItem('gpt_model_name', model);
  };

  const handleModelProviderChange = (provider: ModelProvider) => {
    setModelProvider(provider);
    localStorage.setItem('model_provider', provider);
  };

  const resetNumericalInputState = () => {
    setPdfFileToAnalyze(null);
    setPdfFileNameToAnalyze('');
    setNumericalProcessingError(null);
    setNumericalProcessingInfoMessage(null);
  };

  const resetChartInputState = () => {
    setChartFileToAnalyze(null);
    setChartFileNameToAnalyze('');
    setChartProcessingError(null);
    setChartProcessingInfoMessage(null);
  };

  const resetJsonInputState = () => {
    setJsonFileToUpload(null);
    setJsonFileNameToUpload('');
    setJsonProcessingError(null);
    setJsonProcessingInfoMessage(null);
  };
  
  useEffect(() => {
    if (dataSources.length > 0 && !activeDataSourceId) {
      setActiveDataSourceId(dataSources[dataSources.length - 1].id);
    } else if (dataSources.length === 0) {
      setActiveDataSourceId(null);
    }
  }, [dataSources, activeDataSourceId]);


  const handlePdfFileSelectedForAnalysis = (file: File | null) => {
    resetNumericalInputState();
    setPdfFileToAnalyze(file);
    setPdfFileNameToAnalyze(file ? file.name : '');
  };
  
  const handlePdfFileSelectedForCharts = (file: File | null) => {
    resetChartInputState();
    setChartFileToAnalyze(file);
    setChartFileNameToAnalyze(file ? file.name : '');
  };

  const handleJsonFileSelectedForUpload = async (file: File | null) => {
    resetJsonInputState();
    if (!file) return;

    setJsonFileToUpload(file);
    setJsonFileNameToUpload(file.name);

    setJsonProcessingLoading(true);
    setJsonProcessingError(null);
    setJsonProcessingInfoMessage(`Processing JSON file: ${file.name}...`);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      let newSource: QuerySource | null = null;
      let infoMsg = '';

      // New format check: { name, dataType, data }
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        typeof parsed.name === 'string' &&
        (parsed.dataType === 'numerical' || parsed.dataType === 'chart') &&
        Array.isArray(parsed.data)
      ) {
        newSource = {
          id: uuidv4(),
          name: parsed.name,
          data: parsed.data as ExtractedDataItem[] | ExtractedChartItem[],
          type: 'json',
          dataType: parsed.dataType,
        };
        infoMsg = `Successfully loaded ${newSource.data.length} items from source "${parsed.name}".`;

      // Old format check: [...] (an array of data items)
      } else if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
            newSource = {
                id: uuidv4(),
                name: file.name,
                data: [],
                type: 'json',
                dataType: 'numerical' // Assume numerical for empty array for now
            };
            infoMsg = `Loaded an empty data source from "${file.name}".`;
        } else {
            const firstItem = parsed[0];
            // Heuristic check to see if it's numerical or chart data
            if (firstItem && typeof firstItem === 'object' && 'value' in firstItem && 'year' in firstItem) {
                // Looks like numerical data
                newSource = {
                  id: uuidv4(),
                  name: file.name,
                  data: parsed as ExtractedDataItem[],
                  type: 'json',
                  dataType: 'numerical',
                };
                infoMsg = `Successfully loaded ${newSource.data.length} items from legacy JSON file "${file.name}". Data type inferred as 'numerical'.`;
            } else if (firstItem && typeof firstItem === 'object' && 'title' in firstItem && 'pageNumber' in firstItem) {
                // Looks like chart data
                newSource = {
                  id: uuidv4(),
                  name: `${file.name} (Charts)`,
                  data: parsed as ExtractedChartItem[],
                  type: 'json',
                  dataType: 'chart',
                };
                 infoMsg = `Successfully loaded ${newSource.data.length} items from legacy JSON file "${file.name}". Data type inferred as 'chart'.`;
            } else {
                throw new Error("The uploaded array does not contain recognizable data items (expected keys like 'value' and 'year' for numerical data, or 'title' and 'pageNumber' for chart data).");
            }
        }
      } else {
        throw new Error("Invalid JSON format. Expected an object with 'name', 'dataType', and 'data' properties, or a direct array of data items.");
      }

      if (newSource) {
        setDataSources(prev => [...prev, newSource]);
        setActiveDataSourceId(newSource.id);
        setJsonProcessingInfoMessage(infoMsg);
        resetJsonInputState();
        setActiveTab('viewData');
      }

    } catch (err) {
      console.error('JSON processing error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setJsonProcessingError(`Error processing JSON file: ${errorMessage}`);
      setJsonProcessingInfoMessage(null);
    } finally {
      setJsonProcessingLoading(false);
    }
  };

  const handleNumericalSubmit = useCallback(async () => {
    if (!pdfFileToAnalyze) {
      setNumericalProcessingError('Please upload a PDF file.');
      return;
    }
    if (modelProvider === 'gemini' && !apiKey) {
      setNumericalProcessingError('Please enter your Gemini API Key in the settings menu.');
      return;
    }
    if (modelProvider === 'gpt' && !gptApiKey) {
      setNumericalProcessingError('Please enter your OpenAI API Key in the settings menu.');
      return;
    }
    
    setNumericalProcessingLoading(true);
    setNumericalProcessingError(null);
    setNumericalProcessingProgress(0);
    setNumericalProcessingInfoMessage('Extracting text from PDF...');

    try {
      setNumericalProcessingProgress(10);
      const pageTexts: PageText[] = await extractTextFromPdf(pdfFileToAnalyze, numericalPageRange);

      if (pageTexts.length === 0) {
        throw new Error('Could not extract text from the specified pages. The pages might be empty or scanned images.');
      }
      
      setNumericalProcessingProgress(50);
      setNumericalProcessingInfoMessage(`Text extracted from ${pageTexts.length} page(s). Analyzing with AI (${modelProvider})...`);

      let data: ExtractedDataItem[];
      switch (modelProvider) {
        case 'gemini':
          data = await analyzeDocumentGemini(pageTexts, pdfFileNameToAnalyze, apiKey);
          break;
        case 'gpt':
          data = await gptService.analyzeDocument(pageTexts, pdfFileNameToAnalyze, gptApiKey, gptModelName);
          break;
        case 'ollama':
        default:
          data = await ollamaService.analyzeDocument(pageTexts, pdfFileNameToAnalyze);
          break;
      }
      
      setNumericalProcessingProgress(100);

      const newSource: QuerySource = {
        id: uuidv4(),
        name: pdfFileNameToAnalyze,
        data,
        type: 'pdf',
        dataType: 'numerical',
      };
      setDataSources(prev => [...prev, newSource]);
      setActiveDataSourceId(newSource.id);

      setNumericalProcessingInfoMessage(`Successfully extracted ${data.length} data items. '${pdfFileNameToAnalyze}' is now available.`);
      resetNumericalInputState(); 
      setNumericalPageRange(''); 
      setActiveTab('viewData');
      
    } catch (err) {
      console.error('Analysis error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setNumericalProcessingError(`An error occurred: ${errorMessage}.`);
    } finally {
      setNumericalProcessingLoading(false);
    }
  }, [pdfFileToAnalyze, pdfFileNameToAnalyze, numericalPageRange, apiKey, gptApiKey, gptModelName, modelProvider]);

  const handleChartExtractionSubmit = useCallback(async () => {
    if (modelProvider === 'ollama') {
        setChartProcessingError("Chart extraction is not supported with the Ollama model. Please switch to a different provider in settings.");
        return;
    }
    if (!chartFileToAnalyze) {
      setChartProcessingError('Please upload a PDF file.');
      return;
    }
    if (modelProvider === 'gemini' && !apiKey) {
      setChartProcessingError('Please enter your Gemini API Key in the settings menu.');
      return;
    }
    if (modelProvider === 'gpt' && !gptApiKey) {
      setChartProcessingError('Please enter your OpenAI API Key in the settings menu.');
      return;
    }
    
    setChartProcessingLoading(true);
    setChartProcessingError(null);
    setChartProcessingProgress(0);
    setChartProcessingInfoMessage('Rendering PDF pages to images...');

    try {
      const pageImages = await renderPdfPagesToImages(chartFileToAnalyze, chartPageRange, (progress) => {
        setChartProcessingProgress(progress * 0.5); // Rendering is 50% of the job
        setChartProcessingInfoMessage(`Rendering PDF pages to images... (${progress}%)`);
      });

      if (pageImages.length === 0) {
        throw new Error('Could not render any pages from the PDF. Please check the page range or file.');
      }
      
      let chartMetadatas;
      const onProgress = (progress: number, message: string) => {
        setChartProcessingProgress(50 + progress * 0.5); // AI Analysis is 50%
        setChartProcessingInfoMessage(message);
      };

      if (modelProvider === 'gemini') {
        chartMetadatas = await analyzeImagesForChartsGemini(pageImages, apiKey, onProgress);
      } else { // GPT
        chartMetadatas = await gptService.analyzeImagesForCharts(pageImages, gptApiKey, gptModelName, onProgress);
      }

      const extractedCharts: ExtractedChartItem[] = chartMetadatas.map(metadata => ({
          ...metadata,
          id: uuidv4(),
          file: chartFileNameToAnalyze,
      }));

      setChartProcessingProgress(100);

      const newSource: QuerySource = {
        id: uuidv4(),
        name: `${chartFileNameToAnalyze} (Charts)`,
        data: extractedCharts,
        type: 'pdf',
        dataType: 'chart',
      };
      setDataSources(prev => [...prev, newSource]);
      setActiveDataSourceId(newSource.id);

      setChartProcessingInfoMessage(`Successfully extracted ${extractedCharts.length} charts. '${newSource.name}' is now available.`);
      resetChartInputState(); 
      setChartPageRange(''); 
      setActiveTab('viewData');
      
    } catch (err) {
      console.error('Chart extraction error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setChartProcessingError(`An error occurred during chart extraction: ${errorMessage}.`);
    } finally {
      setChartProcessingLoading(false);
    }
  }, [chartFileToAnalyze, chartFileNameToAnalyze, chartPageRange, apiKey, gptApiKey, gptModelName, modelProvider]);


  const handleSendChatMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim()) return;

    const availableDataSources = dataSources.filter(ds => ds.data.length > 0);
    if (availableDataSources.length === 0) {
        setChatError("Cannot send message: No data sources with content are available.");
        return;
    }

    const numericalDataSources = dataSources.filter(ds => ds.dataType === 'numerical' && ds.data.length > 0);

    if (isTemplateMode && numericalDataSources.length === 0) {
        setChatError("Template Mode requires at least one numerical data source with content.");
        return;
    }

    const newUserMessage: ChatMessage = { id: uuidv4(), sender: 'user', text: messageText, timestamp: Date.now() };
    const updatedChatMessages = [...chatMessages, newUserMessage];
    setChatMessages(updatedChatMessages);
    setIsChatLoading(true);
    setChatError(null);

    try {
       if (isTemplateMode) {
        let templateResponse: StructuredTemplateResponse;
        switch (modelProvider) {
          case 'gemini':
            templateResponse = await fillTemplateWithDataGemini(messageText, numericalDataSources, apiKey);
            break;
          case 'gpt':
            templateResponse = await gptService.fillTemplateWithData(messageText, numericalDataSources, gptApiKey, gptModelName);
            break;
          case 'ollama':
          default:
            templateResponse = await ollamaService.fillTemplateWithData(messageText, numericalDataSources);
            break;
        }
        const newAiMessage: ChatMessage = {
          id: uuidv4(),
          sender: 'ai',
          text: 'Here is your filled template. Click on highlighted values to see their source.',
          templateResponse: templateResponse,
          timestamp: Date.now()
        };
        setChatMessages(prev => [...prev, newAiMessage]);
      } else {
        let aiResponseText: string;
         switch (modelProvider) {
          case 'gemini':
            aiResponseText = await queryExtractedDataGemini(messageText, availableDataSources, updatedChatMessages, apiKey);
            break;
          case 'gpt':
            aiResponseText = await gptService.queryExtractedData(messageText, availableDataSources, updatedChatMessages, gptApiKey, gptModelName);
            break;
          case 'ollama':
          default:
            aiResponseText = await ollamaService.queryExtractedData(messageText, availableDataSources, updatedChatMessages);
            break;
        }
        const newAiMessage: ChatMessage = { id: uuidv4(), sender: 'ai', text: aiResponseText, timestamp: Date.now() };
        setChatMessages(prev => [...prev, newAiMessage]);
      }
    } catch (err) {
      const chatErrorMessage = err instanceof Error ? err.message : String(err);
      setChatError(`Chat error: ${chatErrorMessage}`);
      const errorAiMessage: ChatMessage = { id: uuidv4(), sender: 'ai', text: `Sorry, I encountered an error: ${chatErrorMessage}`, timestamp: Date.now() };
      setChatMessages(prev => [...prev, errorAiMessage]);
    } finally {
      setIsChatLoading(false);
    }
  }, [dataSources, chatMessages, apiKey, gptApiKey, gptModelName, modelProvider, isTemplateMode]); 

  const handleRemoveActiveDataSource = () => {
    if (!activeDataSourceId) return;
    setDataSources(prev => prev.filter(src => src.id !== activeDataSourceId));
  };
  
  const getChatContextInfo = (): string => {
    const numericalSourcesCount = dataSources.filter(ds => ds.dataType === 'numerical' && ds.data.length > 0).length;
    const chartSourcesCount = dataSources.filter(ds => ds.dataType === 'chart' && ds.data.length > 0).length;
    const providerName = modelProvider.charAt(0).toUpperCase() + modelProvider.slice(1);

    const parts: string[] = [];
    if (numericalSourcesCount > 0) {
      parts.push(`${numericalSourcesCount} numerical source${numericalSourcesCount > 1 ? 's' : ''}`);
    }
    if (chartSourcesCount > 0) {
      parts.push(`${chartSourcesCount} chart source${chartSourcesCount > 1 ? 's' : ''}`);
    }

    if (parts.length === 0) {
      return `No data sources available for chat. (Provider: ${providerName})`;
    }

    return `Querying ${parts.join(' and ')} (using ${providerName}).`;
  };

  const TabButton: React.FC<{tabId: ActiveTab; currentTab: ActiveTab; onClick: (tabId: ActiveTab) => void; children: React.ReactNode;}> = 
    ({ tabId, currentTab, onClick, children }) => (
    <button
      role="tab"
      aria-selected={currentTab === tabId}
      onClick={() => onClick(tabId)}
      className={`py-3 px-6 font-medium text-sm transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-t-lg flex items-center
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
      <header className="w-full max-w-5xl mb-8 relative">
        <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-blue-600">
            Financial Document Analyzer
            </h1>
            <p className="mt-3 text-slate-600 text-lg">
            Extract, view, and query PDFs data with AI.
            </p>
        </div>
        <div className="absolute top-0 right-0">
            <SettingsMenu
                modelProvider={modelProvider}
                onModelProviderChange={handleModelProviderChange}
                apiKey={apiKey}
                onApiKeyChange={handleApiKeyChange}
                gptApiKey={gptApiKey}
                onGptApiKeyChange={handleGptApiKeyChange}
                gptModelName={gptModelName}
                onGptModelNameChange={handleGptModelNameChange}
            />
        </div>
      </header>

      <div className="w-full max-w-5xl">
        <div className="flex border-b border-slate-200 mb-px">
          <TabButton tabId="analyze" currentTab={activeTab} onClick={setActiveTab}><FileText size={18} className="mr-2" /> Numerical Extraction</TabButton>
          <TabButton tabId="extractCharts" currentTab={activeTab} onClick={setActiveTab}><BarChart3 size={18} className="mr-2" /> Chart Extraction</TabButton>
          <TabButton tabId="viewData" currentTab={activeTab} onClick={setActiveTab}><Table2 size={18} className="mr-2" /> View Data</TabButton>
          <TabButton tabId="aiChat" currentTab={activeTab} onClick={setActiveTab}><MessageSquare size={18} className="mr-2" /> AI Chat</TabButton>
        </div>

        <main className="w-full bg-white shadow-lg border border-slate-200 rounded-b-xl p-6 sm:p-8 min-h-[400px]">
          {activeTab === 'analyze' && (
            <section aria-labelledby="analysis-section-title">
              <h2 id="analysis-section-title" className="text-2xl font-semibold text-slate-800 mb-6">Extract Numerical Data from PDF</h2>
              <div className="space-y-6">
                <FileUpload onFileChange={handlePdfFileSelectedForAnalysis} currentFileName={pdfFileNameToAnalyze} />
                <PageRangeInput pageRange={numericalPageRange} onPageRangeChange={setNumericalPageRange} />
                <button onClick={handleNumericalSubmit} disabled={numericalProcessingLoading || !pdfFileToAnalyze} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2">
                  {numericalProcessingLoading ? <Spinner /> : <span>Analyze for Numerical Data</span>}
                </button>
              </div>
              {numericalProcessingLoading && (
                <div className="mt-4 text-center">
                  <Spinner size="large"/>
                  <p className="text-slate-500 mt-2">{numericalProcessingInfoMessage}</p>
                  <div className="w-full bg-slate-200 rounded-full h-2.5 mt-2">
                      <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{width: `${numericalProcessingProgress}%`}}></div>
                  </div>
                </div>
              )}
              {numericalProcessingInfoMessage && !numericalProcessingLoading && !numericalProcessingError && <div role="status" className="mt-6 p-4 bg-blue-50 border-blue-200 text-blue-800 rounded-lg flex items-center space-x-3"><Info size={20} /><span>{numericalProcessingInfoMessage}</span></div>}
              {numericalProcessingError && <div role="alert" className="mt-6 p-4 bg-red-50 border-red-200 text-red-800 rounded-lg flex items-center space-x-3"><AlertTriangle size={20} /><span>{numericalProcessingError}</span></div>}
            </section>
          )}

          {activeTab === 'extractCharts' && (
             <section aria-labelledby="chart-extraction-title">
              <h2 id="chart-extraction-title" className="text-2xl font-semibold text-slate-800 mb-6">Extract Chart Titles from PDF</h2>
                {modelProvider === 'ollama' && (
                    <div role="alert" className="mb-6 p-4 bg-amber-50 border-amber-200 text-amber-800 rounded-lg flex items-center space-x-3">
                        <AlertTriangle size={20} className="flex-shrink-0" />
                        <span>Chart extraction is a multimodal feature only available with Gemini or GPT. Please switch models in the settings to use this tab.</span>
                    </div>
                )}
              <div className="space-y-6">
                <FileUpload onFileChange={handlePdfFileSelectedForCharts} currentFileName={chartFileNameToAnalyze} />
                <PageRangeInput pageRange={chartPageRange} onPageRangeChange={setChartPageRange} />
                <button onClick={handleChartExtractionSubmit} disabled={chartProcessingLoading || !chartFileToAnalyze || modelProvider === 'ollama'} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2">
                  {chartProcessingLoading ? <Spinner /> : <span>Extract Charts</span>}
                </button>
              </div>
              {chartProcessingLoading && <div className="mt-4 text-center">
                <Spinner size="large"/>
                <p className="text-slate-500 mt-2">{chartProcessingInfoMessage}</p>
                <div className="w-full bg-slate-200 rounded-full h-2.5 mt-2"><div className="bg-blue-600 h-2.5 rounded-full" style={{width: `${chartProcessingProgress}%`}}></div></div>
              </div>}
              {chartProcessingInfoMessage && !chartProcessingLoading && !chartProcessingError && <div role="status" className="mt-6 p-4 bg-blue-50 border-blue-200 text-blue-800 rounded-lg flex items-center space-x-3"><Info size={20} /><span>{chartProcessingInfoMessage}</span></div>}
              {chartProcessingError && <div role="alert" className="mt-6 p-4 bg-red-50 border-red-200 text-red-800 rounded-lg flex items-center space-x-3"><AlertTriangle size={20} /><span>{chartProcessingError}</span></div>}
            </section>
          )}

          {activeTab === 'viewData' && (
             <section aria-labelledby="view-data-section-title">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h2 id="view-data-section-title" className="text-2xl font-semibold text-slate-800">View & Manage Data Sources</h2>
                        {activeDataSource && <p className="text-sm text-slate-500">Active source: <span className="font-medium text-blue-600">{activeDataSource.name}</span></p>}
                    </div>
                    {dataSources.length > 0 && (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-grow sm:flex-grow-0">
                                <select value={activeDataSourceId || ''} onChange={(e) => setActiveDataSourceId(e.target.value)} className="w-full appearance-none bg-white border border-slate-300 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 pr-8" aria-label="Select data source">
                                    {dataSources.map(src => (<option key={src.id} value={src.id}>{src.name} ({src.dataType}, {src.data.length} items)</option>))}
                                </select>
                                <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/>
                            </div>
                            <button onClick={handleRemoveActiveDataSource} disabled={!activeDataSourceId} className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50" title="Remove Selected Source"><Trash2 size={18} /></button>
                        </div>
                    )}
                </div>
                <div className="mb-8 p-6 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="text-lg font-semibold text-blue-600 mb-3 flex items-center"><UploadCloud size={20} className="mr-2"/> Add Data Source from JSON</h3>
                    <p className="text-sm text-slate-500 mb-4">Upload a JSON file to add it as a new data source. This can be a previously exported file (with name, dataType, and data) or a direct array of data points.</p>
                    <JsonUpload onJsonFileChange={handleJsonFileSelectedForUpload} currentJsonFileName={jsonFileNameToUpload} />
                    {jsonProcessingLoading && <div role="status" className="mt-4 flex items-center text-sm text-slate-600"><Spinner size="small" /><span className="ml-2">{jsonProcessingInfoMessage}</span></div>}
                    {jsonProcessingError && <div role="alert" className="mt-4 p-3 bg-red-50 border-red-200 text-red-800 rounded-md text-sm flex items-center space-x-2"><AlertTriangle size={18} /><span>{jsonProcessingError}</span></div>}
                </div>
                
                {activeDataSource && activeDataSource.data.length > 0 ? (
                    <DataDisplay dataSource={activeDataSource} allDataSources={dataSources} />
                ) : dataSources.length > 0 && activeDataSource ? (
                     <div className="text-center p-8 bg-slate-50 rounded-lg border border-slate-200"><Database size={40} className="mx-auto text-blue-500 mb-4" /><p className="text-slate-700 text-lg">The source '{activeDataSource.name}' is empty.</p></div>
                ) : (
                    <div className="text-center p-8 bg-slate-50 rounded-lg border border-slate-200"><Database size={40} className="mx-auto text-blue-500 mb-4" /><p className="text-slate-700 text-lg">No data sources available.</p><p className="text-slate-500">Extract data from a PDF or upload a JSON file to begin.</p></div>
                )}
             </section>
          )}

          {activeTab === 'aiChat' && (
            <section aria-labelledby="ai-chat-section-title">
              <h2 id="ai-chat-section-title" className="text-2xl font-semibold text-slate-800 mb-6">AI Chat</h2>
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold text-blue-600 mb-3 flex items-center"><ListChecks size={20} className="mr-2"/> Data Sources for Chat Context</h3>
                 <p className="text-sm text-slate-500 mb-3">The AI chat will use all available data sources. Template mode requires numerical data. Click a source to view its details.</p>
                {dataSources.length > 0 ? (
                    <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">{dataSources.map(src => (<li key={src.id}><button onClick={() => { setActiveDataSourceId(src.id); setActiveTab('viewData'); }} className="w-full text-left p-2.5 rounded-lg text-sm transition-colors duration-150 bg-white border border-blue-500 text-blue-600 font-medium shadow-sm hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{src.name} ({src.dataType}, {src.data.length} items)</button></li>))}</ul>
                ) : (<p className="text-slate-500 text-sm">No data sources available.</p>)}
              </div>
              
              {dataSources.some(ds => ds.data.length > 0) ? (
                <ChatInterface 
                  messages={chatMessages} 
                  onSendMessage={handleSendChatMessage} 
                  isLoading={isChatLoading} 
                  error={chatError} 
                  chatContextInfo={getChatContextInfo()}
                  isTemplateMode={isTemplateMode}
                  onSetIsTemplateMode={setIsTemplateMode}
                />
              ) : (
                 <div className="text-center p-8 bg-slate-50 rounded-lg border border-slate-200"><Info size={40} className="mx-auto text-blue-500 mb-4" /><p className="text-slate-700 text-lg">No data available for chat.</p><p className="text-slate-500">Please add a data source with content to begin chatting.</p></div>
              )}
            </section>
          )}
        </main>
      </div>

      <footer className="w-full max-w-5xl mt-12 text-center text-slate-500 text-sm">
        <p>&copy; {new Date().getFullYear()} AI Document Analyzer. Powered by AI.</p>
      </footer>
    </div>
  );
};

export default App;