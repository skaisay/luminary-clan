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
  '/admin/login': { ru: 'Вход в Админку', en: 'Admin Login' },
  '/admin': { ru: 'Админ Панель', en: 'Admin Panel' },
};

// Action step that AI can return
interface AiAction {
  do: 'fill' | 'click' | 'wait' | 'type';
  ai: string;   // data-ai attribute value OR data-testid
  val?: string;  // value for fill/type
  ms?: number;   // ms for wait
}

// A step in a multi-step workflow
interface AiStep {
  nav?: string;
  actions: AiAction[];
}

interface ChatMsg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  navPath?: string;
  loading?: boolean;
}

// ==================== ACTION EXECUTOR ====================
function findElement(aiId: string): HTMLElement | null {
  // Try data-ai first, then data-testid, then id
  return (
    document.querySelector(`[data-ai="${aiId}"]`) ||
    document.querySelector(`[data-testid="${aiId}"]`) ||
    document.getElementById(aiId)
  ) as HTMLElement | null;
}

function fillInput(el: HTMLElement, value: string): Promise<void> {
  return new Promise(resolve => {
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    input.focus();
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });

    let i = 0;
    const interval = setInterval(() => {
      if (i >= value.length) {
        clearInterval(interval);
        // Trigger final events
        input.dispatchEvent(new Event('change', { bubbles: true }));
        resolve();
        return;
      }
      const current = value.substring(0, i + 1);
      // Use native setter for React controlled inputs
      const isInput = input instanceof HTMLInputElement;
      const isTextArea = input instanceof HTMLTextAreaElement;
      const proto = isTextArea ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        setter.call(input, current);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      i++;
    }, 45);
  });
}

function clickElement(el: HTMLElement): void {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Small delay after scroll, then click
  setTimeout(() => {
    // Remove disabled attribute temporarily if present (for React state sync)
    el.click();
    // Also trigger mousedown/mouseup for components that listen to those
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, 150);
}

async function executeActions(actions: AiAction[]): Promise<void> {
  for (const action of actions) {
    // Wait action
    if (action.do === 'wait') {
      await new Promise(r => setTimeout(r, action.ms || 500));
      continue;
    }

    // Find target element (retry a few times for elements that appear after interaction)
    let el: HTMLElement | null = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      el = findElement(action.ai);
      if (el) break;
      await new Promise(r => setTimeout(r, 400));
    }

    if (!el) {
      console.warn(`[AI Action] Element not found: ${action.ai}`);
      continue;
    }

    switch (action.do) {
      case 'fill':
      case 'type':
        await fillInput(el, action.val || '');
        await new Promise(r => setTimeout(r, 200));
        break;
      case 'click':
        clickElement(el);
        await new Promise(r => setTimeout(r, 600));
        break;
    }
  }
}

// Parse [DO:action|target|value] tags from a text fragment (no step markers)
function parseActionsFromFragment(text: string): { nav?: string; actions: AiAction[] } {
  let nav: string | undefined;
  const actions: AiAction[] = [];

  // Parse [NAV:/path]
  const navMatch = text.match(/\[NAV:(\/[^\]]*)\]/);
  if (navMatch) nav = navMatch[1];

  // Parse [DO:action|target|value] tags
  const doRegex = /\[DO:(\w+)\|([^\]|]+)(?:\|([^\]]*))?\]/g;
  let m;
  while ((m = doRegex.exec(text)) !== null) {
    const doType = m[1] as AiAction['do'];
    const ai = m[2];
    const val = m[3];
    if (['fill', 'click', 'wait', 'type'].includes(doType)) {
      actions.push({ do: doType, ai, val, ms: doType === 'wait' ? parseInt(val || '500') : undefined });
    }
  }

  // Backwards compat: parse [TYPE:text] (single input fill)
  const typeMatch = text.match(/\[TYPE:([^\]]*)\]/);
  if (typeMatch && actions.length === 0) {
    actions.push({ do: 'type', ai: '_auto_', val: typeMatch[1] });
  }

  return { nav, actions };
}

// Parse multi-step AI response: [STEP:1]...[STEP:2]... with [NAV:] and [DO:] inside each step
function parseSteps(text: string): { clean: string; steps: AiStep[]; firstNav?: string } {
  let clean = text;
  const steps: AiStep[] = [];

  // Check for [STEP:N] markers
  const hasSteps = /\[STEP:\d+\]/.test(text);

  if (hasSteps) {
    // Split by [STEP:N] markers — each segment is one step's tags
    const segments = text.split(/\[STEP:\d+\]/);
    for (const seg of segments) {
      if (!seg.trim()) continue;
      const { nav, actions } = parseActionsFromFragment(seg);
      if (nav || actions.length > 0) {
        steps.push({ nav, actions });
      }
    }
  } else {
    // No [STEP:] — single step (backward compat)
    const { nav, actions } = parseActionsFromFragment(text);
    if (nav || actions.length > 0) {
      steps.push({ nav, actions });
    }
  }

  // Remove all tags from displayed text
  clean = clean
    .replace(/\[STEP:\d+\]/g, '')
    .replace(/\[NAV:\/[^\]]*\]/g, '')
    .replace(/\[DO:\w+\|[^\]]*\]/g, '')
    .replace(/\[TYPE:[^\]]*\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const firstNav = steps.length > 0 ? steps[0].nav : undefined;
  return { clean, steps, firstNav };
}

// ==================== COMPONENT ====================
export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [greeted, setGreeted] = useState(false);
  const [navAction, setNavAction] = useState<{ path: string; label: string } | null>(null);
  const [pendingActions, setPendingActions] = useState<AiAction[]>([]);
  // Multi-step queue
  const [stepQueue, setStepQueue] = useState<AiStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recogRef = useRef<any>(null);
  const idRef = useRef(0);

  const [location, setLocation] = useLocation();
  const { language } = useLanguage();

  const isRu = language === 'ru';
  const txt = {
    greeting: isRu
      ? 'Привет! Я **Luminary AI** — ассистент клана. Могу открыть страницы, заполнить формы, искать игроков, отправлять торговые предложения и многое другое. Просто скажи что нужно! 🤖'
      : "Hi! I'm **Luminary AI** — clan assistant. I can open pages, fill forms, search players, send trade offers, and more. Just tell me what you need! 🤖",
    placeholder: isRu ? 'Сообщение...' : 'Message...',
    title: 'Luminary AI',
    error: isRu ? 'Ошибка соединения, попробуй ещё раз' : 'Connection error, try again',
    voiceUnsupported: isRu ? 'Голосовой ввод не поддерживается в этом браузере' : 'Voice input not supported in this browser',
    listening: isRu ? 'Говорите...' : 'Speak...',
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, [msgs]);

  useEffect(() => {
    if (open && !greeted) {
      setGreeted(true);
      setMsgs([{ id: ++idRef.current, role: 'assistant', text: txt.greeting }]);
    }
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  function fmt(s: string): string {
    return s
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-size:11px">$1</code>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#a78bfa;word-break:break-all;text-decoration:underline">$1</a>')
      .replace(/\n/g, '<br/>');
  }

  function pageName(path: string): string {
    const route = NAV_ROUTES[path];
    if (route) return route[isRu ? 'ru' : 'en'];
    return path;
  }

  // Auto-find first input on current page and type into it (fallback for [TYPE:])
  function autoTypeIntoInput(text: string) {
    setTimeout(() => {
      const el = document.querySelector(
        '[data-ai] input, [data-ai] textarea, input[data-ai], textarea[data-ai], input[type="search"], input[type="text"]:not([type="hidden"]):not(.ai-chat-input)'
      ) as HTMLInputElement | null;
      if (!el) return;
      fillInput(el, text).then(() => {
        setTimeout(() => {
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
          const form = el.closest('form');
          if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }, 200);
      });
    }, 900);
  }

  // Process a specific step from the queue
  const processStep = useCallback((steps: AiStep[], idx: number) => {
    if (idx >= steps.length) {
      // All steps done — clean up
      setStepQueue([]);
      setCurrentStepIdx(0);
      setTotalSteps(0);
      return;
    }

    const step = steps[idx];
    setCurrentStepIdx(idx);

    if (step.nav && NAV_ROUTES[step.nav]) {
      // Has navigation — trigger overlay, store actions for after nav
      setPendingActions(step.actions);
      setNavAction({ path: step.nav, label: pageName(step.nav) });
    } else if (step.actions.length > 0) {
      // Actions only on current page
      setTimeout(() => {
        executeActions(step.actions).then(() => {
          // Advance to next step after actions complete
          const nextIdx = idx + 1;
          if (nextIdx < steps.length) {
            setTimeout(() => processStep(steps, nextIdx), 600);
          } else {
            setStepQueue([]);
            setCurrentStepIdx(0);
            setTotalSteps(0);
          }
        });
      }, 300);
    } else {
      // Empty step — skip to next
      const nextIdx = idx + 1;
      if (nextIdx < steps.length) {
        setTimeout(() => processStep(steps, nextIdx), 200);
      } else {
        setStepQueue([]);
        setCurrentStepIdx(0);
        setTotalSteps(0);
      }
    }
  }, []);

  // After navigation overlay completes
  const handleNavComplete = useCallback(() => {
    const actions = [...pendingActions];
    setPendingActions([]);
    setNavAction(null);

    // Execute actions for current step, then advance to next
    setTimeout(() => {
      const autoType = actions.find(a => a.ai === '_auto_');
      const doActions = autoType
        ? () => { autoTypeIntoInput(autoType.val || ''); return Promise.resolve(); }
        : () => executeActions(actions);

      doActions().then(() => {
        // Check if there are more steps in the queue
        if (stepQueue.length > 0) {
          const nextIdx = currentStepIdx + 1;
          if (nextIdx < stepQueue.length) {
            setTimeout(() => processStep(stepQueue, nextIdx), 800);
          } else {
            setStepQueue([]);
            setCurrentStepIdx(0);
            setTotalSteps(0);
          }
        }
      });
    }, 800);
  }, [pendingActions, stepQueue, currentStepIdx, processStep]);

  // Send message
  const send = useCallback(async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const userMsg: ChatMsg = { id: ++idRef.current, role: 'user', text: content };
    const placeholder: ChatMsg = { id: ++idRef.current, role: 'assistant', text: '', loading: true };

    setMsgs(prev => [...prev, userMsg, placeholder]);
    setInput('');
    setVoiceText('');
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
      const { clean, steps, firstNav } = parseSteps(data.reply || txt.error);

      // Start multi-step execution
      if (steps.length > 0) {
        setStepQueue(steps);
        setTotalSteps(steps.length);
        setCurrentStepIdx(0);
        processStep(steps, 0);
      }

      setMsgs(prev => prev.map(m =>
        m.id === placeholder.id ? { ...m, text: clean, loading: false, navPath: firstNav } : m
      ));
    } catch {
      setMsgs(prev => prev.map(m =>
        m.id === placeholder.id ? { ...m, text: txt.error, loading: false } : m
      ));
    }
    setLoading(false);
  }, [input, loading, msgs, language, location, txt.error]);

  // ==================== VOICE ====================
  const toggleVoice = useCallback(() => {
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      // If we have interim text, send it
      if (voiceText.trim()) {
        setTimeout(() => send(voiceText.trim()), 100);
      }
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMsgs(prev => [...prev, { id: ++idRef.current, role: 'assistant', text: txt.voiceUnsupported }]);
      return;
    }

    const r = new SR();
    r.lang = isRu ? 'ru-RU' : 'en-US';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = (ev: any) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < ev.results.length; i++) {
        const result = ev.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      const combined = (final + interim).trim();
      setVoiceText(combined);
      setInput(combined);

      // If we got final result, auto-send after brief pause
      if (final.trim()) {
        recogRef.current?.stop();
        setListening(false);
        setTimeout(() => send(final.trim()), 400);
      }
    };

    r.onerror = (e: any) => {
      console.log('[Voice] Error:', e.error);
      setListening(false);
      if (e.error === 'not-allowed') {
        setMsgs(prev => [...prev, {
          id: ++idRef.current, role: 'assistant',
          text: isRu ? '⚠️ Доступ к микрофону заблокирован. Разреши микрофон в настройках браузера (значок 🔒 в адресной строке).' : '⚠️ Microphone access blocked. Allow microphone in browser settings (🔒 icon in address bar).',
        }]);
      }
    };

    r.onend = () => {
      // If stopped without final result but we have interim text, send it
      if (listening && voiceText.trim()) {
        setListening(false);
        setTimeout(() => send(voiceText.trim()), 200);
      } else {
        setListening(false);
      }
    };

    recogRef.current = r;
    setVoiceText('');
    try {
      r.start();
      setListening(true);
    } catch (e) {
      console.log('[Voice] Start error:', e);
      setListening(false);
    }
  }, [listening, isRu, send, txt.voiceUnsupported, voiceText]);

  const clearChat = () => {
    setMsgs([{ id: ++idRef.current, role: 'assistant', text: txt.greeting }]);
  };

  const suggestions = isRu
    ? ['Открой музыку', 'Что в магазине?', 'Найди игрока Roblox', 'Создай торговое предложение']
    : ['Open music', "What's in the shop?", 'Find Roblox player', 'Create trade offer'];

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      <style>{`
        @keyframes aiFade{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes aiDots{0%,80%,100%{opacity:.25;transform:scale(.7)}40%{opacity:1;transform:scale(1)}}
        @keyframes aiBtnGlow{0%{box-shadow:0 0 0 0 rgba(139,92,246,.6)}70%{box-shadow:0 0 0 10px rgba(139,92,246,0)}100%{box-shadow:0 0 0 0 rgba(139,92,246,0)}}
        @keyframes aiPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.15);opacity:.7}}
        .ai-fade{animation:aiFade .2s ease-out}
        .ai-dots{animation:aiDots 1.2s infinite ease-in-out}
        .ai-dots:nth-child(2){animation-delay:.12s}
        .ai-dots:nth-child(3){animation-delay:.24s}
        .ai-glow{animation:aiBtnGlow 2.5s infinite}
        .ai-mic-pulse{animation:aiPulse 1.2s ease-in-out infinite}
      `}</style>

      <AiNavigationOverlay
        action={navAction}
        onNavigate={(path) => setLocation(path)}
        onComplete={handleNavComplete}
        stepInfo={totalSteps > 1 ? { current: currentStepIdx + 1, total: totalSteps } : undefined}
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
        {open ? <X className="w-5 h-5 text-white/70" /> : <Sparkles className="w-5 h-5 text-white" />}
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
                  }`} style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
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

            {/* Input bar — items-center for vertical alignment */}
            <div className="px-3 pb-3 pt-2 border-t border-white/[0.05] shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleVoice}
                  className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 transition-all ${
                    listening
                      ? 'bg-red-500/25 text-red-400 ai-mic-pulse'
                      : 'text-white/25 hover:text-white/50 hover:bg-white/[0.05]'
                  }`}
                  title={listening ? (isRu ? 'Остановить запись' : 'Stop recording') : (isRu ? 'Голосовой ввод' : 'Voice input')}
                >
                  {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <div className="flex-1 relative">
                  {listening && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-500/[0.06] rounded-[10px] border border-red-500/20 z-10 pointer-events-none">
                      <span className="text-[11px] text-red-300 animate-pulse">{voiceText || txt.listening}</span>
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
                    className="ai-chat-input w-full bg-white/[0.04] border border-white/[0.06] rounded-[10px] text-[13px] text-white placeholder:text-white/15 px-3 py-[7px] resize-none outline-none focus:border-violet-500/30 transition-colors disabled:opacity-30"
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
