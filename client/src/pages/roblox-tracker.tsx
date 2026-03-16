import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Gamepad2, Clock, Users, UserPlus, Eye, ExternalLink, User, Calendar, Shield, Loader2, History, XCircle, Globe, Star, Trash2, ThumbsUp, Server, Heart, BarChart3, ArrowLeft, Trophy, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

interface RobloxUser {
  id: number;
  name: string;
  displayName: string;
  description: string;
  created: string;
  isBanned: boolean;
  avatar: string | null;
  status: string;
  statusColor: string;
  lastOnline: string | null;
  lastLocation: string;
  currentGame: {
    id: number;
    name: string;
    description: string;
    playing: number;
    visits: number;
    maxPlayers: number;
    placeId: number;
    rootPlaceId: number;
    creator: string;
  } | null;
  stats: {
    friends: number;
    followers: number;
    followings: number;
  };
  presence: {
    type: number;
    placeId: number | null;
    rootPlaceId: number | null;
    universeId: number | null;
    gameId: string | null;
  } | null;
  profileUrl: string;
}

interface SearchResult {
  success: boolean;
  error?: string;
  user?: RobloxUser;
}

// --- localStorage история поиска (индивидуальная для каждого браузера) ---
const HISTORY_KEY = 'roblox_tracker_history';
const MAX_HISTORY = 20;

interface HistoryItem {
  username: string;
  odId: number;
  avatar: string | null;
  timestamp: number;
}

function getLocalHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveToLocalHistory(username: string, userId: number, avatar: string | null) {
  const history = getLocalHistory();
  const existing = history.findIndex(h => h.odId === userId);
  if (existing !== -1) history.splice(existing, 1);
  history.unshift({ username, odId: userId, avatar, timestamp: Date.now() });
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function clearLocalHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

// --- localStorage история поиска игр ---
const GAME_HISTORY_KEY = 'roblox_game_history';

interface GameHistoryItem {
  name: string;
  universeId: number;
  placeId: number;
  thumbnail: string | null;
  timestamp: number;
}

function getGameHistory(): GameHistoryItem[] {
  try {
    const raw = localStorage.getItem(GAME_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveToGameHistory(name: string, universeId: number, placeId: number, thumbnail: string | null) {
  const history = getGameHistory();
  const existing = history.findIndex(h => h.universeId === universeId);
  if (existing !== -1) history.splice(existing, 1);
  history.unshift({ name, universeId, placeId, thumbnail, timestamp: Date.now() });
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  localStorage.setItem(GAME_HISTORY_KEY, JSON.stringify(history));
}

function clearGameHistory() {
  localStorage.removeItem(GAME_HISTORY_KEY);
}

// --- Компонент аватара с обработкой ошибок загрузки ---
function RobloxAvatar({ src, name, size = 'lg' }: { src: string | null; name: string; size?: 'sm' | 'lg' }) {
  const [imgError, setImgError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  
  useEffect(() => { setImgError(false); setLoaded(false); }, [src]);
  
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-12 w-12';
  
  if (!src || imgError) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
        <User className={`${iconSize} text-white`} />
      </div>
    );
  }
  
  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/30 to-orange-500/30 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-white/50 animate-spin" />
        </div>
      )}
      <img 
        src={src} 
        alt={name} 
        className={`w-full h-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity`}
        onError={() => setImgError(true)}
        onLoad={() => setLoaded(true)}
        loading="eager"
      />
    </>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatRelativeTime(dateStr: string, t: (key: string) => string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return t('roblox.justNow');
  if (minutes < 60) return `${minutes} ${t('roblox.minAgo')}`;
  if (hours < 24) return `${hours} ${t('roblox.hoursAgo')}`;
  if (days < 30) return `${days} ${t('roblox.daysAgo')}`;
  return formatDate(dateStr);
}

function formatNumber(num: number) {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}

function StatusIndicator({ status, color }: { status: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-500 shadow-green-500/50',
    blue: 'bg-blue-500 shadow-blue-500/50',
    orange: 'bg-orange-500 shadow-orange-500/50',
    gray: 'bg-gray-500 shadow-gray-500/50',
  };
  
  const bgBadge: Record<string, string> = {
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  
  return (
    <Badge variant="outline" className={`${bgBadge[color] || bgBadge.gray} gap-1.5`}>
      <span className={`w-2.5 h-2.5 rounded-full ${colorMap[color] || colorMap.gray} shadow-lg animate-pulse`} />
      {status}
    </Badge>
  );
}

function AccountAge(props: { created: string; t: (key: string) => string }) {
  const { t } = props;
  const created = new Date(props.created);
  const now = new Date();
  const years = now.getFullYear() - created.getFullYear();
  const months = now.getMonth() - created.getMonth();
  const totalMonths = years * 12 + months;
  
  if (totalMonths < 1) return <span>{t('roblox.lessThanMonth')}</span>;
  if (totalMonths < 12) return <span>{totalMonths} {t('roblox.months')}</span>;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return <span>{y} {t('roblox.years')} {m > 0 ? `${m} ${t('roblox.months')}` : ''}</span>;
}

export default function RobloxTracker() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'player' | 'games'>('player');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(getLocalHistory());
  
  // Game search state
  const [gameSearchInput, setGameSearchInput] = useState('');
  const [gameSearchQuery, setGameSearchQuery] = useState('');
  const [gameHistory, setGameHistory] = useState<GameHistoryItem[]>(getGameHistory());
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [playerSearchInput, setPlayerSearchInput] = useState('');
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

  const { data: result, isLoading, isError, error } = useQuery<SearchResult>({
    queryKey: ['/api/roblox/lookup', searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/roblox/lookup/${encodeURIComponent(searchQuery)}`);
      return res.json();
    },
    enabled: searchQuery.length >= 3 && activeTab === 'player',
    refetchInterval: autoRefresh ? 30000 : false,
    staleTime: 15000,
  });

  // Game search query
  const { data: gameResults, isLoading: gamesLoading } = useQuery<{ success: boolean; games: any[] }>({
    queryKey: ['/api/roblox/games/search', gameSearchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/roblox/games/search?keyword=${encodeURIComponent(gameSearchQuery)}`);
      return res.json();
    },
    enabled: gameSearchQuery.length >= 2 && activeTab === 'games',
    staleTime: 30000,
  });

  // Game details query (when a game is selected)
  const { data: gameDetails, isLoading: detailsLoading } = useQuery<{ success: boolean; game: any }>({
    queryKey: ['/api/roblox/game/details', selectedGameId],
    queryFn: async () => {
      const res = await fetch(`/api/roblox/game/details/${selectedGameId}`);
      return res.json();
    },
    enabled: !!selectedGameId && activeTab === 'games',
    staleTime: 30000,
  });

  // Player lookup in games tab
  const { data: playerInGameResult, isLoading: playerInGameLoading } = useQuery<SearchResult>({
    queryKey: ['/api/roblox/lookup', playerSearchQuery, 'game-tab'],
    queryFn: async () => {
      const res = await fetch(`/api/roblox/lookup/${encodeURIComponent(playerSearchQuery)}`);
      return res.json();
    },
    enabled: playerSearchQuery.length >= 3 && activeTab === 'games',
    staleTime: 15000,
  });

  // Player game badges — когда есть и игрок и выбранная игра
  const playerUserId = playerInGameResult?.success ? playerInGameResult.user?.id : null;
  const { data: playerGameBadges, isLoading: badgesLoading } = useQuery<{ success: boolean; gameBadgesTotal: number; earnedBadges: any[]; earnedCount: number }>({
    queryKey: ['/api/roblox/player-game-badges', playerUserId, selectedGameId],
    queryFn: async () => {
      const res = await fetch(`/api/roblox/player-game-badges/${playerUserId}/${selectedGameId}`);
      return res.json();
    },
    enabled: !!playerUserId && !!selectedGameId && activeTab === 'games',
    staleTime: 30000,
  });

  // Сохраняем в локальную историю при успешном поиске
  useEffect(() => {
    if (result?.success && result.user) {
      saveToLocalHistory(result.user.name, result.user.id, result.user.avatar);
      setHistory(getLocalHistory());
    }
  }, [result]);

  // Сохраняем игры в историю
  useEffect(() => {
    if (gameResults?.success && gameResults.games?.length > 0) {
      const g = gameResults.games[0];
      saveToGameHistory(g.name, g.universeId, g.placeId || g.rootPlaceId, g.thumbnail || null);
      setGameHistory(getGameHistory());
    }
  }, [gameResults]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed.length >= 3) {
      setSearchQuery(trimmed);
    }
  };

  const handleHistoryClick = (username: string) => {
    setSearchInput(username);
    setSearchQuery(username);
  };

  const handleClearHistory = () => {
    clearLocalHistory();
    setHistory([]);
  };

  const handleGameSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = gameSearchInput.trim();
    if (trimmed.length >= 2) {
      setGameSearchQuery(trimmed);
      setSelectedGameId(null);
    }
  };

  const handleGameHistoryClick = (item: GameHistoryItem) => {
    setGameSearchInput(item.name);
    setSelectedGameId(item.universeId);
  };

  const handleClearGameHistory = () => {
    clearGameHistory();
    setGameHistory([]);
  };

  const handleSelectGame = (game: any) => {
    setSelectedGameId(game.universeId);
    saveToGameHistory(game.name, game.universeId, game.placeId || game.rootPlaceId, game.thumbnail || null);
    setGameHistory(getGameHistory());
  };

  const handlePlayerInGameSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = playerSearchInput.trim();
    if (trimmed.length >= 3) {
      setPlayerSearchQuery(trimmed);
    }
  };

  const user = result?.user;

  // Авто-обновление текста
  useEffect(() => {
    if (user && (user.presence?.type === 1 || user.presence?.type === 2)) {
      setAutoRefresh(true);
    } else {
      setAutoRefresh(false);
    }
  }, [user]);

  return (
    <div className="container mx-auto px-4 py-8 relative">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 backdrop-blur-sm">
            <Gamepad2 className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold neon-text-cyan tracking-wide">
            {t('roblox.title')}
          </h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          {t('roblox.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-8">
        <Button
          variant={activeTab === 'player' ? 'default' : 'outline'}
          onClick={() => setActiveTab('player')}
          className={`gap-2 ${activeTab === 'player' ? 'bg-gradient-to-r from-red-600 to-orange-600' : 'glass glass-border'}`}
        >
          <User className="h-4 w-4" />
          {t('roblox.playerSearch')}
        </Button>
        <Button
          variant={activeTab === 'games' ? 'default' : 'outline'}
          onClick={() => setActiveTab('games')}
          className={`gap-2 ${activeTab === 'games' ? 'bg-gradient-to-r from-blue-600 to-cyan-600' : 'glass glass-border'}`}
        >
          <Gamepad2 className="h-4 w-4" />
          {t('roblox.gameSearch')}
        </Button>
      </div>

      {/* Game Search Tab */}
      {activeTab === 'games' && (
        <>
          {/* Game search form */}
          <form onSubmit={handleGameSearch} className="max-w-2xl mx-auto mb-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t('roblox.gamePlaceholder')}
                  value={gameSearchInput}
                  onChange={(e) => setGameSearchInput(e.target.value)}
                  className="pl-10 h-12 text-base glass glass-border"
                  maxLength={200}
                />
              </div>
              <Button 
                type="submit" 
                disabled={gamesLoading || gameSearchInput.trim().length < 2} 
                className="h-12 px-6 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
              >
                {gamesLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                <span className="ml-2 hidden sm:inline">{t('roblox.find')}</span>
              </Button>
            </div>
          </form>

          {/* Player search within games tab */}
          <form onSubmit={handlePlayerInGameSearch} className="max-w-2xl mx-auto mb-8">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={selectedGameId ? t('roblox.playerBadgesPlaceholder') : t('roblox.playerInGamePlaceholder')}
                  value={playerSearchInput}
                  onChange={(e) => setPlayerSearchInput(e.target.value)}
                  className="pl-10 h-11 text-sm glass glass-border"
                  maxLength={20}
                />
              </div>
              <Button 
                type="submit" 
                disabled={playerInGameLoading || playerSearchInput.trim().length < 3} 
                variant="outline"
                className="h-11 px-4 glass glass-border"
              >
                {playerInGameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </form>

          {/* Player in-game result */}
          {playerInGameResult?.success && playerInGameResult.user && (
            <div className="max-w-2xl mx-auto mb-6">
              <Card className="glass glass-border border-purple-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                      <RobloxAvatar src={playerInGameResult.user.avatar} name={playerInGameResult.user.name} size="sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{playerInGameResult.user.displayName}</span>
                        <StatusIndicator status={playerInGameResult.user.status} color={playerInGameResult.user.statusColor} />
                      </div>
                      {playerInGameResult.user.currentGame ? (
                        <p className="text-xs text-blue-400">
                          🎮 {t('roblox.playsIn')}: <strong>{playerInGameResult.user.currentGame.name}</strong>
                          {playerInGameResult.user.currentGame.placeId > 0 && (
                            <a href={`https://www.roblox.com/games/${playerInGameResult.user.currentGame.placeId}`} target="_blank" rel="noopener noreferrer" className="ml-2 underline">{t('roblox.open')}</a>
                          )}
                        </p>
                      ) : playerInGameResult.user.presence?.type === 2 ? (
                        <p className="text-xs text-muted-foreground">🎮 {t('roblox.inGameHidden')}</p>
                      ) : playerInGameResult.user.presence?.type === 1 ? (
                        <p className="text-xs text-green-400">🟢 {t('roblox.onlineOnSite')}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">⚫ {t('roblox.offlineStatus')}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Player game badges */}
                  {selectedGameId && badgesLoading && (
                    <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> {t('roblox.loadingBadges')}
                    </div>
                  )}
                  {selectedGameId && playerGameBadges?.success && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Trophy className="h-4 w-4 text-yellow-400" />
                        <span className="text-xs font-semibold">
                          {t('roblox.badgesInGame')}: {playerGameBadges.earnedCount} / {playerGameBadges.gameBadgesTotal}
                        </span>
                        {playerGameBadges.gameBadgesTotal > 0 && (
                          <Badge variant="secondary" className="text-xs ml-auto">
                            {Math.round((playerGameBadges.earnedCount / playerGameBadges.gameBadgesTotal) * 100)}%
                          </Badge>
                        )}
                      </div>
                      {playerGameBadges.earnedBadges.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {playerGameBadges.earnedBadges.slice(0, 12).map((badge: any) => (
                            <div key={badge.id} className="glass glass-border rounded px-2 py-1 text-xs flex items-center gap-1" title={badge.description || badge.name}>
                              <Award className="h-3 w-3 text-yellow-400 flex-shrink-0" />
                              <span className="truncate max-w-[120px]">{badge.name}</span>
                            </div>
                          ))}
                          {playerGameBadges.earnedBadges.length > 12 && (
                            <span className="text-xs text-muted-foreground px-2 py-1">+{playerGameBadges.earnedBadges.length - 12} {t('roblox.more')}</span>
                          )}
                        </div>
                      )}
                      {playerGameBadges.gameBadgesTotal > 0 && playerGameBadges.earnedCount === 0 && (
                        <p className="text-xs text-muted-foreground">{t('roblox.noBadges')}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Game search history */}
          {gameHistory.length > 0 && !gameResults?.games?.length && !selectedGameId && (
            <div className="max-w-2xl mx-auto mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <History className="h-4 w-4" />
                  <span>{t('roblox.recentGames')}</span>
                </div>
                <button onClick={handleClearGameHistory} className="text-xs text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1">
                  <Trash2 className="h-3 w-3" />
                  {t('roblox.clear')}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {gameHistory.map((item) => (
                  <button
                    key={item.universeId}
                    onClick={() => handleGameHistoryClick(item)}
                    className="glass glass-border rounded-lg px-3 py-1.5 text-sm hover:bg-primary/10 transition-colors flex items-center gap-2"
                  >
                    {item.thumbnail ? (
                      <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0">
                        <img src={item.thumbnail} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    ) : (
                      <Gamepad2 className="h-4 w-4 text-blue-400" />
                    )}
                    {item.name.length > 25 ? item.name.substring(0, 25) + '...' : item.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Game details view */}
          {selectedGameId && (
            <div className="max-w-4xl mx-auto mb-6">
              <Button variant="ghost" size="sm" className="mb-4 gap-1" onClick={() => setSelectedGameId(null)}>
                <ArrowLeft className="h-4 w-4" /> {t('roblox.backToResults')}
              </Button>
              
              {detailsLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                </div>
              )}
              
              {gameDetails?.success && gameDetails.game && (
                <Card className="glass glass-border overflow-hidden">
                  <div className="relative">
                    <div className="absolute inset-0 h-24 bg-gradient-to-br from-blue-600/20 via-cyan-500/10 to-purple-600/20" />
                    <CardContent className="relative pt-6 pb-6">
                      <div className="flex flex-col sm:flex-row gap-5">
                        {/* Game thumbnail */}
                        <div className="flex-shrink-0 w-32 h-32 rounded-xl overflow-hidden ring-2 ring-blue-500/30 shadow-xl bg-gray-900">
                          {gameDetails.game.thumbnail ? (
                            <img src={gameDetails.game.thumbnail} alt={gameDetails.game.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Gamepad2 className="h-12 w-12 text-blue-400/50" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-2xl font-bold mb-1">{gameDetails.game.name}</h2>
                          <p className="text-sm text-muted-foreground mb-1">{t('roblox.by')} {gameDetails.game.creator}</p>
                          {gameDetails.game.genre && (
                            <Badge variant="secondary" className="text-xs mb-2">{gameDetails.game.genre}</Badge>
                          )}
                          {gameDetails.game.description && (
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{gameDetails.game.description}</p>
                          )}
                          <div className="flex gap-2 mt-2">
                            <a href={`roblox://experiences/start?placeId=${gameDetails.game.placeId}`}>
                              <Button size="sm" className="gap-1.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500">
                                <Gamepad2 className="h-4 w-4" /> {t('roblox.play')}
                              </Button>
                            </a>
                            <a href={`https://www.roblox.com/games/${gameDetails.game.placeId}`} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="gap-1.5 glass glass-border">
                                <ExternalLink className="h-4 w-4" /> Roblox
                              </Button>
                            </a>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                  
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 pt-0">
                    <div className="glass glass-border rounded-lg p-3 text-center">
                      <Users className="h-4 w-4 mx-auto text-green-400 mb-1" />
                      <div className="text-lg font-bold">{formatNumber(gameDetails.game.playing)}</div>
                      <div className="text-xs text-muted-foreground">{t('roblox.nowPlayingCount')}</div>
                    </div>
                    <div className="glass glass-border rounded-lg p-3 text-center">
                      <Eye className="h-4 w-4 mx-auto text-blue-400 mb-1" />
                      <div className="text-lg font-bold">{formatNumber(gameDetails.game.visits)}</div>
                      <div className="text-xs text-muted-foreground">{t('roblox.totalVisits')}</div>
                    </div>
                    <div className="glass glass-border rounded-lg p-3 text-center">
                      <Heart className="h-4 w-4 mx-auto text-red-400 mb-1" />
                      <div className="text-lg font-bold">{formatNumber(gameDetails.game.favoritedCount)}</div>
                      <div className="text-xs text-muted-foreground">{t('roblox.favorites')}</div>
                    </div>
                    <div className="glass glass-border rounded-lg p-3 text-center">
                      <ThumbsUp className="h-4 w-4 mx-auto text-yellow-400 mb-1" />
                      <div className="text-lg font-bold">
                        {gameDetails.game.upVotes + gameDetails.game.downVotes > 0
                          ? Math.round((gameDetails.game.upVotes / (gameDetails.game.upVotes + gameDetails.game.downVotes)) * 100) + '%'
                          : '—'
                        }
                      </div>
                      <div className="text-xs text-muted-foreground">{t('roblox.rating')}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 pt-0">
                    <div className="glass glass-border rounded-lg p-3 text-center">
                      <BarChart3 className="h-4 w-4 mx-auto text-purple-400 mb-1" />
                      <div className="text-sm font-bold">👍 {formatNumber(gameDetails.game.upVotes)}</div>
                      <div className="text-xs text-muted-foreground">{t('roblox.likes')}</div>
                    </div>
                    <div className="glass glass-border rounded-lg p-3 text-center">
                      <Users className="h-4 w-4 mx-auto text-orange-400 mb-1" />
                      <div className="text-sm font-bold">{gameDetails.game.maxPlayers}</div>
                      <div className="text-xs text-muted-foreground">{t('roblox.maxPlayers')}</div>
                    </div>
                    <div className="glass glass-border rounded-lg p-3 text-center">
                      <Calendar className="h-4 w-4 mx-auto text-cyan-400 mb-1" />
                      <div className="text-sm font-bold">{gameDetails.game.created ? formatDate(gameDetails.game.created) : '—'}</div>
                      <div className="text-xs text-muted-foreground">{t('roblox.createdDate')}</div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Game search loading */}
          {gamesLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-blue-400 mb-4" />
              <p className="text-muted-foreground">{t('roblox.searchingGames')}</p>
            </div>
          )}

          {/* Game results */}
          {!selectedGameId && gameResults?.success && gameResults.games && gameResults.games.length > 0 && (
            <div className="max-w-4xl mx-auto">
              <p className="text-sm text-muted-foreground mb-4">{t('roblox.found')}: {gameResults.games.length} {t('roblox.games')}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gameResults.games.map((game: any, idx: number) => (
                  <Card key={game.universeId || idx} className="glass glass-border hover:border-blue-500/40 transition-colors cursor-pointer" onClick={() => handleSelectGame(game)}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
                          {game.thumbnail ? (
                            <img src={game.thumbnail} alt={game.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Gamepad2 className="h-6 w-6 text-blue-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{game.name}</h3>
                          <p className="text-xs text-muted-foreground">{game.creatorName}</p>
                          
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Users className="h-3 w-3" />
                              {formatNumber(game.playerCount || 0)} {t('roblox.inGameLabel')}
                            </Badge>
                            {game.visits > 0 && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Eye className="h-3 w-3" />
                                {formatNumber(game.visits)} {t('roblox.visitsLabel')}
                              </Badge>
                            )}
                            {game.totalUpVotes > 0 && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <ThumbsUp className="h-3 w-3" />
                                {game.totalUpVotes && game.totalDownVotes 
                                  ? Math.round((game.totalUpVotes / (game.totalUpVotes + game.totalDownVotes)) * 100) + '%'
                                  : '?'
                                }
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex gap-2 mt-3">
                            <a href={`roblox://experiences/start?placeId=${game.placeId || game.rootPlaceId}`} onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" className="gap-1.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-xs h-7">
                                <Gamepad2 className="h-3 w-3" />
                                {t('roblox.play')}
                              </Button>
                            </a>
                            <a href={`https://www.roblox.com/games/${game.placeId || game.rootPlaceId}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="outline" className="gap-1.5 glass glass-border text-xs h-7">
                                <ExternalLink className="h-3 w-3" />
                                {t('roblox.page')}
                              </Button>
                            </a>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* No game results */}
          {!selectedGameId && gameResults?.success && gameResults.games && gameResults.games.length === 0 && (
            <div className="max-w-2xl mx-auto text-center py-12">
              <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{t('roblox.gamesNotFound')}</p>
            </div>
          )}

          {/* Empty game search state */}
          {!gamesLoading && !gameSearchQuery && !selectedGameId && gameHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 mb-6">
                <Search className="h-16 w-16 text-blue-400/50" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('roblox.gameSearchTitle')}</h3>
              <p className="text-muted-foreground max-w-md">
                {t('roblox.gameSearchDesc')}
              </p>
            </div>
          )}
        </>
      )}

      {/* Player Search Tab */}
      {activeTab === 'player' && (<>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-8">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('roblox.searchPlaceholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10 h-12 text-base glass glass-border"
              maxLength={20}
              data-ai="roblox-search"
            />
          </div>
          <Button 
            type="submit" 
            disabled={isLoading || searchInput.trim().length < 3} 
            className="h-12 px-6 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500"
            data-ai="roblox-find"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            <span className="ml-2 hidden sm:inline">{t('roblox.find')}</span>
          </Button>
        </div>
      </form>

      {/* Search History (локальная) */}
      {history.length > 0 && !user && (
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <History className="h-4 w-4" />
              <span>{t('roblox.recentSearches')}</span>
            </div>
            <button 
              onClick={handleClearHistory}
              className="text-xs text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
              {t('roblox.clear')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map((item) => (
              <button
                key={item.odId}
                onClick={() => handleHistoryClick(item.username)}
                className="glass glass-border rounded-lg px-3 py-1.5 text-sm hover:bg-primary/10 transition-colors flex items-center gap-2"
              >
                {item.avatar && (
                  <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                    <img src={item.avatar} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
                {item.username}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">{t('roblox.loadingData')}</p>
        </div>
      )}

      {/* Error */}
      {result && !result.success && (
        <div className="max-w-2xl mx-auto">
          <Card className="glass glass-border border-red-500/30">
            <CardContent className="flex items-center gap-4 py-8">
              <XCircle className="h-12 w-12 text-red-400 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-red-400">{t('roblox.userNotFound')}</h3>
                <p className="text-muted-foreground">{result.error || t('roblox.checkUsername')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results */}
      {user && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
          
          {/* Profile Card */}
          <Card className="glass glass-border overflow-hidden">
            <div className="relative">
              {/* Background gradient */}
              <div className="absolute inset-0 h-32 bg-gradient-to-br from-red-600/20 via-orange-500/10 to-purple-600/20" />
              
              <CardContent className="relative pt-6 pb-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-28 h-28 rounded-2xl overflow-hidden ring-4 ring-background shadow-2xl relative">
                      <RobloxAvatar src={user.avatar} name={user.name} size="lg" />
                    </div>
                    {/* Status dot */}
                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-3 border-background
                      ${user.statusColor === 'green' ? 'bg-green-500' : 
                        user.statusColor === 'blue' ? 'bg-blue-500' : 
                        user.statusColor === 'orange' ? 'bg-orange-500' : 'bg-gray-500'}
                    `} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-2">
                      <h2 className="text-2xl font-bold">{user.displayName}</h2>
                      {user.displayName !== user.name && (
                        <span className="text-muted-foreground text-sm">@{user.name}</span>
                      )}
                      <StatusIndicator status={user.status} color={user.statusColor} />
                      {user.isBanned && (
                        <Badge variant="destructive" className="gap-1">
                          <Shield className="h-3 w-3" />
                          {t('roblox.banned')}
                        </Badge>
                      )}
                    </div>

                    {user.description && (
                      <p className="text-sm text-muted-foreground mb-3 max-w-lg line-clamp-2">
                        {user.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        {t('roblox.created')}: {formatDate(user.created)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {t('roblox.age')}: <AccountAge created={user.created} t={t} />
                      </span>
                      {user.lastOnline && user.presence?.type === 0 && (
                        <span className="flex items-center gap-1.5">
                          <Globe className="h-4 w-4" />
                          {t('roblox.lastSeen')}: {formatRelativeTime(user.lastOnline, t)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Profile link */}
                  <a 
                    href={user.profileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                  >
                    <Button variant="outline" className="gap-2 glass glass-border">
                      <ExternalLink className="h-4 w-4" />
                      {t('roblox.profile')}
                    </Button>
                  </a>
                </div>
              </CardContent>
            </div>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="glass glass-border text-center py-4">
              <div className="flex flex-col items-center gap-1">
                <Users className="h-5 w-5 text-blue-400" />
                <span className="text-2xl font-bold">{formatNumber(user.stats.friends)}</span>
                <span className="text-xs text-muted-foreground">{t('roblox.friends')}</span>
              </div>
            </Card>
            <Card className="glass glass-border text-center py-4">
              <div className="flex flex-col items-center gap-1">
                <UserPlus className="h-5 w-5 text-purple-400" />
                <span className="text-2xl font-bold">{formatNumber(user.stats.followers)}</span>
                <span className="text-xs text-muted-foreground">{t('roblox.followers')}</span>
              </div>
            </Card>
            <Card className="glass glass-border text-center py-4">
              <div className="flex flex-col items-center gap-1">
                <Eye className="h-5 w-5 text-green-400" />
                <span className="text-2xl font-bold">{formatNumber(user.stats.followings)}</span>
                <span className="text-xs text-muted-foreground">{t('roblox.following')}</span>
              </div>
            </Card>
          </div>

          {/* Current Game */}
          {user.currentGame && (
            <Card className="glass glass-border overflow-hidden border-blue-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-blue-400">
                  <Gamepad2 className="h-5 w-5" />
                  {t('roblox.nowPlaying')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">{user.currentGame.name}</h3>
                    {user.currentGame.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{user.currentGame.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-sm">
                      {user.currentGame.playing > 0 && (
                        <Badge variant="secondary" className="gap-1">
                          <Users className="h-3 w-3" />
                          {formatNumber(user.currentGame.playing)} {t('roblox.playing')}
                        </Badge>
                      )}
                      {user.currentGame.visits > 0 && (
                        <Badge variant="secondary" className="gap-1">
                          <Eye className="h-3 w-3" />
                          {formatNumber(user.currentGame.visits)} {t('roblox.visits')}
                        </Badge>
                      )}
                      {user.currentGame.creator && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3" />
                          {user.currentGame.creator}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {/* Протокольная ссылка для открытия Roblox и присоединения */}
                    {(user.currentGame.placeId > 0) && (
                      <a
                        href={`roblox://experiences/start?placeId=${user.currentGame.rootPlaceId || user.currentGame.placeId}${user.presence?.gameId ? `&gameInstanceId=${user.presence.gameId}` : ''}`}
                      >
                        <Button className="w-full gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500">
                          <Gamepad2 className="h-4 w-4" />
                          {t('roblox.join')}
                        </Button>
                      </a>
                    )}
                    {(user.currentGame.placeId > 0) && (
                      <a
                        href={`https://www.roblox.com/games/${user.currentGame.rootPlaceId || user.currentGame.placeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" className="w-full gap-2 glass glass-border">
                          <ExternalLink className="h-4 w-4" />
                          {t('roblox.gamePage')}
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* В игре, но нет данных */}
          {user.presence?.type === 2 && !user.currentGame && (
            <Card className="glass glass-border border-blue-500/30">
              <CardContent className="flex items-center gap-4 py-6">
                <Gamepad2 className="h-8 w-8 text-blue-400 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-blue-400">{t('roblox.inGame')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {user.lastLocation || t('roblox.gameHidden')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Location Info (if online but not in game) */}
          {user.presence?.type === 1 && user.lastLocation && (
            <Card className="glass glass-border border-green-500/30">
              <CardContent className="flex items-center gap-4 py-6">
                <Globe className="h-8 w-8 text-green-400 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-400">{t('roblox.online')}</h3>
                  <p className="text-sm text-muted-foreground">{user.lastLocation || t('roblox.onRoblox')}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Offline / Studio */}
          {user.presence?.type === 0 && (
            <Card className="glass glass-border border-gray-500/30">
              <CardContent className="flex items-center gap-4 py-6">
                <Clock className="h-8 w-8 text-gray-400 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-400">{t('roblox.offline')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {user.lastOnline 
                      ? `${t('roblox.lastOnline')}: ${formatRelativeTime(user.lastOnline, t)}`
                      : t('roblox.unknownTime')
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {user.presence?.type === 3 && (
            <Card className="glass glass-border border-orange-500/30">
              <CardContent className="flex items-center gap-4 py-6">
                <Gamepad2 className="h-8 w-8 text-orange-400 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-orange-400">{t('roblox.inStudio')}</h3>
                  <p className="text-sm text-muted-foreground">{t('roblox.developing')}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Auto-refresh indicator */}
          {autoRefresh && (
            <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {t('roblox.autoRefresh')}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !result && !searchQuery && activeTab === 'player' && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-6 rounded-3xl bg-gradient-to-br from-red-500/10 to-orange-500/10 mb-6">
            <Gamepad2 className="h-16 w-16 text-red-400/50" />
          </div>
          <h3 className="text-xl font-semibold mb-2">{t('roblox.startSearch')}</h3>
          <p className="text-muted-foreground max-w-md">
            {t('roblox.startSearchDesc')}
          </p>
        </div>
      )}

      </>)}
    </div>
  );
}
