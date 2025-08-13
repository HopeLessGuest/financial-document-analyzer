
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { Send, User, Bot, AlertTriangle, CornerDownLeft, ArrowDownCircle } from 'lucide-react';
import { Spinner } from './Spinner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  chatContextInfo: string; 
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  isLoading,
  error,
  chatContextInfo,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

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
    <div className="bg-slate-700/50 shadow-xl rounded-lg p-4 sm:p-6 flex flex-col h-[500px] max-h-[70vh]">
      {chatContextInfo && (
        <p className="text-xs text-slate-400 mb-3 border-b border-slate-600 pb-2">
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
              <div className="flex-shrink-0 bg-sky-500 rounded-full p-1.5 self-start">
                <Bot size={18} className="text-slate-900" />
              </div>
            )}
            <div
              className={`max-w-[70%] p-3 rounded-xl shadow ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-slate-600 text-slate-200 rounded-bl-none'
              }`}
            >
              {msg.sender === 'ai' ? (
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.text}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              )}
              <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400'} text-right`}>
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
             <div className="flex-shrink-0 bg-sky-500 rounded-full p-1.5 self-start">
                <Bot size={18} className="text-slate-900" />
              </div>
            <div className="max-w-[70%] p-3 rounded-xl shadow bg-slate-600 text-slate-200 rounded-bl-none">
                <Spinner size="small" color="text-sky-300" />
            </div>
           </div>
        )}
         {showScrollButton && (
          <button
            onClick={() => scrollToBottom()}
            className="sticky bottom-4 left-1/2 -translate-x-1/2 bg-slate-800/80 hover:bg-sky-600 text-sky-300 hover:text-white p-2 rounded-full shadow-lg transition-all backdrop-blur-sm"
            aria-label="Scroll to bottom"
          >
            <ArrowDownCircle size={24} />
          </button>
        )}
      </div>
       {messages.length === 0 && !isLoading && (
        <div className="flex-grow flex flex-col items-center justify-center text-slate-400 text-center">
          <CornerDownLeft size={48} className="mb-4 text-sky-500" />
          <p className="text-lg">Ask a question about the available data source(s).</p>
          <p className="text-sm">For example: "What was the total revenue in 2023?" or "List all expenses."</p>
        </div>
      )}


      {error && (
        <div role="alert" className="my-2 p-2.5 bg-red-700/30 border border-red-600 text-red-300 rounded-lg flex items-center space-x-2 text-sm">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center space-x-2 pt-3 border-t border-slate-600">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isLoading ? "AI is thinking..." : "Ask a question..."}
          className="flex-grow bg-slate-600 border border-slate-500 text-slate-100 placeholder-slate-400 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 p-2.5 transition-colors"
          disabled={isLoading}
          aria-label="Chat input"
        />
        <button
          type="submit"
          disabled={isLoading || !inputText.trim()}
          className="bg-sky-500 hover:bg-sky-600 text-white font-medium p-2.5 rounded-lg shadow-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          {isLoading ? <Spinner size="small" color="text-white"/> : <Send size={20} />}
        </button>
      </form>
    </div>
  );
};
