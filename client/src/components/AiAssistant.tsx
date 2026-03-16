import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Send, Sparkles, Mic, MicOff, X,
  ArrowUpRight, Loader2, Trash2, Minus
} from 'lucide-react';
import { AiNavigationOverlay } from './AiNavigationOverlay';

const NAV_ROUTES: Record<string, { ru: string; en: string }> = {
  '/': { ru: 'Главная', en: 'Dashboard' },
  '/statistics': { ru: 'Статистика', en: 'Statistics' },
  '/leaderboard': { ru: 'Рейтинг', en: 'Leaderboard' },
  '/members': { ru: 'Участники', en: 'Members' },
  '/news': { ru: 'Новости', en: 'News' },
  '/shop': { ru: 'Магазин', en: 'Shop' },
  '/inventory': { ru: 'Инвентарь', en: 'Inventory' },
  '/convert': { ru: 'Конвертация', en: 'Convert' },
  '/music': { ru: 'Музыка', en: 'Music' },
  '/forum': { ru: 'Форум', en: 'Forum' },
  '/requests': { ru: 'Запросы', en: 'Requests' },
  '/about': { ru: 'О клане', en: 'About' },
  '/achievements': { ru: 'Достижения', en: 'Achievements' },
  '/quests': { ru: 'Квесты', en: 'Quests' },
  '/trading': { ru: 'Торговля', en: 'Trading' },
  '/boosters': { ru: 'Бустеры', en: 'Boosters' },
  '/daily-rewards': { ru: 'Награды', en: 'Daily Rewards' },
  '/profile': { ru: 'Профиль', en: 'Profile' },
  '/mini-games': { ru: 'Мини-игры', en: 'Mini Games' },
  '/clan-wars': { ru: 'Войны', en: 'Clan Wars' },
  '/roblox-tracker': { ru: 'Roblox Трекер', en: 'Roblox Tracker' },
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
  const [greeted, setGreeted] = useState(false);
  const [navAction, setNavAction] = useState<{ path: string; label: string } | null>(null);
  const [pendingType, setPendingType] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recogRef = useRef<any>(null);
  const idRef = useRef(0);

  const [location, setLocation] = useLocation();
  const { language } = useLanguage();

  const isRu = language === 'ru';
  const txt = {
    greeting: isRu
      ? 'Привет! Я **Luminary AI** — ассистент сайта клана. Спрашивай что угодно, могу открыть любую страницу, рассказать о разделах или просто поболтать 💬'
      : "Hi! I'm **Luminary AI** — your clan site assistant. Ask me anything, I can open any page, tell about sections, or just chat 💬",
    placeholder: isRu ? 'Сообщение...' : 'Message...',
    title: 'Luminary AI',
    error: isRu ? 'Ошибка соединения, попробуй ещё раз' : 'Connection error, try again',
    voiceUnsupported: isRu ? 'Голосовой ввод не поддерживается' : 'Voice input not supported',
    listening: isRu ? 'Говорите...' : 'Speak...',
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, [msgs]);

  // Greeting on first open
  useEffect(() => {
    if (open && !greeted) {
      setGreeted(true);
      setMsgs([{ id: ++idRef.current, role: 'assistant', text: txt.greeting }]);
    }
  }, [open]);

  // Focus input
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // Parse [NAV:/path] and [TYPE:text] from AI response
  function parseNav(text: string): { clean: string; nav?: string; typeText?: string } {
    let clean = text;
    let nav: string | undefined;
    let typeText: string | undefined;

    const navMatch = clean.match(/\[NAV:(\/[^\]]*)\]/);
    if (navMatch) { nav = navMatch[1]; clean = clean.replace(navMatch[0], '').trim(); }

    const typeMatch = clean.match(/\[TYPE:([^\]]*)\]/);
    if (typeMatch) { typeText = typeMatch[1]; clean = clean.replace(typeMatch[0], '').trim(); }

    return { clean, nav, typeText };
  }

  // Simple markdown
  function fmt(s: string): string {
    return s
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-size:11px">$1</code>')
      .replace(/\n/g, '<br/>');
  }

  function pageName(path: string): string {
    const route = NAV_ROUTES[path];
    if (route) return route[isRu ? 'ru' : 'en'];
    return path;
  }

  // Type text into an input on the page after navigation
  function typeIntoInput(text: string) {
    setTimeout(() => {
      const el = document.querySelector(
        'input[type="search"], input[type="text"], input[placeholder], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="password"])'
      ) as HTMLInputElement | null;

      if (!el) return;
      el.focus();
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

      let i = 0;
      const interval = setInterval(() => {
        if (i >= text.length) {
          clearInterval(interval);
          // Submit via Enter key
          setTimeout(() => {
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
            const form = el.closest('form');
            if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          }, 200);
          return;
        }
        const current = text.substring(0, i + 1);
        // Use native setter for React controlled inputs
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) {
          setter.call(el, current);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        i++;
      }, 55);
    }, 900); // Wait for new page to render
  }

  // Handle navigation overlay completion
  const handleNavComplete = useCallback(() => {
    if (pendingType) {
      typeIntoInput(pendingType);
      setPendingType(null);
    }
    setNavAction(null);
  }, [pendingType]);

  // Send message
  const send = useCallback(async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const userMsg: ChatMsg = { id: ++idRef.current, role: 'user', text: content };
    const placeholder: ChatMsg = { id: ++idRef.current, role: 'assistant', text: '', loading: true };

    setMsgs(prev => [...prev, userMsg, placeholder]);
    setInput('');
    setLoading(true);
    if (inputRef.current) inputRef.current.style.height = 'auto';

    try {
      const history = [...msgs.filter(m => !m.loading), userMsg].map(m => ({
        role: m.role, content: m.text,
      }));

      const resp = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: history,
          language,
          currentPage: pageName(location),
        }),
      });

      if (!resp.ok) throw new Error('fail');
      const data = await resp.json();
      const { clean, nav, typeText } = parseNav(data.reply || txt.error);

      // Trigger visual navigation overlay instead of direct setLocation
      if (nav && NAV_ROUTES[nav]) {
        if (typeText) setPendingType(typeText);
        setNavAction({ path: nav, label: pageName(nav) });
      }

      setMsgs(prev => prev.map(m =>
        m.id === placeholder.id ? { ...m, text: clean, loading: false, navPath: nav } : m
      ));
    } catch {
      setMsgs(prev => prev.map(m =>
        m.id === placeholder.id ? { ...m, text: txt.error, loading: false } : m
      ));
    }
    setLoading(false);
  }, [input, loading, msgs, language, location, txt.error]);

  // Voice recognition
  const toggleVoice = useCallback(() => {
    const hasSR = ('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window);
    if (!hasSR) {
      setMsgs(prev => [...prev, { id: ++idRef.current, role: 'assistant', text: txt.voiceUnsupported }]);
      return;
    }
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r = new SR();
    r.lang = isRu ? 'ru-RU' : 'en-US';
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onresult = (ev: any) => {
      const transcript = ev.results[0]?.[0]?.transcript;
      setListening(false);
      if (transcript) {
        setInput(transcript);
        setTimeout(() => send(transcript), 300);
      }
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);

    recogRef.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening, isRu, send, txt.voiceUnsupported]);

  const clearChat = () => {
    setMsgs([{ id: ++idRef.current, role: 'assistant', text: txt.greeting }]);
  };

  const suggestions = isRu
    ? ['Открой музыку', 'Что такое квесты?', 'Что в магазине?', 'Расскажи о сайте']
    : ['Open music', 'What are quests?', "What's in the shop?", 'Tell me about the site'];

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      <style>{`
        @keyframes aiFade{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes aiDots{0%,80%,100%{opacity:.25;transform:scale(.7)}40%{opacity:1;transform:scale(1)}}
        @keyframes aiBtnGlow{0%{box-shadow:0 0 0 0 rgba(139,92,246,.6)}70%{box-shadow:0 0 0 10px rgba(139,92,246,0)}100%{box-shadow:0 0 0 0 rgba(139,92,246,0)}}
        .ai-fade{animation:aiFade .2s ease-out}
        .ai-dots{animation:aiDots 1.2s infinite ease-in-out}
        .ai-dots:nth-child(2){animation-delay:.12s}
        .ai-dots:nth-child(3){animation-delay:.24s}
        .ai-glow{animation:aiBtnGlow 2.5s infinite}
      `}</style>

      {/* Navigation overlay with visual cursor animation */}
      <AiNavigationOverlay
        action={navAction}
        onNavigate={(path) => setLocation(path)}
        onComplete={handleNavComplete}
      />

      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-5 right-5 z-[200] w-[52px] h-[52px] rounded-[16px] flex items-center justify-center transition-all duration-200 shadow-lg hover:scale-105 active:scale-95 ${
          open
            ? 'bg-zinc-800 border border-white/10'
            : 'bg-gradient-to-br from-violet-500 to-fuchsia-500 ai-glow'
        }`}
      >
        {open
          ? <X className="w-5 h-5 text-white/70" />
          : <Sparkles className="w-5 h-5 text-white" />
        }
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-[80px] right-5 z-[200] w-[340px] max-w-[calc(100vw-40px)] ai-fade">
          <div
            className="rounded-[20px] overflow-hidden flex flex-col border border-white/[0.06] shadow-2xl"
            style={{
              maxHeight: 'min(560px, calc(100vh - 110px))',
              background: 'linear-gradient(to bottom, rgba(20,20,28,.97), rgba(14,14,20,.98))',
              backdropFilter: 'blur(30px)',
            }}
          >
            {/* Header */}
            <div className="h-[52px] px-4 flex items-center gap-2.5 border-b border-white/[0.05] shrink-0">
              <div className="text-[13px] font-semibold text-white/90 flex-1">{txt.title}</div>
              <button onClick={clearChat} className="w-6 h-6 flex items-center justify-center text-white/20 hover:text-white/50 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setOpen(false)} className="w-6 h-6 flex items-center justify-center text-white/20 hover:text-white/50 transition-colors">
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5" style={{ minHeight: '160px', maxHeight: '370px' }}>
              {msgs.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ai-fade`}>
                  <div className={`max-w-[82%] rounded-[14px] px-3 py-2 text-[13px] leading-[1.5] ${
                    msg.role === 'user'
                      ? 'bg-violet-500/70 text-white'
                      : 'bg-white/[0.05] text-white/80'
                  }`}>
                    {msg.loading ? (
                      <div className="flex gap-1 py-0.5 px-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 ai-dots" />
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 ai-dots" />
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 ai-dots" />
                      </div>
                    ) : (
                      <>
                        <div dangerouslySetInnerHTML={{ __html: fmt(msg.text) }} />
                        {msg.navPath && NAV_ROUTES[msg.navPath] && (
                          <button
                            onClick={() => setLocation(msg.navPath!)}
                            className="mt-1.5 flex items-center gap-1 text-[11px] text-violet-300 hover:text-violet-200 transition-colors"
                          >
                            <ArrowUpRight className="w-3 h-3" />
                            {pageName(msg.navPath)}
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
              <div className="px-3.5 pb-2 flex flex-wrap gap-1">
                {suggestions.map(s => (
                  <button key={s} onClick={() => send(s)} className="px-2.5 py-1 rounded-[10px] text-[11px] bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.07] transition-all">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-3 pb-3 pt-2 border-t border-white/[0.05] shrink-0">
              <div className="flex items-end gap-1.5">
                <button
                  onClick={toggleVoice}
                  className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 transition-all ${
                    listening
                      ? 'bg-red-500/25 text-red-400'
                      : 'text-white/25 hover:text-white/50 hover:bg-white/[0.05]'
                  }`}
                  title={listening ? (isRu ? 'Остановить' : 'Stop') : (isRu ? 'Голосовой ввод' : 'Voice input')}
                >
                  {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <div className="flex-1 relative">
                  {listening && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/[0.03] rounded-[10px] border border-red-500/20 z-10">
                      <span className="text-[11px] text-red-300 animate-pulse">{txt.listening}</span>
                    </div>
                  )}
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => {
                      setInput(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
                    }}
                    onKeyDown={onKeyDown}
                    placeholder={txt.placeholder}
                    rows={1}
                    disabled={listening}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-[10px] text-[13px] text-white placeholder:text-white/15 px-3 py-[7px] resize-none outline-none focus:border-violet-500/30 transition-colors disabled:opacity-30"
                    style={{ maxHeight: '80px', minHeight: '34px' }}
                  />
                </div>

                <button
                  onClick={() => send()}
                  disabled={!input.trim() || loading}
                  className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 transition-all ${
                    input.trim() && !loading
                      ? 'bg-violet-500 text-white hover:bg-violet-400'
                      : 'bg-white/[0.03] text-white/10'
                  }`}
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
