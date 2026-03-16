import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Bot, Send, Sparkles, Mic, Volume2, X, 
  ArrowUpRight, Loader2, RotateCcw, Minimize2
} from 'lucide-react';

// ======= ROUTE MAP FOR NAV DETECTION =======
const NAV_ROUTES: Record<string, string> = {
  '/': 'Dashboard', '/statistics': 'Statistics', '/leaderboard': 'Leaderboard',
  '/members': 'Members', '/news': 'News', '/shop': 'Shop', '/inventory': 'Inventory',
  '/music': 'Music', '/forum': 'Forum', '/requests': 'Requests', '/about': 'About',
  '/achievements': 'Achievements', '/quests': 'Quests', '/trading': 'Trading',
  '/boosters': 'Boosters', '/daily-rewards': 'Daily Rewards', '/profile': 'Profile',
  '/mini-games': 'Mini Games', '/clan-wars': 'Clan Wars',
};

interface ChatMsg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  navPath?: string;
  loading?: boolean;
}

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [firstOpen, setFirstOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recogRef = useRef<any>(null);
  const idRef = useRef(0);

  const [, setLocation] = useLocation();
  const { language } = useLanguage();

  const t = language === 'ru' ? {
    greeting: 'Привет! 👋 Я **Luminary AI** — ассистент клана. Задай любой вопрос, попроси открыть страницу, или просто поболтаем! 🚀',
    placeholder: 'Напишите сообщение...',
    title: 'Luminary AI',
    error: 'Ошибка соединения. Попробуйте ещё раз.',
    voiceNotSupported: 'Браузер не поддерживает голосовой ввод',
  } : {
    greeting: "Hey! 👋 I'm **Luminary AI** — your clan assistant. Ask me anything, request a page, or just chat! 🚀",
    placeholder: 'Type a message...',
    title: 'Luminary AI',
    error: 'Connection error. Please try again.',
    voiceNotSupported: "Your browser doesn't support voice input",
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, [msgs, loading]);

  useEffect(() => {
    if (open && firstOpen) {
      setFirstOpen(false);
      setMsgs([{ id: ++idRef.current, role: 'assistant', text: t.greeting }]);
    }
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  function parseNav(text: string): { cleanText: string; navPath?: string } {
    const match = text.match(/\[NAV:(\/[^\]]*)\]/);
    if (match) return { cleanText: text.replace(match[0], '').trim(), navPath: match[1] };
    return { cleanText: text };
  }

  function fmt(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="px-1 py-0.5 rounded bg-white/10 text-[11px]">$1</code>')
      .replace(/\n/g, '<br/>');
  }

  const sendMsg = useCallback(async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const userMsg: ChatMsg = { id: ++idRef.current, role: 'user', text: content };
    const loadingMsg: ChatMsg = { id: ++idRef.current, role: 'assistant', text: '', loading: true };

    setMsgs(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setLoading(true);

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto';

    try {
      const history = [...msgs.filter(m => !m.loading), userMsg].map(m => ({
        role: m.role, content: m.text,
      }));

      const resp = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages: history, language }),
      });

      if (!resp.ok) throw new Error('API error');
      const data = await resp.json();
      const { cleanText, navPath } = parseNav(data.reply || t.error);

      setMsgs(prev => prev.map(m =>
        m.id === loadingMsg.id ? { ...m, text: cleanText, loading: false, navPath } : m
      ));
    } catch {
      setMsgs(prev => prev.map(m =>
        m.id === loadingMsg.id ? { ...m, text: t.error, loading: false } : m
      ));
    }
    setLoading(false);
  }, [input, loading, msgs, language, t.error]);

  const handleNav = useCallback((path: string) => setLocation(path), [setLocation]);

  const toggleVoice = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setMsgs(prev => [...prev, { id: ++idRef.current, role: 'assistant', text: t.voiceNotSupported }]);
      return;
    }
    if (listening) { recogRef.current?.stop(); setListening(false); return; }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recog = new SR();
    recog.lang = language === 'ru' ? 'ru-RU' : 'en-US';
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.onresult = (e: any) => { setListening(false); sendMsg(e.results[0][0].transcript); };
    recog.onerror = () => setListening(false);
    recog.onend = () => setListening(false);
    recogRef.current = recog;
    recog.start();
    setListening(true);
  }, [listening, language, sendMsg, t.voiceNotSupported]);

  const clearChat = () => setMsgs([{ id: ++idRef.current, role: 'assistant', text: t.greeting }]);

  const suggestions = language === 'ru'
    ? ['Открой музыку 🎵', 'Расскажи о квестах', 'Что есть в магазине?', 'Помоги с профилем']
    : ['Open music 🎵', 'Tell me about quests', "What's in the shop?", 'Help with profile'];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  return (
    <>
      <style>{`
        @keyframes aiFadeUp { from { opacity:0; transform:translateY(12px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes aiDot { 0%,80%,100% { opacity:.3; transform:scale(.8); } 40% { opacity:1; transform:scale(1.1); } }
        @keyframes aiPulse { 0% { box-shadow:0 0 0 0 rgba(99,102,241,.5); } 70% { box-shadow:0 0 0 12px rgba(99,102,241,0); } 100% { box-shadow:0 0 0 0 rgba(99,102,241,0); } }
        @keyframes voiceWave { 0%,100% { height:8px; } 50% { height:20px; } }
        .ai-fade-up { animation: aiFadeUp .25s ease-out; }
        .ai-dot { animation: aiDot 1.2s infinite ease-in-out; }
        .ai-dot:nth-child(2) { animation-delay:.15s; }
        .ai-dot:nth-child(3) { animation-delay:.3s; }
        .ai-btn-pulse { animation: aiPulse 2s infinite; }
        .voice-bar { animation: voiceWave .6s infinite ease-in-out; }
        .voice-bar:nth-child(2) { animation-delay:.1s; }
        .voice-bar:nth-child(3) { animation-delay:.2s; }
        .voice-bar:nth-child(4) { animation-delay:.15s; }
      `}</style>

      {/* FAB Button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-5 right-5 z-[200] w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xl hover:scale-105 active:scale-95 ${
          open
            ? 'bg-zinc-800/90 backdrop-blur-md border border-white/10 shadow-black/30'
            : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-indigo-500/40 ai-btn-pulse'
        }`}
      >
        {open ? (
          <X className="w-5 h-5 text-white/80" />
        ) : (
          <>
            <Sparkles className="w-6 h-6 text-white" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-zinc-900" />
          </>
        )}
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-[88px] right-5 z-[200] w-[360px] max-w-[calc(100vw-40px)] ai-fade-up">
          <div
            className="rounded-3xl overflow-hidden flex flex-col border border-white/[0.08] shadow-2xl shadow-black/50"
            style={{
              maxHeight: 'min(580px, calc(100vh - 120px))',
              background: 'linear-gradient(180deg, rgba(24,24,30,0.98) 0%, rgba(16,16,22,0.99) 100%)',
              backdropFilter: 'blur(40px)',
            }}
          >
            {/* Header */}
            <div className="px-4 py-3.5 flex items-center gap-3 border-b border-white/[0.06]">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                <Bot className="w-[18px] h-[18px] text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-white/90">{t.title}</div>
                <div className="text-[10px] text-white/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  Online
                </div>
              </div>
              <button onClick={clearChat} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition-colors" title="Clear">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition-colors">
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: '180px', maxHeight: '380px' }}>
              {msgs.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ai-fade-up`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-[1.55] ${
                    msg.role === 'user'
                      ? 'bg-indigo-500/80 text-white rounded-br-lg'
                      : 'bg-white/[0.04] text-white/85 rounded-bl-lg'
                  }`}>
                    {msg.loading ? (
                      <div className="flex items-center gap-1 py-1 px-1">
                        <div className="w-[6px] h-[6px] rounded-full bg-indigo-400 ai-dot" />
                        <div className="w-[6px] h-[6px] rounded-full bg-indigo-400 ai-dot" />
                        <div className="w-[6px] h-[6px] rounded-full bg-indigo-400 ai-dot" />
                      </div>
                    ) : (
                      <>
                        <div dangerouslySetInnerHTML={{ __html: fmt(msg.text) }} />
                        {msg.navPath && NAV_ROUTES[msg.navPath] && (
                          <button
                            onClick={() => handleNav(msg.navPath!)}
                            className="mt-2 flex items-center gap-1.5 text-[11px] text-indigo-300 hover:text-indigo-200 transition-colors bg-indigo-500/10 rounded-lg px-2.5 py-1.5"
                          >
                            <ArrowUpRight className="w-3 h-3" />
                            {language === 'ru' ? 'Перейти' : 'Go'} → {NAV_ROUTES[msg.navPath]}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Suggestions */}
            {msgs.length <= 2 && !loading && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => sendMsg(s)} className="px-3 py-1.5 rounded-xl text-[11px] bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white/80 border border-white/[0.04] transition-all">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-white/[0.06]">
              {listening && (
                <div className="flex items-center justify-center gap-1 mb-2 py-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-[3px] rounded-full bg-indigo-400 voice-bar" style={{ height: '12px' }} />
                  ))}
                  <span className="text-[11px] text-indigo-300 ml-2">
                    {language === 'ru' ? 'Слушаю...' : 'Listening...'}
                  </span>
                </div>
              )}
              <div className="flex items-end gap-2">
                <button
                  onClick={toggleVoice}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    listening
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-white/[0.04] text-white/30 hover:text-white/60 hover:bg-white/[0.08] border border-transparent'
                  }`}
                >
                  {listening ? <Volume2 className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={t.placeholder}
                  rows={1}
                  className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl text-[13px] text-white placeholder:text-white/20 px-3 py-2 resize-none outline-none focus:border-indigo-500/30 transition-colors"
                  style={{ maxHeight: '100px', minHeight: '36px' }}
                />
                <button
                  onClick={() => sendMsg()}
                  disabled={!input.trim() || loading}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    input.trim() && !loading
                      ? 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-lg shadow-indigo-500/20'
                      : 'bg-white/[0.03] text-white/15 cursor-not-allowed'
                  }`}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
