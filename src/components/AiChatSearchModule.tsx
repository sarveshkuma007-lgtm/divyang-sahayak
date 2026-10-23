import React, { useState } from 'react';
import { 
  Sparkles, 
  Send, 
  Mic, 
  Volume2, 
  Search, 
  BookOpen, 
  Compass, 
  ShieldCheck, 
  HeartHandshake,
  Bot
} from 'lucide-react';
import { SensorySettings } from '../types';
import { getTranslation, formatBionic } from '../services/localization';
import { triggerHaptic, HAPTIC_PATTERNS } from '../services/haptics';
import { speakText } from '../services/speechService';
import { askGeminiAssistant } from '../services/geminiService';

interface AiChatSearchModuleProps {
  settings: SensorySettings;
  onNavigateToTab?: (tab: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

const QUICK_SEARCH_TOPICS = [
  'How do I get an accessible Metro pass?',
  'दिव्यांग अधिकार अधिनियम (RPwD Act) के तहत क्या लाभ मिलते हैं?',
  'What are the emergency numbers for deaf assistance?',
  'Where are tactile guided crossings near AIIMS?',
];

export const AiChatSearchModule: React.FC<AiChatSearchModuleProps> = ({ settings, onNavigateToTab }) => {
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: settings.uiLanguage === 'hi'
        ? 'नमस्ते! मैं आपका दिव्यांग सहायक एआई को-पायलट हूँ। आप मुझसे रास्ता, सरकारी योजनाएं, सांकेतिक भाषा या किसी भी सहायता के बारे में पूछ सकते हैं।'
        : 'Hello! I am your Divyang Sahayak AI Co-pilot. Ask me anything about accessible routes, welfare benefits, sign language glosses, or immediate assistance.',
      timestamp: 'Just now',
    },
  ]);

  const t = (key: string) => getTranslation(settings.uiLanguage, key);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputQuery).trim();
    if (!text || loading) return;

    triggerHaptic(HAPTIC_PATTERNS.CLICK);
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const response = await askGeminiAssistant(
        text,
        settings.uiLanguage,
        'chat_search_module'
      );

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: response.replyText || 'I am here to help you navigate and answer any questions.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
      triggerHaptic(HAPTIC_PATTERNS.SUCCESS);

      // Speak response aloud automatically
      speakText(aiMsg.text, response.languageCode || settings.uiLanguage, settings.voiceSpeed);

      // If recognized command was triggered (e.g. NAVIGATE, CURRENCY, DOCUMENT)
      if (response.command && onNavigateToTab) {
        if (response.command === 'NAVIGATE') onNavigateToTab('navigation');
        else if (response.command === 'DETECT_CURRENCY') onNavigateToTab('currency');
        else if (response.command === 'SCAN_DOCUMENT') onNavigateToTab('document');
        else if (response.command === 'START_CALL') onNavigateToTab('videocall');
      }
    } catch (err) {
      console.error(err);
      const fallbackMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: 'Divyang Sahayak assistance is ready. You have priority rights under the RPwD Act 2016 for full digital and physical barrier-free access.',
        timestamp: 'Just now',
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      speakText(fallbackMsg.text, settings.uiLanguage, settings.voiceSpeed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              AI Voice Assistant & Accessibility Search Engine
            </h2>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Ask any question via voice or text in any language. Powered by Gemini for instant transit advice, schemes, and barrier-free rights.
          </p>
        </div>
      </div>

      {/* Suggested Quick Search Topics */}
      <div className="flex flex-wrap gap-2">
        {QUICK_SEARCH_TOPICS.map((topic, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(topic)}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-xs text-slate-300 border border-slate-700 transition-colors text-left"
          >
            {topic}
          </button>
        ))}
      </div>

      {/* Chat Messages Stream */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700 min-h-[340px] max-h-[460px] overflow-y-auto space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400 font-mono">
              {m.sender === 'ai' ? (
                <>
                  <Bot className="w-3 h-3 text-cyan-400" />
                  <span className="text-cyan-300 font-bold">Divyang Co-pilot</span>
                </>
              ) : (
                <span>You</span>
              )}
              <span>· {m.timestamp}</span>
            </div>

            <div
              className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-md ${
                m.sender === 'user'
                  ? 'bg-cyan-600 text-white rounded-br-none'
                  : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
              }`}
            >
              <p dangerouslySetInnerHTML={{ __html: formatBionic(m.text, settings.bionicReading) }} />

              {m.sender === 'ai' && (
                <div className="flex justify-end pt-2 mt-2 border-t border-slate-700/60">
                  <button
                    onClick={() => speakText(m.text, settings.uiLanguage, settings.voiceSpeed)}
                    className="flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Listen</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-cyan-400 p-2">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>Consulting accessibility knowledge base...</span>
          </div>
        )}
      </div>

      {/* Input Form Bar */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Ask anything or speak (Hindi, English, etc.)..."
          className="flex-1 px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-cyan-400"
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={loading || !inputQuery.trim()}
          className="px-5 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-transform active:scale-95 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Ask</span>
        </button>
      </div>

    </div>
  );
};
