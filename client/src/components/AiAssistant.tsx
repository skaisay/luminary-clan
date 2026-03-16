import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bot, X, Send, Sparkles, Navigation, Music, ShoppingCart, 
  Users, Trophy, Swords, Gamepad2, Gift, BarChart3, Newspaper,
  MessageSquare, ArrowUpRight, Mic, MicOff, User, Globe, 
  ChevronDown, Zap, Star
} from 'lucide-react';

// ======= ROUTE MAP =======
const ROUTES: Record<string, { path: string; icon: any; aliases: { ru: string[]; en: string[] } }> = {
  dashboard:    { path: '/',              icon: Navigation,    aliases: { ru: ['главная', 'дашборд', 'домой', 'хоум', 'старт', 'начало'], en: ['home', 'dashboard', 'main', 'start'] } },
  statistics:   { path: '/statistics',    icon: BarChart3,     aliases: { ru: ['статистика', 'стата', 'статы', 'аналитика'], en: ['statistics', 'stats', 'analytics'] } },
  leaderboard:  { path: '/leaderboard',   icon: Trophy,        aliases: { ru: ['рейтинг', 'топ', 'лидерборд', 'лидеры', 'таблица лидеров'], en: ['leaderboard', 'top', 'ranking', 'leaders'] } },
  members:      { path: '/members',       icon: Users,         aliases: { ru: ['участники', 'мемберы', 'люди', 'пользователи', 'члены'], en: ['members', 'people', 'users'] } },
  news:         { path: '/news',          icon: Newspaper,     aliases: { ru: ['новости', 'ньюс', 'обновления'], en: ['news', 'updates', 'announcements'] } },
  shop:         { path: '/shop',          icon: ShoppingCart,   aliases: { ru: ['магазин', 'шоп', 'покупки', 'купить'], en: ['shop', 'store', 'buy', 'purchase'] } },
  inventory:    { path: '/inventory',     icon: ShoppingCart,   aliases: { ru: ['инвентарь', 'вещи', 'предметы', 'мои предметы'], en: ['inventory', 'items', 'my items'] } },
  music:        { path: '/music',         icon: Music,         aliases: { ru: ['музыка', 'плеер', 'музон', 'музло', 'мьюзик', 'песни', 'треки'], en: ['music', 'player', 'songs', 'tracks'] } },
  forum:        { path: '/forum',         icon: MessageSquare, aliases: { ru: ['форум', 'обсуждения', 'темы', 'посты'], en: ['forum', 'discussions', 'posts', 'topics'] } },
  requests:     { path: '/requests',      icon: ArrowUpRight,  aliases: { ru: ['запросы', 'заявки', 'реквесты'], en: ['requests', 'applications'] } },
  about:        { path: '/about',         icon: Globe,         aliases: { ru: ['о клане', 'инфо', 'информация', 'о нас', 'абаут'], en: ['about', 'info', 'information', 'about us'] } },
  achievements: { path: '/achievements',  icon: Star,          aliases: { ru: ['достижения', 'ачивки', 'награды достижений', 'ачивменты'], en: ['achievements', 'awards'] } },
  quests:       { path: '/quests',        icon: Zap,           aliases: { ru: ['квесты', 'задания', 'миссии', 'квест'], en: ['quests', 'missions', 'tasks'] } },
  trading:      { path: '/trading',       icon: Swords,        aliases: { ru: ['торговля', 'трейд', 'трейдинг', 'обмен', 'барахолка'], en: ['trading', 'trade', 'exchange', 'marketplace'] } },
  boosters:     { path: '/boosters',      icon: Zap,           aliases: { ru: ['бустеры', 'бусты', 'ускорители', 'бустер'], en: ['boosters', 'boosts'] } },
  dailyRewards: { path: '/daily-rewards', icon: Gift,          aliases: { ru: ['награды', 'ежедневные', 'дейли', 'ежедневные награды', 'ежедневка'], en: ['daily', 'rewards', 'daily rewards'] } },
  profile:      { path: '/profile',       icon: User,          aliases: { ru: ['профиль', 'мой профиль', 'аккаунт', 'профайл'], en: ['profile', 'my profile', 'account'] } },
  miniGames:    { path: '/mini-games',    icon: Gamepad2,      aliases: { ru: ['мини-игры', 'игры', 'мини игры', 'геймы', 'играть'], en: ['mini games', 'games', 'play', 'minigames'] } },
  clanWars:     { path: '/clan-wars',     icon: Swords,        aliases: { ru: ['войны', 'клановые войны', 'клан войны', 'клан вар', 'соревнования', 'турниры'], en: ['clan wars', 'wars', 'tournaments', 'battles'] } },
};

// ======= ASSISTANT TEXT =======
const AI_TEXT = {
  ru: {
    title: 'Luminary AI',
    subtitle: 'Виртуальный помощник',
    placeholder: 'Спросите что-нибудь...',
    greeting: 'Привет! Я Luminary AI — ваш умный помощник. Могу:\n• 🧭 Навигация — скажите куда перейти\n• ℹ️ Информация — расскажу о разделах\n• 🎵 Управление — помогу с музыкой, профилем\n\nПопробуйте: «открой музыку» или «что такое квесты?»',
    navigating: 'Перехожу на страницу',
    navigated: 'Готово! Вы на странице',
    notUnderstand: 'Не совсем понял. Попробуйте:\n• «открой музыку» — навигация\n• «что такое торговля?» — информация\n• «помощь» — список команд',
    help: '📋 **Доступные команды:**\n\n🧭 **Навигация:** открой [страница]\n   _Примеры: музыка, магазин, профиль, квесты_\n\nℹ️ **Информация:** что такое [страница]?\n   _Расскажу о любом разделе сайта_\n\n🎨 **Прочее:**\n• «помощь» — эта справка\n• «где я?» — текущая страница\n• «список страниц» — все разделы',
    whereAmI: 'Вы сейчас находитесь на странице:',
    pageList: '📑 **Все доступные страницы:**\n',
    voiceOn: 'Голосовое управление включено',
    voiceOff: 'Голосовое управление выключено',
    voiceNotSupported: 'Голосовое управление не поддерживается в вашем браузере',
    thinking: 'Думаю...',
    pageInfo: {
      dashboard: '🏠 **Главная** — центр управления кланом. Обзор статистики, последние новости, топ участников и важные объявления.',
      statistics: '📊 **Статистика** — подробная аналитика клана: графики активности, рост участников, рейтинги и достижения.',
      leaderboard: '🏆 **Рейтинг** — таблица лидеров клана по очкам, активности и достижениям. Сравнивайте себя с другими.',
      members: '👥 **Участники** — список всех участников клана с профилями, ролями и статистикой.',
      news: '📰 **Новости** — все обновления, патч-ноты и объявления от администрации клана.',
      shop: '🛒 **Магазин** — покупайте предметы, бейджи, титулы и роли за LumiCoin.',
      inventory: '🎒 **Инвентарь** — ваши купленные предметы, активные бустеры и коллекционные аитемы.',
      music: '🎵 **Музыка** — слушайте треки с YouTube и SoundCloud прямо на сайте. Создавайте очередь и управляйте плеером.',
      forum: '💬 **Форум** — обсуждайте темы, делитесь идеями и общайтесь с другими участниками клана.',
      requests: '📝 **Запросы** — подавайте заявки в клан и проверяйте их статус.',
      about: '🌐 **О клане** — информация о Luminary, правила, история клана и контакты.',
      achievements: '⭐ **Достижения** — выполняйте задания и получайте уникальные бейджи и награды.',
      quests: '⚡ **Квесты** — ежедневные и еженедельные задания за LumiCoin и опыт.',
      trading: '🤝 **Торговля** — безопасный обмен предметами между участниками клана.',
      boosters: '🚀 **Бустеры** — усилители очков, монет и опыта на время.',
      dailyRewards: '🎁 **Ежедневные награды** — заходите каждый день, чтобы получить бонусы.',
      profile: '👤 **Профиль** — настройте свой профиль: аватар, баннер, описание и соцсети.',
      miniGames: '🎮 **Мини-игры** — играйте в браузерные игры и зарабатывайте LumiCoin.',
      clanWars: '⚔️ **Клановые войны** — турниры и сражения между кланами.',
    },
  },
  en: {
    title: 'Luminary AI',
    subtitle: 'Virtual Assistant',
    placeholder: 'Ask me anything...',
    greeting: 'Hi! I\'m Luminary AI — your smart assistant. I can:\n• 🧭 Navigate — tell me where to go\n• ℹ️ Info — learn about sections\n• 🎵 Manage — help with music, profile\n\nTry: "open music" or "what are quests?"',
    navigating: 'Navigating to',
    navigated: 'Done! You\'re on',
    notUnderstand: 'I didn\'t quite get that. Try:\n• "open music" — navigation\n• "what is trading?" — information\n• "help" — list of commands',
    help: '📋 **Available commands:**\n\n🧭 **Navigate:** open [page]\n   _Examples: music, shop, profile, quests_\n\nℹ️ **Info:** what is [page]?\n   _Learn about any site section_\n\n🎨 **Other:**\n• "help" — this help\n• "where am I?" — current page\n• "page list" — all sections',
    whereAmI: 'You are currently on:',
    pageList: '📑 **All available pages:**\n',
    voiceOn: 'Voice control enabled',
    voiceOff: 'Voice control disabled',
    voiceNotSupported: 'Voice control is not supported in your browser',
    thinking: 'Thinking...',
    pageInfo: {
      dashboard: '🏠 **Dashboard** — clan control center. Statistics overview, latest news, top members and announcements.',
      statistics: '📊 **Statistics** — detailed clan analytics: activity charts, member growth, ratings and achievements.',
      leaderboard: '🏆 **Leaderboard** — clan leader board by points, activity and achievements. Compare yourself with others.',
      members: '👥 **Members** — list of all clan members with profiles, roles and stats.',
      news: '📰 **News** — all updates, patch notes and announcements from clan administration.',
      shop: '🛒 **Shop** — buy items, badges, titles and roles with LumiCoin.',
      inventory: '🎒 **Inventory** — your purchased items, active boosters and collectibles.',
      music: '🎵 **Music** — listen to YouTube and SoundCloud tracks on the site. Create queues and control the player.',
      forum: '💬 **Forum** — discuss topics, share ideas and chat with other clan members.',
      requests: '📝 **Requests** — submit applications to the clan and check their status.',
      about: '🌐 **About** — information about Luminary, rules, history and contacts.',
      achievements: '⭐ **Achievements** — complete tasks and earn unique badges and rewards.',
      quests: '⚡ **Quests** — daily and weekly tasks for LumiCoin and experience.',
      trading: '🤝 **Trading** — safe item exchange between clan members.',
      boosters: '🚀 **Boosters** — points, coins and experience multipliers.',
      dailyRewards: '🎁 **Daily Rewards** — log in every day to get bonuses.',
      profile: '👤 **Profile** — customize your profile: avatar, banner, bio and social links.',
      miniGames: '🎮 **Mini Games** — play browser games and earn LumiCoin.',
      clanWars: '⚔️ **Clan Wars** — tournaments and battles between clans.',
    },
  },
};

// Route display names
const ROUTE_NAMES: Record<string, { ru: string; en: string }> = {
  dashboard:    { ru: '🏠 Главная',       en: '🏠 Dashboard' },
  statistics:   { ru: '📊 Статистика',     en: '📊 Statistics' },
  leaderboard:  { ru: '🏆 Рейтинг',       en: '🏆 Leaderboard' },
  members:      { ru: '👥 Участники',      en: '👥 Members' },
  news:         { ru: '📰 Новости',        en: '📰 News' },
  shop:         { ru: '🛒 Магазин',        en: '🛒 Shop' },
  inventory:    { ru: '🎒 Инвентарь',      en: '🎒 Inventory' },
  music:        { ru: '🎵 Музыка',         en: '🎵 Music' },
  forum:        { ru: '💬 Форум',          en: '💬 Forum' },
  requests:     { ru: '📝 Запросы',        en: '📝 Requests' },
  about:        { ru: '🌐 О клане',        en: '🌐 About' },
  achievements: { ru: '⭐ Достижения',     en: '⭐ Achievements' },
  quests:       { ru: '⚡ Квесты',         en: '⚡ Quests' },
  trading:      { ru: '🤝 Торговля',       en: '🤝 Trading' },
  boosters:     { ru: '🚀 Бустеры',        en: '🚀 Boosters' },
  dailyRewards: { ru: '🎁 Ежедневные',     en: '🎁 Daily Rewards' },
  profile:      { ru: '👤 Профиль',        en: '👤 Profile' },
  miniGames:    { ru: '🎮 Мини-игры',      en: '🎮 Mini Games' },
  clanWars:     { ru: '⚔️ Войны',          en: '⚔️ Clan Wars' },
};

// ======= MESSAGE TYPES =======
interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  action?: 'navigate' | 'info';
  targetPage?: string;
}

// ======= VIRTUAL CURSOR COMPONENT =======
function VirtualCursor({ targetEl, onDone }: { targetEl: HTMLElement | null; onDone: () => void }) {
  const [pos, setPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (!targetEl) { onDone(); return; }
    const rect = targetEl.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    // Animate cursor to target
    const startX = pos.x, startY = pos.y;
    const duration = 600;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // cubic ease out

      setPos({
        x: startX + (targetX - startX) * ease,
        y: startY + (targetY - startY) * ease,
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Add glow effect to target
        targetEl.classList.add('ai-glow-target');
        setTimeout(() => {
          targetEl.classList.remove('ai-glow-target');
          setOpacity(0);
          setTimeout(onDone, 300);
        }, 800);
      }
    };

    requestAnimationFrame(animate);
  }, [targetEl]);

  if (!targetEl) return null;

  return (
    <div
      className="fixed pointer-events-none z-[9999] transition-opacity duration-300"
      style={{ left: pos.x - 12, top: pos.y - 12, opacity }}
    >
      {/* Cursor dot with glow trail */}
      <div className="relative">
        <div className="w-6 h-6 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.8),0_0_40px_rgba(34,211,238,0.4)]" />
        <div className="absolute inset-0 w-6 h-6 rounded-full bg-cyan-400 animate-ping opacity-50" />
      </div>
    </div>
  );
}

// ======= MAIN COMPONENT =======
export function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [cursorTarget, setCursorTarget] = useState<HTMLElement | null>(null);
  const [showCursor, setShowCursor] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pulseButton, setPulseButton] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const msgIdRef = useRef(0);

  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const { language } = useLanguage();
  const txt = AI_TEXT[language];

  // Stop pulse after first open
  useEffect(() => {
    if (isOpen) setPulseButton(false);
  }, [isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  // Show greeting on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: ++msgIdRef.current,
        role: 'assistant',
        text: txt.greeting,
        timestamp: new Date(),
      }]);
    }
  }, [isOpen]);

  // ======= COMMAND PROCESSOR =======
  const processCommand = useCallback((userText: string): ChatMessage => {
    const text = userText.toLowerCase().trim();
    const lang = language;

    // HELP
    if (['помощь', 'help', 'команды', 'commands', '?', 'хелп'].some(w => text.includes(w))) {
      return { id: ++msgIdRef.current, role: 'assistant', text: txt.help, timestamp: new Date() };
    }

    // WHERE AM I
    if (['где я', 'where am i', 'где нахожусь', 'current page', 'текущая'].some(w => text.includes(w))) {
      const currentKey = Object.entries(ROUTES).find(([, v]) => v.path === location)?.[0];
      const pageName = currentKey ? ROUTE_NAMES[currentKey]?.[lang] || currentKey : location;
      return { id: ++msgIdRef.current, role: 'assistant', text: `${txt.whereAmI} **${pageName}** (${location})`, timestamp: new Date() };
    }

    // PAGE LIST
    if (['список', 'страницы', 'pages', 'page list', 'все страницы', 'all pages', 'разделы', 'sections'].some(w => text.includes(w))) {
      const list = Object.entries(ROUTE_NAMES)
        .map(([key, names]) => `• ${names[lang]} → \`${ROUTES[key].path}\``)
        .join('\n');
      return { id: ++msgIdRef.current, role: 'assistant', text: txt.pageList + list, timestamp: new Date() };
    }

    // NAVIGATE
    const navPrefixes = lang === 'ru' 
      ? ['открой', 'перейди', 'перейти', 'иди', 'покажи', 'навигация', 'зайди', 'открыть', 'перейди на', 'перейди в', 'go to', 'open']
      : ['open', 'go to', 'go', 'navigate', 'show', 'take me to', 'visit', 'открой', 'перейди'];

    for (const prefix of navPrefixes) {
      if (text.startsWith(prefix)) {
        const target = text.slice(prefix.length).trim();
        const matchedRoute = findRoute(target, lang);
        if (matchedRoute) {
          return {
            id: ++msgIdRef.current,
            role: 'assistant',
            text: `${txt.navigating} **${ROUTE_NAMES[matchedRoute]?.[lang]}**...`,
            timestamp: new Date(),
            action: 'navigate',
            targetPage: matchedRoute,
          };
        }
      }
    }

    // Also check if the entire message is just a page name
    const directMatch = findRoute(text, lang);
    if (directMatch) {
      return {
        id: ++msgIdRef.current, 
        role: 'assistant',
        text: `${txt.navigating} **${ROUTE_NAMES[directMatch]?.[lang]}**...`,
        timestamp: new Date(),
        action: 'navigate',
        targetPage: directMatch,
      };
    }

    // INFO about page
    const infoPrefixes = lang === 'ru'
      ? ['что такое', 'расскажи про', 'расскажи о', 'что за', 'описание', 'инфо о', 'инфо про', 'what is', 'about']
      : ['what is', 'what are', 'tell me about', 'info about', 'describe', 'что такое', 'расскажи'];

    for (const prefix of infoPrefixes) {
      if (text.startsWith(prefix)) {
        const target = text.slice(prefix.length).replace(/[?!.,]*/g, '').trim();
        const matchedRoute = findRoute(target, lang);
        if (matchedRoute) {
          const info = txt.pageInfo[matchedRoute as keyof typeof txt.pageInfo];
          return {
            id: ++msgIdRef.current,
            role: 'assistant',
            text: info || `${ROUTE_NAMES[matchedRoute]?.[lang]}`,
            timestamp: new Date(),
            action: 'info',
            targetPage: matchedRoute,
          };
        }
      }
    }

    // Fallback
    return { id: ++msgIdRef.current, role: 'assistant', text: txt.notUnderstand, timestamp: new Date() };
  }, [language, location, txt]);

  // ======= FIND ROUTE BY TEXT =======
  function findRoute(text: string, lang: 'ru' | 'en'): string | null {
    const normalized = text.toLowerCase().trim();
    if (!normalized) return null;

    // Direct key match
    if (ROUTES[normalized]) return normalized;

    // Alias match (exact)
    for (const [key, route] of Object.entries(ROUTES)) {
      if (route.aliases[lang].some(a => a === normalized)) return key;
      // Also check other language
      const otherLang = lang === 'ru' ? 'en' : 'ru';
      if (route.aliases[otherLang].some(a => a === normalized)) return key;
    }

    // Partial match (contains)
    for (const [key, route] of Object.entries(ROUTES)) {
      if (route.aliases[lang].some(a => normalized.includes(a) || a.includes(normalized))) return key;
    }

    // Path match
    for (const [key, route] of Object.entries(ROUTES)) {
      if (route.path.replace('/', '') === normalized) return key;
    }

    return null;
  }

  // ======= EXECUTE ACTION =======
  const executeAction = useCallback((msg: ChatMessage) => {
    if (msg.action === 'navigate' && msg.targetPage) {
      const route = ROUTES[msg.targetPage];
      if (!route) return;

      // Find nav link on page to point virtual cursor at
      const navLinks = document.querySelectorAll(`a[href="${route.path}"]`);
      const targetEl = navLinks.length > 0 ? (navLinks[0] as HTMLElement) : null;

      if (targetEl) {
        setShowCursor(true);
        setCursorTarget(targetEl);
      } else {
        // No visible link, just navigate directly
        setTimeout(() => {
          setLocation(route.path);
          // Update message with confirmation
          setMessages(prev => prev.map(m => 
            m.id === msg.id 
              ? { ...m, text: `${txt.navigated} **${ROUTE_NAMES[msg.targetPage!]?.[language]}** ✅` }
              : m
          ));
        }, 400);
      }
    }
  }, [setLocation, txt, language]);

  // Cursor animation done → navigate
  const handleCursorDone = useCallback(() => {
    setShowCursor(false);
    if (cursorTarget) {
      const href = cursorTarget.getAttribute('href');
      if (href) {
        setLocation(href);
        setMessages(prev => {
          const lastAssistant = [...prev].reverse().find(m => m.role === 'assistant' && m.action === 'navigate');
          if (!lastAssistant) return prev;
          return prev.map(m => 
            m.id === lastAssistant.id
              ? { ...m, text: `${txt.navigated} **${ROUTE_NAMES[lastAssistant.targetPage!]?.[language]}** ✅` }
              : m
          );
        });
      }
    }
    setCursorTarget(null);
  }, [cursorTarget, setLocation, txt, language]);

  // ======= SEND MESSAGE =======
  const sendMessage = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: ++msgIdRef.current,
      role: 'user',
      text: trimmed,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    // Simulate thinking delay
    setTimeout(() => {
      const response = processCommand(trimmed);
      setMessages(prev => [...prev, response]);
      setIsThinking(false);

      // Execute action if any
      if (response.action) {
        setTimeout(() => executeAction(response), 500);
      }
    }, 300 + Math.random() * 400);
  }, [input, processCommand, executeAction]);

  // ======= VOICE RECOGNITION =======
  const toggleVoice = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setMessages(prev => [...prev, {
        id: ++msgIdRef.current,
        role: 'assistant',
        text: txt.voiceNotSupported,
        timestamp: new Date(),
      }]);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = language === 'ru' ? 'ru-RU' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
      // Auto-send after voice input
      setTimeout(() => {
        const userMsg: ChatMessage = {
          id: ++msgIdRef.current,
          role: 'user',
          text: transcript,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsThinking(true);
        setTimeout(() => {
          const response = processCommand(transcript);
          setMessages(prev => [...prev, response]);
          setIsThinking(false);
          if (response.action) {
            setTimeout(() => executeAction(response), 500);
          }
        }, 300 + Math.random() * 400);
      }, 200);
    };

    recognition.onerror = () => { setIsListening(false); };
    recognition.onend = () => { setIsListening(false); };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, language, processCommand, executeAction, txt]);

  // ======= QUICK ACTION BUTTONS =======
  const quickActions = [
    { label: language === 'ru' ? '🎵 Музыка' : '🎵 Music', cmd: language === 'ru' ? 'открой музыку' : 'open music' },
    { label: language === 'ru' ? '👤 Профиль' : '👤 Profile', cmd: language === 'ru' ? 'открой профиль' : 'open profile' },
    { label: language === 'ru' ? '🛒 Магазин' : '🛒 Shop', cmd: language === 'ru' ? 'открой магазин' : 'open shop' },
    { label: language === 'ru' ? '📋 Помощь' : '📋 Help', cmd: language === 'ru' ? 'помощь' : 'help' },
  ];

  // ======= FORMAT MESSAGE TEXT =======
  function formatMessage(text: string) {
    // Simple markdown-like formatting
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-white/10 px-1 rounded text-xs">$1</code>')
      .replace(/\n/g, '<br/>');
  }

  return (
    <>
      {/* Global CSS for glow effect */}
      <style>{`
        .ai-glow-target {
          animation: aiGlow 0.8s ease-in-out;
          position: relative;
          z-index: 50;
        }
        @keyframes aiGlow {
          0% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0); }
          30% { box-shadow: 0 0 20px 8px rgba(34, 211, 238, 0.6), 0 0 40px 16px rgba(34, 211, 238, 0.3); }
          70% { box-shadow: 0 0 20px 8px rgba(34, 211, 238, 0.6), 0 0 40px 16px rgba(34, 211, 238, 0.3); }
          100% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0); }
        }
        .ai-chat-enter {
          animation: aiChatEnter 0.3s cubic-bezier(0.32, 0.72, 0, 1);
        }
        @keyframes aiChatEnter {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .ai-typing-dot {
          animation: aiTypingDot 1.4s infinite ease-in-out;
        }
        .ai-typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .ai-typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes aiTypingDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        .ai-pulse-ring {
          animation: aiPulseRing 2s ease-out infinite;
        }
        @keyframes aiPulseRing {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>

      {/* Virtual Cursor Overlay */}
      {showCursor && <VirtualCursor targetEl={cursorTarget} onDone={handleCursorDone} />}

      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-[100]">
        {/* Pulse ring */}
        {pulseButton && !isOpen && (
          <div className="absolute inset-0 rounded-full bg-cyan-400/30 ai-pulse-ring" />
        )}
        
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            relative w-14 h-14 rounded-full shadow-2xl transition-all duration-300
            ${isOpen 
              ? 'bg-zinc-800 hover:bg-zinc-700 rotate-0' 
              : 'bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/30'
            }
          `}
          size="icon"
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Bot className="w-7 h-7 text-white" />
          )}
          {/* Online indicator */}
          {!isOpen && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white shadow-sm" />
          )}
        </Button>
      </div>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[100] w-[380px] max-w-[calc(100vw-48px)] ai-chat-enter">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col" style={{ maxHeight: 'min(600px, calc(100vh - 140px))' }}>
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-b border-white/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white">{txt.title}</h3>
                <p className="text-xs text-white/50">{txt.subtitle}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleVoice}
                className={`h-8 w-8 rounded-lg transition-colors ${isListening ? 'bg-red-500/20 text-red-400' : 'text-white/50 hover:text-white'}`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 rounded-lg text-white/50 hover:text-white"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: '200px', maxHeight: '380px' }}>
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`
                    max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                    ${msg.role === 'user' 
                      ? 'bg-cyan-600/80 text-white rounded-br-md' 
                      : 'bg-white/[0.07] text-white/90 rounded-bl-md border border-white/5'
                    }
                  `}>
                    <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }} />
                    {msg.action === 'navigate' && msg.targetPage && (
                      <button
                        onClick={() => {
                          setLocation(ROUTES[msg.targetPage!].path);
                          setMessages(prev => prev.map(m => 
                            m.id === msg.id 
                              ? { ...m, text: `${txt.navigated} **${ROUTE_NAMES[msg.targetPage!]?.[language]}** ✅` }
                              : m
                          ));
                        }}
                        className="mt-2 flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
                      >
                        <ArrowUpRight className="w-3 h-3" />
                        {language === 'ru' ? 'Перейти сейчас' : 'Go now'}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Thinking indicator */}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.07] rounded-2xl rounded-bl-md px-4 py-3 border border-white/5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-cyan-400 ai-typing-dot" />
                      <div className="w-2 h-2 rounded-full bg-cyan-400 ai-typing-dot" />
                      <div className="w-2 h-2 rounded-full bg-cyan-400 ai-typing-dot" />
                    </div>
                  </div>
                </div>
              )}

              {/* Voice listening indicator */}
              {isListening && (
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    {language === 'ru' ? 'Слушаю...' : 'Listening...'}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {quickActions.map((qa) => (
                  <button
                    key={qa.cmd}
                    onClick={() => {
                      setInput(qa.cmd);
                      setTimeout(() => {
                        const userMsg: ChatMessage = {
                          id: ++msgIdRef.current,
                          role: 'user',
                          text: qa.cmd,
                          timestamp: new Date(),
                        };
                        setMessages(prev => [...prev, userMsg]);
                        setInput('');
                        setIsThinking(true);
                        setTimeout(() => {
                          const response = processCommand(qa.cmd);
                          setMessages(prev => [...prev, response]);
                          setIsThinking(false);
                          if (response.action) setTimeout(() => executeAction(response), 500);
                        }, 400);
                      }, 50);
                    }}
                    className="px-3 py-1.5 rounded-full text-xs bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border border-white/5 transition-all"
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-white/10">
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                className="flex items-center gap-2"
              >
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={txt.placeholder}
                  className="flex-1 bg-white/[0.06] border-white/10 text-white placeholder:text-white/30 rounded-xl h-10 text-sm focus:ring-cyan-500/30"
                  autoFocus
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isThinking}
                  className="h-10 w-10 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
