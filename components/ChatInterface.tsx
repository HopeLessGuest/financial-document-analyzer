

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, StructuredTemplateResponse } from '../types';
import { Send, User, Bot, AlertTriangle, CornerDownLeft, ArrowDownCircle, ClipboardPaste, Layers, File, Calendar, Hash, BookOpen, X } from 'lucide-react';
import { Spinner } from './Spinner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Popover component for showing data source
const SourcePopover: React.FC<{ 
  sourceData: StructuredTemplateResponse['values'][0]['source']; 
  position: { x: number; y: number };
  onClose: () => void 
}> = ({ sourceData, position: clickPosition, onClose }) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, opacity: 0 });

  useEffect(() => {
    if (!clickPosition || !popoverRef.current) return;
    
    const popoverEl = popoverRef.current;
    if (!popoverEl) return;
    const popoverRect = popoverEl.getBoundingClientRect();

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const margin = 15; // A small margin from viewport edges
    
    let top = clickPosition.y + margin; // Default below cursor
    if (top + popoverRect.height > viewportHeight - margin) {
      top = clickPosition.y - popoverRect.height - margin; // Try above cursor
    }
    if (top < margin) { // If still out of bounds, clamp to top
        top = margin;
    }

    let left = clickPosition.x + margin; // Default right of cursor
    if (left + popoverRect.width > viewportWidth - margin) {
        left = clickPosition.x - popoverRect.width - margin; // Try left of cursor
    }
    if (left < margin) { // If still out of bounds, clamp to left
        left = margin;
    }

    setPosition({ top, left, opacity: 1 });
  }, [clickPosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      style={{ top: `${position.top}px`, left: `${position.left}px`, opacity: position.opacity }}
      className="fixed z-30 w-80 max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-4 transition-opacity duration-200 animate-fade-in-down"
    >
        <div className="flex justify-between items-center mb-3">
            <h4 className="text-base font-semibold text-blue-600">Data Source</h4>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100" aria-label="Close source details">
              <X size={18} className="text-slate-500" />
            </button>
        </div>
        <div className="space-y-2.5 text-sm">
            <div className="flex items-start"><Layers size={14} className="mr-2.5 mt-0.5 text-slate-500 flex-shrink-0"/><span className="text-slate-800 font-medium">{sourceData.name}</span></div>
            <div className="flex items-start"><File size={14} className="mr-2.5 mt-0.5 text-slate-500 flex-shrink-0"/><span className="text-slate-600 truncate">{sourceData.file}</span></div>
            <div className="flex items-start"><Calendar size={14} className="mr-2.5 mt-0.5 text-slate-500 flex-shrink-0"/><span className="text-slate-600">{sourceData.period}</span></div>
            <div className="flex items-start"><Hash size={14} className="mr-2.5 mt-0.5 text-slate-500 flex-shrink-0"/><span className="text-slate-600">Page {sourceData.page}</span></div>
            <div className="flex items-start border-t border-slate-200 pt-2.5 mt-2.5"><BookOpen size={14} className="mr-2.5 mt-0.5 text-slate-500 flex-shrink-0"/><p className="text-xs text-slate-500 bg-slate-50 p-2 rounded max-h-24 overflow-y-auto font-mono">{sourceData.sourceText}</p></div>
        </div>
    </div>
  );
};


// Renderer for structured template responses
const TemplateResponseRenderer: React.FC<{ response: StructuredTemplateResponse }> = ({ response }) => {
    const [activePopover, setActivePopover] = useState<{ placeholder: string; position: { x: number, y: number } } | null>(null);

    const handleValueClick = (placeholder: string, event: React.MouseEvent<HTMLButtonElement>) => {
        setActivePopover(prev => (
            prev?.placeholder === placeholder 
                ? null 
                : { placeholder, position: { x: event.clientX, y: event.clientY } }
        ));
    };

    const closePopover = () => {
        setActivePopover(null);
    };

    const valuesMap = new Map<string, StructuredTemplateResponse['values'][0]>(response.values.map(v => [v.placeholder, v]));
    const placeholderRegex = /({{FILL_\d+}})|(\[Data Not Found\])/g;
    const parts = response.filledTemplate.split(placeholderRegex).filter(part => part);

    return (
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
            {parts.map((part, index) => {
                if (part === "[Data Not Found]") {
                    return <span key={index} className="bg-slate-200 text-slate-600 font-medium px-1.5 py-0.5 rounded-md mx-0.5">{part}</span>
                }
                if (/^{{FILL_\d+}}$/.test(part)) {
                    const valueData = valuesMap.get(part);
                    if (valueData) {
                        return (
                            <button
                                key={`${part}-${index}`}
                                onClick={(e) => handleValueClick(part, e)}
                                className={`bg-blue-100 text-blue-800 font-semibold px-1.5 py-0.5 rounded-md mx-0.5 cursor-pointer hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${activePopover?.placeholder === part ? 'ring-2 ring-blue-500' : ''}`}
                            >
                                {valueData.value}
                            </button>
                        );
                    }
                }
                return <span key={index}>{part}</span>;
            })}

            {activePopover && valuesMap.has(activePopover.placeholder) && valuesMap.get(activePopover.placeholder)!.source && (
                <SourcePopover
                    sourceData={valuesMap.get(activePopover.placeholder)!.source}
                    position={activePopover.position}
                    onClose={closePopover}
                />
            )}
        </div>
    );
};


interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  chatContextInfo: string;
  isTemplateMode: boolean;
  onSetIsTemplateMode: (isTemplate: boolean) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  isLoading,
  error,
  chatContextInfo,
  isTemplateMode,
  onSetIsTemplateMode,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);


  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto'); 
  }, [messages]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isScrolledUp = container.scrollTop < container.scrollHeight - container.clientHeight - 100;
      setShowScrollButton(isScrolledUp);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
        textarea.style.height = 'auto'; // Reset height
        textarea.style.height = `${textarea.scrollHeight}px`; // Set to content height
    }
  }, [inputText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    await onSendMessage(inputText);
    setInputText('');
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-slate-50 border border-slate-200 shadow-sm rounded-lg p-4 sm:p-6 flex flex-col h-[500px] max-h-[70vh]">
      {chatContextInfo && (
        <p className="text-xs text-slate-500 mb-3 border-b border-slate-200 pb-2">
          {chatContextInfo}
        </p>
      )}
      <div ref={chatContainerRef} className="flex-grow overflow-y-auto space-y-4 pr-2 mb-4 relative">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-end space-x-2 ${
              msg.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.sender === 'ai' && (
              <div className="flex-shrink-0 bg-blue-500 rounded-full p-1.5 self-start">
                <Bot size={18} className="text-white" />
              </div>
            )}
            <div
              className={`max-w-[70%] p-3 rounded-xl shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-slate-100 text-slate-800 rounded-bl-none'
              }`}
            >
              {msg.sender === 'ai' ? (
                 msg.templateResponse ? (
                    <TemplateResponseRenderer response={msg.templateResponse} />
                ) : (
                    <div className="markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                    </div>
                )
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              )}
              <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-blue-200' : 'text-slate-500'} text-right`}>
                {formatTimestamp(msg.timestamp)}
              </p>
            </div>
             {msg.sender === 'user' && (
              <div className="flex-shrink-0 bg-indigo-500 rounded-full p-1.5 self-start">
                <User size={18} className="text-slate-100" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} /> {/* Anchor for scrolling */}
        {isLoading && messages.length > 0 && messages[messages.length-1].sender === 'user' && (
           <div className="flex items-end space-x-2 justify-start">
             <div className="flex-shrink-0 bg-blue-500 rounded-full p-1.5 self-start">
                <Bot size={18} className="text-white" />
              </div>
            <div className="max-w-[70%] p-3 rounded-xl shadow-sm bg-slate-100 text-slate-800 rounded-bl-none">
                <Spinner size="small" color="text-blue-500" />
            </div>
           </div>
        )}
         {showScrollButton && (
          <button
            onClick={() => scrollToBottom()}
            className="sticky bottom-4 left-1/2 -translate-x-1/2 bg-white/80 border border-slate-300 hover:bg-blue-500 text-blue-500 hover:text-white p-2 rounded-full shadow-lg transition-all backdrop-blur-sm"
            aria-label="Scroll to bottom"
          >
            <ArrowDownCircle size={24} />
          </button>
        )}
      </div>
       {messages.length === 0 && !isLoading && (
        <div className="flex-grow flex flex-col items-center justify-center text-slate-500 text-center">
          <CornerDownLeft size={48} className="mb-4 text-blue-500" />
          <p className="text-lg">Ask a question about the available data source(s).</p>
          <p className="text-sm">Or, switch to Template Mode to have the AI fill in a report.</p>
        </div>
      )}


      {error && (
        <div role="alert" className="my-2 p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center space-x-2 text-sm">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-start space-x-2 pt-3 border-t border-slate-200">
        <button
          type="button"
          onClick={() => onSetIsTemplateMode(!isTemplateMode)}
          className={`p-2.5 rounded-lg transition-colors duration-200 flex-shrink-0 self-start ${
            isTemplateMode
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
          }`}
          title={isTemplateMode ? "Switch to Q&A Mode" : "Switch to Template Mode"}
          aria-pressed={isTemplateMode}
        >
            <ClipboardPaste size={20} />
        </button>
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? "AI is thinking..." : (isTemplateMode ? "Paste your financial template here..." : "Ask a question...")}
          className="flex-grow bg-white border border-slate-300 text-slate-800 placeholder-slate-400 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors resize-none overflow-y-auto"
          disabled={isLoading}
          rows={1}
          style={{maxHeight: '150px'}}
          aria-label="Chat input"
        />
        <button
          type="submit"
          disabled={isLoading || !inputText.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium p-2.5 rounded-lg shadow-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0 self-start"
          aria-label="Send message"
        >
          {isLoading ? <Spinner size="small" color="text-white"/> : <Send size={20} />}
        </button>
      </form>
    </div>
  );
};
