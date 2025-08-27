import React, { useState, useRef, useEffect } from 'react';
import { Settings, X, KeyRound, BrainCircuit, Bot } from 'lucide-react';

interface SettingsMenuProps {
  modelProvider: 'gemini' | 'ollama';
  onModelProviderChange: (provider: 'gemini' | 'ollama') => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  modelProvider,
  onModelProviderChange,
  apiKey,
  onApiKeyChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-slate-100 transition-colors"
        aria-label="Open settings menu"
      >
        <Settings size={24} className="text-slate-600" />
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 p-4 animate-fade-in-down">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Settings</h3>
            <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-slate-100" aria-label="Close settings">
              <X size={20} className="text-slate-500" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">AI Model Provider</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onModelProviderChange('gemini')}
                  className={`flex flex-col items-center justify-center p-3 border rounded-lg transition-all text-sm ${
                    modelProvider === 'gemini' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500' : 'border-slate-300 hover:border-blue-400'
                  }`}
                >
                  <Bot size={24} className={modelProvider === 'gemini' ? 'text-blue-600' : 'text-slate-500'}/>
                  <span className="mt-1 font-semibold">Gemini</span>
                </button>
                <button
                  onClick={() => onModelProviderChange('ollama')}
                  className={`flex flex-col items-center justify-center p-3 border rounded-lg transition-all text-sm ${
                    modelProvider === 'ollama' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500' : 'border-slate-300 hover:border-blue-400'
                  }`}
                >
                  <BrainCircuit size={24} className={modelProvider === 'ollama' ? 'text-blue-600' : 'text-slate-500'}/>
                  <span className="mt-1 font-semibold">Ollama</span>
                </button>
              </div>
            </div>

            {modelProvider === 'gemini' && (
              <div className="border-t border-slate-200 pt-4 animate-fade-in">
                <label htmlFor="api-key-input" className="block text-sm font-medium text-slate-600 mb-2 flex items-center">
                  <KeyRound size={16} className="mr-2 text-slate-500" />
                  Gemini API Key
                </label>
                <input
                  id="api-key-input"
                  type="password"
                  value={apiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  placeholder="Enter your Gemini API Key"
                  className="w-full bg-white border border-slate-300 text-slate-800 placeholder-slate-400 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                />
                 <p className="mt-2 text-xs text-slate-500">
                    Your key is stored in your browser's local storage.
                 </p>
              </div>
            )}
             {modelProvider === 'ollama' && (
                <div className="border-t border-slate-200 pt-4 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
                    <p>Ollama is configured to connect to <code className="font-semibold text-slate-700">http://localhost:11434</code> with model <code className="font-semibold text-slate-700">gpt-oss:20b</code>.</p>
                    <p className="mt-1">Ensure your local Ollama server is running.</p>
                </div>
            )}
          </div>
        </div>
      )}
      <style>{`
        .animate-fade-in-down {
          animation: fadeInDown 0.2s ease-out forwards;
        }
        .animate-fade-in {
            animation: fadeIn 0.3s ease-in forwards;
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
         @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
