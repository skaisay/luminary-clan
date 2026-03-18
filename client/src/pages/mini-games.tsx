import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Gamepad2, Coins, Loader2, RotateCw, Hand, Scissors,
  Circle, Square, ChevronRight, History, Dices, CircleDot,
  ArrowUp, ArrowDown, Hash, Cherry, Maximize, Minimize,
  Crown, Timer, Zap, Target, TrendingUp, HelpCircle, Award
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";

// ============= GOLD CARD SYSTEM =============

const GOLD_CARD_KEY = 'luminary_gold_card';
const GOLD_CARD_COST = 500;
const GOLD_CARD_DURATION_MS = 30 * 60 * 1000; // 30 минут
const GOLD_CARD_BONUS = 0.2; // +20% к выигрышу

interface GoldCardData {
  activatedAt: number;
  expiresAt: number;
}

function getGoldCard(): GoldCardData | null {
  try {
    const raw = localStorage.getItem(GOLD_CARD_KEY);
    if (!raw) return null;
    const data: GoldCardData = JSON.parse(raw);
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(GOLD_CARD_KEY);
      return null;
    }
    return data;
  } catch { return null; }
}

function activateGoldCard() {
  const now = Date.now();
  const data: GoldCardData = { activatedAt: now, expiresAt: now + GOLD_CARD_DURATION_MS };
  localStorage.setItem(GOLD_CARD_KEY, JSON.stringify(data));
  return data;
}

function GoldCardBanner() {
  const { user, updateBalance } = useAuth();
  const { language } = useLanguage();
  const isRu = (language || 'ru') === 'ru';
  const [card, setCard] = useState<GoldCardData | null>(getGoldCard);
  const [timeLeft, setTimeLeft] = useState('');
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const balance = user?.lumiCoins ?? 0;

  useEffect(() => {
    const interval = setInterval(() => {
      const c = getGoldCard();
      setCard(c);
      if (c) {
        const left = c.expiresAt - Date.now();
        if (left <= 0) { setCard(null); return; }
        const mins = Math.floor(left / 60000);
        const secs = Math.floor((left % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleBuy = async () => {
    if (!user?.discordId || balance < GOLD_CARD_COST) return;
    setBuying(true);
    setError('');
    try {
      const res = await apiRequest("POST", "/api/mini-games/buy-gold-card", {
        discordId: user.discordId,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error");
      }
      const data = await res.json();
      activateGoldCard();
      setCard(getGoldCard());
      updateBalance(data.newBalance);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBuying(false);
    }
  };

  if (card) {
    return (
      <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-gradient-to-r from-yellow-500/15 to-amber-500/15 border border-yellow-500/30 mb-3 mx-auto">
        <Crown className="h-4 w-4 text-yellow-400" />
        <span className="text-sm font-semibold text-yellow-400">{isRu ? 'Золотая карта' : 'Gold Card'}</span>
        <Badge className="bg-yellow-500/20 text-yellow-300 text-xs gap-1">
          <Timer className="h-3 w-3" /> {timeLeft}
        </Badge>
        <span className="text-xs text-yellow-400/70">+20% {isRu ? 'к выигрышу' : 'bonus'}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-gradient-to-r from-yellow-900/20 to-amber-900/20 border border-yellow-500/15 mb-3 mx-auto flex-wrap">
      <Crown className="h-4 w-4 text-yellow-500/60" />
      <span className="text-xs text-muted-foreground">{isRu ? 'Золотая карта: +20% к выигрышу на 30 мин' : 'Gold Card: +20% winnings for 30 min'}</span>
      <Button size="sm" variant="outline" className="h-6 text-xs gap-1 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
        onClick={handleBuy} disabled={buying || balance < GOLD_CARD_COST || !user?.discordId}>
        {buying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Coins className="h-3 w-3" />}
        {GOLD_CARD_COST} LC
      </Button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

// ============= SHARED: Balance bar =============

function BalanceBar() {
  const { user } = useAuth();
  return (
    <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20 mb-3 w-fit mx-auto">
      <Coins className="h-4 w-4 text-yellow-500" />
      <span className="font-semibold text-sm">{(user?.lumiCoins ?? 0).toLocaleString()}</span>
      <span className="text-xs text-muted-foreground">LC</span>
    </div>
  );
}

// ============= LOCAL GAME HISTORY =============

interface GameHistoryItem {
  id: string;
  game: string;
  bet: number;
  reward: number;
  result: string;
  playedAt: string;
}

const HISTORY_KEY = 'luminary_game_history';

function getGameHistory(): GameHistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveGameHistory(entry: { game: string; bet: number; reward: number; result: string }) {
  const history = getGameHistory();
  history.unshift({
    id: Date.now().toString(),
    game: entry.game,
    bet: entry.bet,
    reward: entry.reward,
    result: entry.result,
    playedAt: new Date().toISOString(),
  });
  if (history.length > 100) history.length = 100;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  window.dispatchEvent(new Event('game-history-updated'));
}

// ============= WHEEL OF FORTUNE =============

const WHEEL_SEGMENTS = [
  { label: "x0", multiplier: 0, color: "#64748b" },
  { label: "x0.5", multiplier: 0.5, color: "#ef4444" },
  { label: "x0", multiplier: 0, color: "#475569" },
  { label: "x1", multiplier: 1, color: "#06b6d4" },
  { label: "x0.5", multiplier: 0.5, color: "#dc2626" },
  { label: "x0", multiplier: 0, color: "#334155" },
  { label: "x1.5", multiplier: 1.5, color: "#22c55e" },
  { label: "x0.5", multiplier: 0.5, color: "#f97316" },
  { label: "x0", multiplier: 0, color: "#1e293b" },
  { label: "x1", multiplier: 1, color: "#6366f1" },
  { label: "x2", multiplier: 2, color: "#eab308" },
  { label: "x3", multiplier: 3, color: "#a855f7" },
];

function WheelOfFortune() {
  const { user, updateBalance } = useAuth();
  const { t, language } = useLanguage();
  const isRu = (language || 'ru') === 'ru';
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<{ reward: number; label: string; payout: number } | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const balance = user?.lumiCoins ?? 0;

  const spinMutation = useMutation({
    mutationFn: async () => {
      const gc = getGoldCard();
      const res = await apiRequest("POST", "/api/mini-games/wheel", {
        discordId: user?.discordId,
        bet: betAmount,
        hasGoldCard: !!gc,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error");
      }
      return res.json();
    },
    onSuccess: (data: { segmentIndex: number; reward: number; multiplier: number; newBalance: number }) => {
      setError("");
      const segPerAngle = 360 / WHEEL_SEGMENTS.length;
      const segCenter = data.segmentIndex * segPerAngle + segPerAngle / 2;
      const desiredMod = ((0 - segCenter) % 360 + 360) % 360;
      const currentMod = ((rotation % 360) + 360) % 360;
      let delta = desiredMod - currentMod;
      if (delta < 0) delta += 360;
      const spins = 5 + Math.floor(Math.random() * 3);
      const finalRotation = rotation + spins * 360 + delta;
      setRotation(finalRotation);
      setSpinning(true);
      setTimeout(() => {
        setSpinning(false);
        const seg = WHEEL_SEGMENTS[data.segmentIndex];
        const payout = Math.floor(betAmount * seg.multiplier);
        setResult({ reward: data.reward, label: seg.label, payout });
        updateBalance(data.newBalance);
        saveGameHistory({ game: 'wheel', bet: betAmount, reward: data.reward, result: seg.label });
      }, 4000);
    },
    onError: (err: Error) => {
      if (err.message.includes("Not enough")) {
        setError(isRu ? "Недостаточно LumiCoins!" : "Not enough LumiCoins!");
      } else {
        setError(err.message);
      }
    }
  });

  // Draw wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 8;
    const segAngle = (2 * Math.PI) / WHEEL_SEGMENTS.length;
    ctx.clearRect(0, 0, size, size);
    WHEEL_SEGMENTS.forEach((seg, i) => {
      const startAngle = i * segAngle;
      const endAngle = startAngle + segAngle;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.fillStyle = seg.color;
      ctx.fill();
      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(startAngle + segAngle / 2);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(seg.label, radius * 0.65, 5);
      ctx.restore();
    });
    ctx.beginPath();
    ctx.arc(center, center, 20, 0, Math.PI * 2);
    ctx.fillStyle = "#1f2937";
    ctx.fill();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.stroke();
  }, []);

  const canPlay = balance >= betAmount && !spinning && !spinMutation.isPending && !!user?.discordId;

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="relative">
          <div className={`absolute top-1/2 -right-3 -translate-y-1/2 z-10 transition-all duration-500 ${
            !spinning && result ? 'drop-shadow-[0_0_12px_rgba(250,204,21,0.8)] scale-110' : ''
          }`}>
            <ChevronRight className="h-8 w-8 text-yellow-400 drop-shadow-lg" style={{ transform: 'scaleX(-1)' }} />
          </div>
          <div
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? "transform 4s cubic-bezier(0.2, 0.8, 0.3, 1)" : "none",
            }}
          >
            <canvas ref={canvasRef} width={280} height={280} className="rounded-full" />
          </div>
        </div>
      </div>

      {/* Bet controls */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">{t('miniGames.bet')}:</span>
        <div className="flex gap-1">
          {[100, 1000, 10000].map(val => (
            <Button key={val} size="sm" variant={betAmount === val ? "default" : "outline"}
              onClick={() => { setBetAmount(val); setError(""); }}
              disabled={spinning} className="text-xs" data-ai={`wheel-bet-${val}`}>
              {val >= 1000 ? `${val/1000}K` : val}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => { setBetAmount(balance); setError(""); }}
            disabled={spinning} className="text-xs font-bold">MAX</Button>
        </div>
        <Input type="number" min={1} value={betAmount}
          onChange={(e) => { setBetAmount(Math.max(1, parseInt(e.target.value) || 1)); setError(""); }}
          disabled={spinning} className="w-28 h-8 text-xs text-center" data-ai="wheel-bet-custom" />
      </div>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      {result && (
        <div className="text-center space-y-2">
          <p className={`text-3xl font-bold ${result.reward > 0 ? 'text-green-400' : result.reward < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
            {result.label}
          </p>
          <Badge className={`text-base px-4 py-1 gap-1 ${
            result.reward > 0 ? 'bg-green-500/20 text-green-400' : 
            result.reward < 0 ? 'bg-red-500/20 text-red-400' : ''
          }`}>
            <Coins className="h-4 w-4" />
            {result.reward > 0 ? `+${result.reward}` : result.reward === 0 ? '0' : result.reward} LC
          </Badge>
        </div>
      )}

      <div className="flex justify-center">
        <Button size="lg"
          onClick={() => { setResult(null); setError(""); spinMutation.mutate(); }}
          disabled={!canPlay} className="gap-2" data-ai="wheel-spin">
          {spinning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
          {spinning ? (isRu ? 'Крутится...' : 'Spinning...') : 
            balance < betAmount ? (isRu ? 'Мало монет' : 'Not enough') :
            `${isRu ? 'Крутить' : 'Spin'} (${betAmount} LC)`
          }
        </Button>
      </div>
    </div>
  );
}

// ============= ROCK PAPER SCISSORS =============

type RPSChoice = "rock" | "paper" | "scissors";

const RPS_ICONS: Record<RPSChoice, any> = {
  rock: Circle,
  paper: Square,
  scissors: Scissors,
};
const RPS_LABELS: Record<RPSChoice, { ru: string; en: string }> = {
  rock: { ru: "Камень", en: "Rock" },
  paper: { ru: "Бумага", en: "Paper" },
  scissors: { ru: "Ножницы", en: "Scissors" },
};

function RockPaperScissors() {
  const { user, updateBalance } = useAuth();
  const { t, language } = useLanguage();
  const isRu = (language || 'ru') === 'ru';
  const [playerChoice, setPlayerChoice] = useState<RPSChoice | null>(null);
  const [botChoice, setBotChoice] = useState<RPSChoice | null>(null);
  const [resultText, setResultText] = useState("");
  const [reward, setReward] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [betAmount, setBetAmount] = useState(10);
  const [error, setError] = useState("");
  const balance = user?.lumiCoins ?? 0;

  const playMutation = useMutation({
    mutationFn: async (choice: RPSChoice) => {
      const gc = getGoldCard();
      const res = await apiRequest("POST", "/api/mini-games/rps", {
        discordId: user?.discordId, choice, bet: betAmount, hasGoldCard: !!gc,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error");
      }
      return res.json();
    },
    onSuccess: (data: { botChoice: RPSChoice; result: string; reward: number; newBalance: number }) => {
      setError("");
      setTimeout(() => {
        setBotChoice(data.botChoice);
        setReward(data.reward);
        setResultText(
          data.result === "win" ? (isRu ? 'Победа!' : 'Win!') :
          data.result === "lose" ? (isRu ? 'Проигрыш' : 'Lose') : (isRu ? 'Ничья' : 'Draw')
        );
        setAnimating(false);
        updateBalance(data.newBalance);
        saveGameHistory({ game: 'rps', bet: betAmount, reward: data.reward, result: data.result });
      }, 1500);
    },
    onError: (err: Error) => {
      setAnimating(false);
      if (err.message.includes("Not enough")) {
        setError(isRu ? "Недостаточно LumiCoins!" : "Not enough LumiCoins!");
      } else {
        setError(err.message);
      }
    }
  });

  const handlePlay = (choice: RPSChoice) => {
    if (balance < betAmount) {
      setError(isRu ? "Недостаточно LumiCoins!" : "Not enough LumiCoins!");
      return;
    }
    setPlayerChoice(choice);
    setBotChoice(null);
    setResultText("");
    setReward(0);
    setAnimating(true);
    setError("");
    playMutation.mutate(choice);
  };

  const resultColor = resultText.includes('Побед') || resultText.includes('Win') ? "text-green-400" :
    resultText.includes('Проиг') || resultText.includes('Lose') ? "text-red-400" : "text-yellow-400";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-8">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">{isRu ? 'Ты' : 'You'}</p>
          <div className={`w-20 h-20 rounded-xl border-2 flex items-center justify-center transition-all ${
            playerChoice ? "border-primary bg-primary/10" : "border-muted bg-muted/20"
          }`}>
            {playerChoice ? (() => { const Icon = RPS_ICONS[playerChoice]; return <Icon className="h-8 w-8" />; })() 
              : <Hand className="h-8 w-8 text-muted-foreground/30" />}
          </div>
          {playerChoice && <p className="text-xs mt-1">{RPS_LABELS[playerChoice][language as 'ru' | 'en'] || RPS_LABELS[playerChoice].ru}</p>}
        </div>
        <div className="text-2xl font-bold text-muted-foreground">VS</div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">{isRu ? 'Бот' : 'Bot'}</p>
          <div className={`w-20 h-20 rounded-xl border-2 flex items-center justify-center transition-all ${
            botChoice ? "border-red-500 bg-red-500/10" :
            animating ? "border-muted animate-pulse bg-muted/20" : "border-muted bg-muted/20"
          }`}>
            {animating ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> :
             botChoice ? (() => { const Icon = RPS_ICONS[botChoice]; return <Icon className="h-8 w-8" />; })() 
              : <Gamepad2 className="h-8 w-8 text-muted-foreground/30" />}
          </div>
          {botChoice && <p className="text-xs mt-1">{RPS_LABELS[botChoice][language as 'ru' | 'en'] || RPS_LABELS[botChoice].ru}</p>}
        </div>
      </div>

      {resultText && (
        <div className="text-center space-y-1">
          <p className={`text-xl font-bold ${resultColor}`}>{resultText}</p>
          <Badge className={`gap-1 ${reward > 0 ? 'bg-green-500/20 text-green-400' : reward < 0 ? 'bg-red-500/20 text-red-400' : ''}`}>
            <Coins className="h-3 w-3" /> {reward > 0 ? `+${reward}` : reward} LC
          </Badge>
        </div>
      )}

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      <div className="flex items-center justify-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">{t('miniGames.bet')}:</span>
        <div className="flex gap-1">
          {[100, 1000, 10000].map(val => (
            <Button key={val} size="sm" variant={betAmount === val ? "default" : "outline"}
              onClick={() => { setBetAmount(val); setError(""); }} disabled={animating}
              className="text-xs" data-ai={`rps-bet-${val}`}>{val >= 1000 ? `${val/1000}K` : val}</Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => { setBetAmount(balance); setError(""); }}
            disabled={animating} className="text-xs font-bold">MAX</Button>
        </div>
        <Input type="number" min={1} value={betAmount}
          onChange={(e) => { setBetAmount(Math.max(1, parseInt(e.target.value) || 1)); setError(""); }}
          disabled={animating} className="w-28 h-8 text-xs text-center" data-ai="rps-bet-custom" />
      </div>

      <div className="flex justify-center gap-3">
        {(["rock", "paper", "scissors"] as RPSChoice[]).map(choice => {
          const Icon = RPS_ICONS[choice];
          return (
            <Button key={choice} size="lg" variant="outline"
              onClick={() => handlePlay(choice)}
              disabled={animating || playMutation.isPending || !user?.discordId || balance < betAmount}
              className="flex-col h-auto py-3 px-6 gap-1" data-ai={`rps-${choice}`}>
              <Icon className="h-6 w-6" />
              <span className="text-xs">{RPS_LABELS[choice][language as 'ru' | 'en'] || RPS_LABELS[choice].ru}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

// ============= COIN FLIP =============

function CoinFlip() {
  const { user, updateBalance } = useAuth();
  const { language } = useLanguage();
  const isRu = (language || 'ru') === 'ru';
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<{ coin: string; won: boolean; reward: number } | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [error, setError] = useState("");
  const balance = user?.lumiCoins ?? 0;

  const flipMutation = useMutation({
    mutationFn: async (guess: "heads" | "tails") => {
      const gc = getGoldCard();
      const res = await apiRequest("POST", "/api/mini-games/coinflip", {
        discordId: user?.discordId, bet: betAmount, guess, hasGoldCard: !!gc,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error");
      }
      return res.json();
    },
    onSuccess: (data: { coin: string; won: boolean; reward: number; newBalance: number }) => {
      setError("");
      setFlipping(true);
      setTimeout(() => {
        setFlipping(false);
        setResult(data);
        updateBalance(data.newBalance);
        saveGameHistory({ game: 'coinflip', bet: betAmount, reward: data.reward, result: data.won ? 'win' : 'lose' });
      }, 1500);
    },
    onError: (err: Error) => {
      setError(err.message.includes("Not enough") ? (isRu ? "Недостаточно LC!" : "Not enough LC!") : err.message);
    }
  });

  const canPlay = balance >= betAmount && !flipping && !flipMutation.isPending && !!user?.discordId;

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className={`w-28 h-28 rounded-full border-4 flex items-center justify-center text-4xl transition-all duration-500 ${
          flipping ? "animate-spin border-yellow-400 bg-yellow-400/20" :
          result ? (result.won ? "border-green-400 bg-green-400/10" : "border-red-400 bg-red-400/10") :
          "border-yellow-500/30 bg-yellow-500/10"
        }`}>
          {flipping ? "🪙" : result ? (result.coin === "heads" ? "👑" : "🌙") : "🪙"}
        </div>
      </div>

      {result && !flipping && (
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            {isRu ? `Выпало: ${result.coin === 'heads' ? 'Орёл' : 'Решка'}` : `Result: ${result.coin === 'heads' ? 'Heads' : 'Tails'}`}
          </p>
          <p className={`text-xl font-bold ${result.won ? 'text-green-400' : 'text-red-400'}`}>
            {result.won ? (isRu ? 'Победа!' : 'Win!') : (isRu ? 'Проигрыш' : 'Lose')}
          </p>
          <Badge className={`gap-1 ${result.reward > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            <Coins className="h-3 w-3" /> {result.reward > 0 ? `+${result.reward}` : result.reward} LC
          </Badge>
        </div>
      )}

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      <div className="flex items-center justify-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">{isRu ? 'Ставка' : 'Bet'}:</span>
        <div className="flex gap-1">
          {[100, 1000, 10000].map(val => (
            <Button key={val} size="sm" variant={betAmount === val ? "default" : "outline"}
              onClick={() => { setBetAmount(val); setError(""); }} disabled={flipping} className="text-xs">{val >= 1000 ? `${val/1000}K` : val}</Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => { setBetAmount(balance); setError(""); }}
            disabled={flipping} className="text-xs font-bold">MAX</Button>
        </div>
        <Input type="number" min={1} value={betAmount}
          onChange={(e) => { setBetAmount(Math.max(1, parseInt(e.target.value) || 1)); setError(""); }}
          disabled={flipping} className="w-28 h-8 text-xs text-center" />
      </div>

      <div className="flex justify-center gap-4">
        <Button size="lg" variant="outline"
          onClick={() => { setResult(null); flipMutation.mutate("heads"); }}
          disabled={!canPlay} className="flex-col h-auto py-3 px-8 gap-1" data-ai="coin-heads">
          <span className="text-2xl">👑</span>
          <span className="text-xs">{isRu ? 'Орёл' : 'Heads'}</span>
        </Button>
        <Button size="lg" variant="outline"
          onClick={() => { setResult(null); flipMutation.mutate("tails"); }}
          disabled={!canPlay} className="flex-col h-auto py-3 px-8 gap-1" data-ai="coin-tails">
          <span className="text-2xl">🌙</span>
          <span className="text-xs">{isRu ? 'Решка' : 'Tails'}</span>
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {isRu ? 'Угадай сторону — выигрыш x2' : 'Guess the side — win x2'}
      </p>
    </div>
  );
}

// ============= DICE =============

function DiceGame() {
  const { user, updateBalance } = useAuth();
  const { language } = useLanguage();
  const isRu = (language || 'ru') === 'ru';
  const [rolling, setRolling] = useState(false);
  const [diceResult, setDiceResult] = useState<number | null>(null);
  const [gameResult, setGameResult] = useState<{ won: boolean; reward: number } | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [error, setError] = useState("");
  const [rollAnim, setRollAnim] = useState(0);
  const animRef = useRef<number | null>(null);
  const balance = user?.lumiCoins ?? 0;

  const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

  // Rapid face cycling during roll
  useEffect(() => {
    if (rolling) {
      let frame = 0;
      const tick = () => {
        frame++;
        setRollAnim(prev => (prev + 1) % 6);
        animRef.current = window.setTimeout(tick, 80 + frame * 8);
      };
      tick();
      return () => { if (animRef.current) clearTimeout(animRef.current); };
    }
  }, [rolling]);

  const rollMutation = useMutation({
    mutationFn: async (guess: string) => {
      const gc = getGoldCard();
      const res = await apiRequest("POST", "/api/mini-games/dice", {
        discordId: user?.discordId, bet: betAmount, guess, hasGoldCard: !!gc,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error");
      }
      return res.json();
    },
    onSuccess: (data: { roll: number; won: boolean; reward: number; newBalance: number }) => {
      setError("");
      setRolling(true);
      setTimeout(() => {
        setRolling(false);
        setDiceResult(data.roll);
        setGameResult({ won: data.won, reward: data.reward });
        updateBalance(data.newBalance);
        saveGameHistory({ game: 'dice', bet: betAmount, reward: data.reward, result: `${data.roll} (${data.won ? 'win' : 'lose'})` });
      }, 1500);
    },
    onError: (err: Error) => {
      setError(err.message.includes("Not enough") ? (isRu ? "Недостаточно LC!" : "Not enough LC!") : err.message);
    }
  });

  const canPlay = balance >= betAmount && !rolling && !rollMutation.isPending && !!user?.discordId;

  const displayFace = rolling ? DICE_FACES[rollAnim] : diceResult ? DICE_FACES[diceResult - 1] : null;
  const borderColor = rolling ? "border-purple-400" : diceResult ? (gameResult?.won ? "border-green-400" : "border-red-400") : "border-muted";
  const bgColor = rolling ? "bg-purple-400/10" : diceResult ? (gameResult?.won ? "bg-green-400/10" : "bg-red-400/10") : "bg-muted/10";

  return (
    <div className="space-y-6">
      {/* Dice cube visual */}
      <div className="flex justify-center" style={{ perspective: '300px' }}>
        <div
          className={`w-24 h-24 rounded-xl border-2 flex items-center justify-center transition-colors ${borderColor} ${bgColor}`}
          style={{
            transformStyle: 'preserve-3d',
            animation: rolling ? 'diceRoll 0.4s ease-in-out infinite' : 'none',
          }}
        >
          <span className={`text-5xl transition-all duration-200 ${
            rolling ? 'scale-110' : diceResult ? 'scale-100' : 'opacity-40'
          }`}>
            {displayFace || '🎲'}
          </span>
        </div>
      </div>
      <style>{`
        @keyframes diceRoll {
          0%   { transform: rotateX(0deg) rotateZ(0deg); }
          25%  { transform: rotateX(90deg) rotateZ(45deg); }
          50%  { transform: rotateX(180deg) rotateZ(0deg); }
          75%  { transform: rotateX(270deg) rotateZ(-45deg); }
          100% { transform: rotateX(360deg) rotateZ(0deg); }
        }
      `}</style>

      {gameResult && !rolling && (
        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">
            {isRu ? `Выпало: ${diceResult}` : `Rolled: ${diceResult}`}
          </p>
          <p className={`text-xl font-bold ${gameResult.won ? 'text-green-400' : 'text-red-400'}`}>
            {gameResult.won ? (isRu ? 'Победа!' : 'Win!') : (isRu ? 'Проигрыш' : 'Lose')}
          </p>
          <Badge className={`gap-1 ${gameResult.reward > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            <Coins className="h-3 w-3" /> {gameResult.reward > 0 ? `+${gameResult.reward}` : gameResult.reward} LC
          </Badge>
        </div>
      )}

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      <div className="flex items-center justify-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">{isRu ? 'Ставка' : 'Bet'}:</span>
        <div className="flex gap-1">
          {[10, 25, 50, 100].map(val => (
            <Button key={val} size="sm" variant={betAmount === val ? "default" : "outline"}
              onClick={() => { setBetAmount(val); setError(""); }} disabled={rolling} className="text-xs">{val >= 1000 ? `${val/1000}K` : val}</Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => { setBetAmount(balance); setError(""); }}
            disabled={rolling} className="text-xs font-bold">MAX</Button>
        </div>
        <Input type="number" min={1} value={betAmount}
          onChange={(e) => { setBetAmount(Math.max(1, parseInt(e.target.value) || 1)); setError(""); }}
          disabled={rolling} className="w-28 h-8 text-xs text-center" />
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
        <Button size="lg" variant="outline" onClick={() => { setGameResult(null); setDiceResult(null); rollMutation.mutate("high"); }}
          disabled={!canPlay} className="gap-2" data-ai="dice-high">
          <ArrowUp className="h-4 w-4" /> {isRu ? 'Больше 3' : 'High (4-6)'}
        </Button>
        <Button size="lg" variant="outline" onClick={() => { setGameResult(null); setDiceResult(null); rollMutation.mutate("low"); }}
          disabled={!canPlay} className="gap-2" data-ai="dice-low">
          <ArrowDown className="h-4 w-4" /> {isRu ? 'Меньше 4' : 'Low (1-3)'}
        </Button>
        <Button size="lg" variant="outline" onClick={() => { setGameResult(null); setDiceResult(null); rollMutation.mutate("even"); }}
          disabled={!canPlay} className="gap-2" data-ai="dice-even">
          <Hash className="h-4 w-4" /> {isRu ? 'Чётное' : 'Even'}
        </Button>
        <Button size="lg" variant="outline" onClick={() => { setGameResult(null); setDiceResult(null); rollMutation.mutate("odd"); }}
          disabled={!canPlay} className="gap-2" data-ai="dice-odd">
          <CircleDot className="h-4 w-4" /> {isRu ? 'Нечётное' : 'Odd'}
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {isRu ? 'Угадай результат — выигрыш x1.8' : 'Guess the result — win x1.8'}
      </p>
    </div>
  );
}

// ============= SLOT MACHINE =============

const SLOT_SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "🔔", "⭐", "💎", "7️⃣", "🎰"];

function SlotMachine() {
  const { user, updateBalance } = useAuth();
  const { language } = useLanguage();
  const isRu = (language || 'ru') === 'ru';
  const [spinning, setSpinning] = useState(false);
  const [grid, setGrid] = useState<string[][] | null>(null);
  const [displayGrid, setDisplayGrid] = useState<string[][]>([
    ["❓", "❓", "❓"],
    ["❓", "❓", "❓"],
    ["❓", "❓", "❓"],
  ]);
  const [result, setResult] = useState<{ reward: number; multiplier: number; desc: string } | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [error, setError] = useState("");
  const [reelsStopped, setReelsStopped] = useState([false, false, false]);
  const animRef = useRef<number | null>(null);
  const balance = user?.lumiCoins ?? 0;

  // Spinning animation — random symbols cycling per column
  useEffect(() => {
    if (!spinning) return;
    let frame = 0;
    const tick = () => {
      frame++;
      setDisplayGrid(prev => {
        const newGrid = prev.map(row => [...row]);
        for (let col = 0; col < 3; col++) {
          if (reelsStopped[col]) continue;
          for (let row = 0; row < 3; row++) {
            newGrid[row][col] = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
          }
        }
        return newGrid;
      });
      animRef.current = window.setTimeout(tick, 60 + frame * 3);
    };
    tick();
    return () => { if (animRef.current) clearTimeout(animRef.current); };
  }, [spinning, reelsStopped]);

  const spinMutation = useMutation({
    mutationFn: async () => {
      const gc = getGoldCard();
      const res = await apiRequest("POST", "/api/mini-games/slots", {
        discordId: user?.discordId, bet: betAmount, hasGoldCard: !!gc,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error");
      }
      return res.json();
    },
    onSuccess: (data: { grid: string[][]; multiplier: number; reward: number; resultDesc: string; newBalance: number }) => {
      setError("");
      setGrid(data.grid);
      // Stop reels one by one
      setTimeout(() => {
        setReelsStopped([true, false, false]);
        setDisplayGrid(prev => prev.map((row, r) => [data.grid[r][0], row[1], row[2]]));
      }, 800);
      setTimeout(() => {
        setReelsStopped([true, true, false]);
        setDisplayGrid(prev => prev.map((row, r) => [data.grid[r][0], data.grid[r][1], row[2]]));
      }, 1400);
      setTimeout(() => {
        setReelsStopped([true, true, true]);
        setDisplayGrid(data.grid);
        setSpinning(false);
        setResult({ reward: data.reward, multiplier: data.multiplier, desc: data.resultDesc });
        updateBalance(data.newBalance);
        saveGameHistory({ game: 'slots', bet: betAmount, reward: data.reward, result: data.resultDesc });
      }, 2000);
    },
    onError: (err: Error) => {
      setSpinning(false);
      setReelsStopped([false, false, false]);
      if (err.message.includes("Not enough")) {
        setError(isRu ? "Недостаточно LumiCoins!" : "Not enough LumiCoins!");
      } else {
        setError(err.message);
      }
    }
  });

  const handleSpin = () => {
    setResult(null);
    setError("");
    setReelsStopped([false, false, false]);
    setSpinning(true);
    spinMutation.mutate();
  };

  const canPlay = balance >= betAmount && !spinning && !spinMutation.isPending && !!user?.discordId;

  const isWinRow = (rowIdx: number) => {
    if (!grid || spinning) return false;
    const row = grid[rowIdx];
    return row[0] === row[1] && row[1] === row[2];
  };

  return (
    <div className="space-y-4">
      {/* Slot Machine Display */}
      <div className="flex justify-center">
        <div className="relative p-4 rounded-2xl bg-gradient-to-b from-yellow-900/30 via-background to-yellow-900/20 border-2 border-yellow-500/30 shadow-lg shadow-yellow-500/10">
          {/* Payline indicator */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 shadow-lg shadow-red-500/50 z-10" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 shadow-lg shadow-red-500/50 z-10" />

          <div className="grid grid-rows-3 gap-1">
            {displayGrid.map((row, rowIdx) => (
              <div key={rowIdx} className={`flex gap-1 p-1 rounded-lg transition-all ${
                rowIdx === 1 ? "bg-yellow-500/10 border border-yellow-500/20" : ""
              } ${isWinRow(rowIdx) ? "ring-2 ring-green-400 bg-green-400/10" : ""}`}>
                {row.map((sym, colIdx) => (
                  <div
                    key={colIdx}
                    className={`w-16 h-16 md:w-20 md:h-20 rounded-lg border flex items-center justify-center text-3xl md:text-4xl transition-all ${
                      spinning && !reelsStopped[colIdx]
                        ? "border-yellow-500/40 bg-yellow-500/5 scale-95"
                        : "border-border/50 bg-background/50"
                    }`}
                  >
                    <span className={spinning && !reelsStopped[colIdx] ? "blur-[1px]" : ""}>{sym}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Middle payline label */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-3 px-3 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-[10px] text-red-400">
            PAYLINE
          </div>
        </div>
      </div>

      {/* Result */}
      {result && !spinning && (
        <div className="text-center space-y-2 mt-4">
          <p className={`text-xl font-bold ${result.reward > 0 ? 'text-green-400' : result.reward < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
            {result.desc.includes("JACKPOT") ? "🎰 JACKPOT! 🎰" :
             result.desc.includes("MEGA") ? "🔥 MEGA WIN! 🔥" :
             result.desc.includes("BIG") ? "💎 BIG WIN! 💎" :
             result.reward > 0 ? (isRu ? "Выигрыш!" : "Win!") :
             (isRu ? "Нет совпадений" : "No match")}
          </p>
          {result.multiplier > 0 && (
            <p className="text-sm text-muted-foreground">x{result.multiplier}</p>
          )}
          <Badge className={`text-base px-4 py-1 gap-1 ${
            result.reward > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            <Coins className="h-4 w-4" />
            {result.reward > 0 ? `+${result.reward}` : result.reward} LC
          </Badge>
        </div>
      )}

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      {/* Bet controls */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">{isRu ? 'Ставка' : 'Bet'}:</span>
        <div className="flex gap-1">
          {[100, 1000, 10000].map(val => (
            <Button key={val} size="sm" variant={betAmount === val ? "default" : "outline"}
              onClick={() => { setBetAmount(val); setError(""); }}
              disabled={spinning} className="text-xs">{val >= 1000 ? `${val/1000}K` : val}</Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => { setBetAmount(balance); setError(""); }}
            disabled={spinning} className="text-xs font-bold">MAX</Button>
        </div>
        <Input type="number" min={1} value={betAmount}
          onChange={(e) => { setBetAmount(Math.max(1, parseInt(e.target.value) || 1)); setError(""); }}
          disabled={spinning} className="w-28 h-8 text-xs text-center" />
      </div>

      <div className="flex justify-center">
        <Button size="lg"
          onClick={handleSpin}
          disabled={!canPlay}
          className="gap-2 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white shadow-lg shadow-yellow-600/20"
        >
          {spinning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Cherry className="h-5 w-5" />}
          {spinning ? (isRu ? 'Крутится...' : 'Spinning...') :
           balance < betAmount ? (isRu ? 'Мало монет' : 'Not enough') :
           `${isRu ? 'Крутить' : 'Spin'} (${betAmount} LC)`}
        </Button>
      </div>


    </div>
  );
}

// ============= BLACKJACK (21) =============

function BlackjackGame() {
  const { user, updateBalance } = useAuth();
  const { language } = useLanguage();
  const isRu = (language || 'ru') === 'ru';
  const [dealing, setDealing] = useState(false);
  const [result, setResult] = useState<{
    playerCards: string[]; dealerCards: string[];
    playerValue: number; dealerValue: number;
    result: string; reward: number; multiplier: number;
  } | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [error, setError] = useState("");
  const balance = user?.lumiCoins ?? 0;

  const dealMutation = useMutation({
    mutationFn: async () => {
      const gc = getGoldCard();
      const res = await apiRequest("POST", "/api/mini-games/blackjack", {
        discordId: user?.discordId, bet: betAmount, hasGoldCard: !!gc,
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Error"); }
      return res.json();
    },
    onSuccess: (data) => {
      setError("");
      setDealing(true);
      setTimeout(() => {
        setDealing(false);
        setResult(data);
        updateBalance(data.newBalance);
        saveGameHistory({ game: 'blackjack', bet: betAmount, reward: data.reward, result: data.result });
      }, 1200);
    },
    onError: (err: Error) => {
      setError(err.message.includes("Not enough") ? (isRu ? "Недостаточно LC!" : "Not enough LC!") : err.message);
    }
  });

  const canPlay = balance >= betAmount && !dealing && !dealMutation.isPending && !!user?.discordId;

  const resultColor = result?.result === 'blackjack' ? 'text-yellow-400' :
    result?.result === 'win' ? 'text-green-400' :
    result?.result === 'push' ? 'text-muted-foreground' : 'text-red-400';

  const resultLabel = result?.result === 'blackjack' ? '🃏 BLACKJACK!' :
    result?.result === 'win' ? (isRu ? '🏆 Победа!' : '🏆 Win!') :
    result?.result === 'push' ? (isRu ? '🤝 Ничья' : '🤝 Push') :
    (isRu ? '💀 Проигрыш' : '💀 Lose');

  return (
    <div className="space-y-6">
      {/* Cards display */}
      <div className="flex justify-center gap-8">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">{isRu ? 'Ты' : 'You'}</p>
          <div className="flex gap-1 justify-center min-h-[4rem]">
            {dealing ? (
              <div className="flex gap-1">
                {[1,2].map(i => <div key={i} className="w-10 h-14 rounded-md bg-primary/20 border border-primary/30 animate-pulse flex items-center justify-center text-sm">🂠</div>)}
              </div>
            ) : result ? (
              result.playerCards.map((c, i) => (
                <div key={i} className="w-10 h-14 rounded-md bg-background border border-border flex items-center justify-center text-sm font-bold">
                  <span className={c.includes('♥') || c.includes('♦') ? 'text-red-400' : ''}>{c}</span>
                </div>
              ))
            ) : <div className="w-10 h-14 rounded-md bg-muted/20 border border-muted flex items-center justify-center text-lg opacity-30">🂠</div>}
          </div>
          {result && <p className="text-xs mt-1 font-semibold">{result.playerValue}</p>}
        </div>
        <div className="flex items-center text-lg font-bold text-muted-foreground">VS</div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">{isRu ? 'Дилер' : 'Dealer'}</p>
          <div className="flex gap-1 justify-center min-h-[4rem]">
            {dealing ? (
              <div className="flex gap-1">
                {[1,2].map(i => <div key={i} className="w-10 h-14 rounded-md bg-red-500/20 border border-red-500/30 animate-pulse flex items-center justify-center text-sm">🂠</div>)}
              </div>
            ) : result ? (
              result.dealerCards.map((c, i) => (
                <div key={i} className="w-10 h-14 rounded-md bg-background border border-border flex items-center justify-center text-sm font-bold">
                  <span className={c.includes('♥') || c.includes('♦') ? 'text-red-400' : ''}>{c}</span>
                </div>
              ))
            ) : <div className="w-10 h-14 rounded-md bg-muted/20 border border-muted flex items-center justify-center text-lg opacity-30">🂠</div>}
          </div>
          {result && <p className="text-xs mt-1 font-semibold">{result.dealerValue}</p>}
        </div>
      </div>

      {result && !dealing && (
        <div className="text-center space-y-1">
          <p className={`text-xl font-bold ${resultColor}`}>{resultLabel}</p>
          <Badge className={`gap-1 ${result.reward > 0 ? 'bg-green-500/20 text-green-400' : result.reward < 0 ? 'bg-red-500/20 text-red-400' : ''}`}>
            <Coins className="h-3 w-3" /> {result.reward > 0 ? `+${result.reward}` : result.reward} LC
          </Badge>
        </div>
      )}

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      <div className="flex items-center justify-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">{isRu ? 'Ставка' : 'Bet'}:</span>
        <div className="flex gap-1">
          {[100, 1000, 10000].map(val => (
            <Button key={val} size="sm" variant={betAmount === val ? "default" : "outline"}
              onClick={() => { setBetAmount(val); setError(""); }} disabled={dealing} className="text-xs">{val >= 1000 ? `${val/1000}K` : val}</Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => { setBetAmount(balance); setError(""); }} disabled={dealing} className="text-xs font-bold">MAX</Button>
        </div>
        <Input type="number" min={1} value={betAmount}
          onChange={(e) => { setBetAmount(Math.max(1, parseInt(e.target.value) || 1)); setError(""); }}
          disabled={dealing} className="w-28 h-8 text-xs text-center" />
      </div>

      <div className="flex justify-center">
        <Button size="lg" onClick={() => { setResult(null); setError(""); dealMutation.mutate(); }}
          disabled={!canPlay} className="gap-2">
          {dealing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
          {dealing ? (isRu ? 'Раздача...' : 'Dealing...') :
           balance < betAmount ? (isRu ? 'Мало монет' : 'Not enough') :
           `${isRu ? 'Играть' : 'Deal'} (${betAmount} LC)`}
        </Button>
      </div>
    </div>
  );
}

// ============= NUMBER GUESS =============

function NumberGuessGame() {
  const { user, updateBalance } = useAuth();
  const { language } = useLanguage();
  const isRu = (language || 'ru') === 'ru';
  const [guessing, setGuessing] = useState(false);
  const [guessValue, setGuessValue] = useState(50);
  const [result, setResult] = useState<{
    secret: number; guess: number; diff: number;
    multiplier: number; resultLabel: string; reward: number;
  } | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [error, setError] = useState("");
  const balance = user?.lumiCoins ?? 0;

  const guessMutation = useMutation({
    mutationFn: async () => {
      const gc = getGoldCard();
      const res = await apiRequest("POST", "/api/mini-games/number-guess", {
        discordId: user?.discordId, bet: betAmount, guess: guessValue, hasGoldCard: !!gc,
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Error"); }
      return res.json();
    },
    onSuccess: (data) => {
      setError("");
      setGuessing(true);
      setTimeout(() => {
        setGuessing(false);
        setResult(data);
        updateBalance(data.newBalance);
        saveGameHistory({ game: 'number-guess', bet: betAmount, reward: data.reward, result: `${data.guess}→${data.secret}` });
      }, 1000);
    },
    onError: (err: Error) => {
      setError(err.message.includes("Not enough") ? (isRu ? "Недостаточно LC!" : "Not enough LC!") : err.message);
    }
  });

  const canPlay = balance >= betAmount && !guessing && !guessMutation.isPending && !!user?.discordId;

  return (
    <div className="space-y-6">
      {/* Number display */}
      <div className="flex justify-center gap-6 items-end">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">{isRu ? 'Твоя число' : 'Your guess'}</p>
          <div className={`w-20 h-20 rounded-xl border-2 flex items-center justify-center text-3xl font-bold transition-all ${
            guessing ? 'border-purple-400 bg-purple-400/10 animate-pulse' : 'border-primary bg-primary/10'
          }`}>
            {guessing ? '?' : guessValue}
          </div>
        </div>
        {result && !guessing && (
          <>
            <div className="text-lg font-bold text-muted-foreground pb-6">→</div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">{isRu ? 'Загадано' : 'Secret'}</p>
              <div className={`w-20 h-20 rounded-xl border-2 flex items-center justify-center text-3xl font-bold ${
                result.diff === 0 ? 'border-yellow-400 bg-yellow-400/20' :
                result.diff <= 7 ? 'border-green-400 bg-green-400/10' :
                result.diff <= 25 ? 'border-orange-400 bg-orange-400/10' :
                'border-red-400 bg-red-400/10'
              }`}>
                {result.secret}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Slider */}
      <div className="max-w-xs mx-auto space-y-2">
        <input type="range" min={1} max={100} value={guessValue}
          onChange={e => setGuessValue(Number(e.target.value))}
          disabled={guessing}
          className="w-full accent-primary" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1</span><span>{guessValue}</span><span>100</span>
        </div>
      </div>

      {result && !guessing && (
        <div className="text-center space-y-1">
          <p className={`text-lg font-bold ${result.reward > 0 ? 'text-green-400' : result.reward < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
            {result.resultLabel} ({isRu ? 'разница' : 'diff'}: {result.diff})
          </p>
          {result.multiplier > 0 && <p className="text-xs text-muted-foreground">x{result.multiplier}</p>}
          <Badge className={`gap-1 ${result.reward > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            <Coins className="h-3 w-3" /> {result.reward > 0 ? `+${result.reward}` : result.reward} LC
          </Badge>
        </div>
      )}

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      <div className="flex items-center justify-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">{isRu ? 'Ставка' : 'Bet'}:</span>
        <div className="flex gap-1">
          {[100, 1000, 10000].map(val => (
            <Button key={val} size="sm" variant={betAmount === val ? "default" : "outline"}
              onClick={() => { setBetAmount(val); setError(""); }} disabled={guessing} className="text-xs">{val >= 1000 ? `${val/1000}K` : val}</Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => { setBetAmount(balance); setError(""); }} disabled={guessing} className="text-xs font-bold">MAX</Button>
        </div>
        <Input type="number" min={1} value={betAmount}
          onChange={(e) => { setBetAmount(Math.max(1, parseInt(e.target.value) || 1)); setError(""); }}
          disabled={guessing} className="w-28 h-8 text-xs text-center" />
      </div>

      <div className="flex justify-center">
        <Button size="lg" onClick={() => { setResult(null); setError(""); guessMutation.mutate(); }}
          disabled={!canPlay} className="gap-2">
          {guessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
          {guessing ? (isRu ? 'Угадываем...' : 'Guessing...') :
           balance < betAmount ? (isRu ? 'Мало монет' : 'Not enough') :
           `${isRu ? 'Угадать' : 'Guess'} (${betAmount} LC)`}
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {isRu ? 'Точное попадание = x10. До ±3 = x5. До ±7 = x3. До ±15 = x1.5' : 'Exact = x10. ±3 = x5. ±7 = x3. ±15 = x1.5'}
      </p>
    </div>
  );
}

// ============= CRASH GAME =============

function CrashGame() {
  const { user, updateBalance } = useAuth();
  const { language } = useLanguage();
  const isRu = (language || 'ru') === 'ru';
  const [playing, setPlaying] = useState(false);
  const [cashoutAt, setCashoutAt] = useState(2);
  const [animMultiplier, setAnimMultiplier] = useState(1);
  const [result, setResult] = useState<{
    crashPoint: number; cashoutAt: number; survived: boolean;
    multiplier: number; reward: number;
  } | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [error, setError] = useState("");
  const animRef = useRef<number | null>(null);
  const balance = user?.lumiCoins ?? 0;

  const crashMutation = useMutation({
    mutationFn: async () => {
      const gc = getGoldCard();
      const res = await apiRequest("POST", "/api/mini-games/crash", {
        discordId: user?.discordId, bet: betAmount, cashoutAt, hasGoldCard: !!gc,
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Error"); }
      return res.json();
    },
    onSuccess: (data) => {
      setError("");
      setPlaying(true);
      // Animate multiplier climbing
      const crashAt = data.crashPoint;
      const cashout = data.cashoutAt;
      const target = Math.min(crashAt, cashout);
      let current = 1;
      const speed = 0.05;
      const tick = () => {
        current += speed;
        if (current >= target) {
          current = target;
          setAnimMultiplier(current);
          setTimeout(() => {
            setPlaying(false);
            setResult(data);
            updateBalance(data.newBalance);
            saveGameHistory({ game: 'crash', bet: betAmount, reward: data.reward, result: `x${cashout}→${crashAt.toFixed(2)}` });
          }, 500);
          return;
        }
        setAnimMultiplier(current);
        animRef.current = window.setTimeout(tick, 50);
      };
      tick();
    },
    onError: (err: Error) => {
      setError(err.message.includes("Not enough") ? (isRu ? "Недостаточно LC!" : "Not enough LC!") : err.message);
    }
  });

  useEffect(() => {
    return () => { if (animRef.current) clearTimeout(animRef.current); };
  }, []);

  const canPlay = balance >= betAmount && !playing && !crashMutation.isPending && !!user?.discordId;

  const displayColor = playing ? 'text-green-400' :
    result ? (result.survived ? 'text-green-400' : 'text-red-400') : 'text-muted-foreground';

  return (
    <div className="space-y-6">
      {/* Crash display */}
      <div className="flex justify-center">
        <div className={`w-40 h-40 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${
          playing ? 'border-green-400 bg-green-400/10' :
          result?.survived ? 'border-green-400 bg-green-400/10' :
          result ? 'border-red-400 bg-red-400/10' :
          'border-muted bg-muted/10'
        }`}>
          <TrendingUp className={`h-6 w-6 mb-1 ${displayColor} ${playing ? 'animate-bounce' : ''}`} />
          <span className={`text-4xl font-bold ${displayColor}`}>
            {playing ? `${animMultiplier.toFixed(2)}x` :
             result ? `${result.crashPoint.toFixed(2)}x` : '1.00x'}
          </span>
          {result && !playing && (
            <span className={`text-xs mt-1 ${result.survived ? 'text-green-400' : 'text-red-400'}`}>
              {result.survived ? (isRu ? '💰 Успел!' : '💰 Cashed out!') : (isRu ? '💥 Крэш!' : '💥 Crashed!')}
            </span>
          )}
        </div>
      </div>

      {result && !playing && (
        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            {isRu ? `Крэш на x${result.crashPoint.toFixed(2)}, кэшаут x${result.cashoutAt}` :
             `Crash @x${result.crashPoint.toFixed(2)}, cashout x${result.cashoutAt}`}
          </p>
          <Badge className={`gap-1 ${result.reward > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            <Coins className="h-3 w-3" /> {result.reward > 0 ? `+${result.reward}` : result.reward} LC
          </Badge>
        </div>
      )}

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      {/* Cashout multiplier */}
      <div className="max-w-xs mx-auto space-y-2">
        <p className="text-xs text-center text-muted-foreground">{isRu ? 'Кэшаут на множителе:' : 'Cashout at multiplier:'}</p>
        <div className="flex items-center gap-2">
          <input type="range" min={1.1} max={10} step={0.1} value={cashoutAt}
            onChange={e => setCashoutAt(Number(e.target.value))}
            disabled={playing}
            className="flex-1 accent-green-400" />
          <span className="text-sm font-bold text-green-400 w-12 text-right">x{cashoutAt.toFixed(1)}</span>
        </div>
        <div className="flex justify-center gap-1">
          {[1.5, 2, 3, 5, 10].map(v => (
            <Button key={v} size="sm" variant={cashoutAt === v ? "default" : "outline"}
              onClick={() => setCashoutAt(v)} disabled={playing} className="text-xs px-2">
              x{v}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">{isRu ? 'Ставка' : 'Bet'}:</span>
        <div className="flex gap-1">
          {[100, 1000, 10000].map(val => (
            <Button key={val} size="sm" variant={betAmount === val ? "default" : "outline"}
              onClick={() => { setBetAmount(val); setError(""); }} disabled={playing} className="text-xs">{val >= 1000 ? `${val/1000}K` : val}</Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => { setBetAmount(balance); setError(""); }} disabled={playing} className="text-xs font-bold">MAX</Button>
        </div>
        <Input type="number" min={1} value={betAmount}
          onChange={(e) => { setBetAmount(Math.max(1, parseInt(e.target.value) || 1)); setError(""); }}
          disabled={playing} className="w-28 h-8 text-xs text-center" />
      </div>

      <div className="flex justify-center">
        <Button size="lg" onClick={() => { setResult(null); setAnimMultiplier(1); setError(""); crashMutation.mutate(); }}
          disabled={!canPlay}
          className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white">
          {playing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
          {playing ? (isRu ? 'Летим...' : 'Flying...') :
           balance < betAmount ? (isRu ? 'Мало монет' : 'Not enough') :
           `${isRu ? 'Запуск' : 'Launch'} (${betAmount} LC)`}
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {isRu ? 'Чем выше кэшаут, тем больше риск крэша!' : 'Higher cashout = higher crash risk!'}
      </p>
    </div>
  );
}

// ============= GAME HISTORY (localStorage) =============

function GameHistoryTab() {
  const { language } = useLanguage();
  const isRu = (language || 'ru') === 'ru';
  const [history, setHistory] = useState<GameHistoryItem[]>(getGameHistory);

  useEffect(() => {
    const onUpdate = () => setHistory(getGameHistory());
    window.addEventListener('game-history-updated', onUpdate);
    return () => window.removeEventListener('game-history-updated', onUpdate);
  }, []);

  const gameLabels: Record<string, string> = {
    wheel: isRu ? 'Рулетка' : 'Wheel',
    rps: isRu ? 'КНБ' : 'RPS',
    coinflip: isRu ? 'Монетка' : 'Coin Flip',
    dice: isRu ? 'Кости' : 'Dice',
    slots: isRu ? 'Слоты' : 'Slots',
    blackjack: isRu ? 'Блэкджек' : 'Blackjack',
    'number-guess': isRu ? 'Число' : 'Number Guess',
    crash: isRu ? 'Крэш' : 'Crash',
  };

  const gameIcons: Record<string, any> = {
    wheel: RotateCw,
    rps: Scissors,
    coinflip: Coins,
    dice: Dices,
    slots: Cherry,
    blackjack: Award,
    'number-guess': Target,
    crash: TrendingUp,
  };

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">{isRu ? 'История пуста' : 'No history yet'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => {
          localStorage.removeItem(HISTORY_KEY);
          setHistory([]);
        }}>
          {isRu ? 'Очистить' : 'Clear'}
        </Button>
      </div>
      {history.slice(0, 50).map(item => {
        const Icon = gameIcons[item.game] || Gamepad2;
        return (
          <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-purple-400" />
              <div>
                <p className="text-sm font-medium">
                  {gameLabels[item.game] || item.game}
                  {item.result && <span className="text-xs text-muted-foreground ml-1">({item.result})</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isRu ? 'Ставка' : 'Bet'}: {item.bet} LC • {new Date(item.playedAt).toLocaleString()}
                </p>
              </div>
            </div>
            <Badge variant="outline"
              className={item.reward > 0 ? "text-green-400" : item.reward < 0 ? "text-red-400" : "text-muted-foreground"}>
              {item.reward > 0 ? `+${item.reward}` : item.reward} LC
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

// ============= MAIN PAGE =============

export default function MiniGamesPage() {
  const { language } = useLanguage();
  const isRu = (language || 'ru') === 'ru';
  const [activeTab, setActiveTab] = useState("wheel");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  return (
    <div ref={containerRef} className={`container mx-auto px-4 py-8 max-w-3xl pt-24 ${isFullscreen ? 'bg-background pt-8 overflow-auto h-full' : ''}`}>
      <div className="flex items-center gap-3 mb-4">
        <Gamepad2 className="h-7 w-7 text-primary" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{isRu ? 'Мини-игры' : 'Mini-Games'}</h1>
          <p className="text-sm text-muted-foreground">{isRu ? 'Играй и зарабатывай LumiCoins' : 'Play and earn LumiCoins'}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={toggleFullscreen}
          className="h-8 w-8 text-muted-foreground hover:text-primary" title={isRu ? 'Полный экран' : 'Fullscreen'}>
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>

      <BalanceBar />
      <GoldCardBanner />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="wheel" className="flex-1 gap-1 text-xs" data-ai="game-wheel">
            <RotateCw className="h-3 w-3" /> {isRu ? 'Рулетка' : 'Wheel'}
          </TabsTrigger>
          <TabsTrigger value="rps" className="flex-1 gap-1 text-xs" data-ai="game-rps">
            <Scissors className="h-3 w-3" /> {isRu ? 'КНБ' : 'RPS'}
          </TabsTrigger>
          <TabsTrigger value="coinflip" className="flex-1 gap-1 text-xs" data-ai="game-coinflip">
            <Coins className="h-3 w-3" /> {isRu ? 'Монетка' : 'Coin'}
          </TabsTrigger>
          <TabsTrigger value="dice" className="flex-1 gap-1 text-xs" data-ai="game-dice">
            <Dices className="h-3 w-3" /> {isRu ? 'Кости' : 'Dice'}
          </TabsTrigger>
          <TabsTrigger value="slots" className="flex-1 gap-1 text-xs" data-ai="game-slots">
            <Cherry className="h-3 w-3" /> {isRu ? 'Слоты' : 'Slots'}
          </TabsTrigger>
          <TabsTrigger value="blackjack" className="flex-1 gap-1 text-xs" data-ai="game-blackjack">
            <Award className="h-3 w-3" /> {isRu ? '21' : 'BJ'}
          </TabsTrigger>
          <TabsTrigger value="number-guess" className="flex-1 gap-1 text-xs" data-ai="game-numguess">
            <Target className="h-3 w-3" /> {isRu ? 'Число' : 'Guess'}
          </TabsTrigger>
          <TabsTrigger value="crash" className="flex-1 gap-1 text-xs" data-ai="game-crash">
            <TrendingUp className="h-3 w-3" /> {isRu ? 'Крэш' : 'Crash'}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 gap-1 text-xs" data-ai="game-history">
            <History className="h-3 w-3" /> {isRu ? 'Лог' : 'Log'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wheel">
          <Card className="glass glass-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RotateCw className="h-4 w-4 text-purple-400" />
                {isRu ? 'Колесо Фортуны' : 'Wheel of Fortune'}
              </CardTitle>
              <CardDescription>{isRu ? 'Множители x0 – x5. Ставка × множитель = выигрыш' : 'Multipliers x0 – x5. Bet × multiplier = win'}</CardDescription>
            </CardHeader>
            <CardContent><WheelOfFortune /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rps">
          <Card className="glass glass-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Scissors className="h-4 w-4 text-blue-400" />
                {isRu ? 'Камень Ножницы Бумага' : 'Rock Paper Scissors'}
              </CardTitle>
              <CardDescription>{isRu ? 'Победа = +ставка, проигрыш = -ставка' : 'Win = +bet, lose = -bet'}</CardDescription>
            </CardHeader>
            <CardContent><RockPaperScissors /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coinflip">
          <Card className="glass glass-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Coins className="h-4 w-4 text-yellow-400" />
                {isRu ? 'Монетка' : 'Coin Flip'}
              </CardTitle>
              <CardDescription>{isRu ? 'Орёл или решка — 50/50, выигрыш x2' : 'Heads or tails — 50/50, win x2'}</CardDescription>
            </CardHeader>
            <CardContent><CoinFlip /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dice">
          <Card className="glass glass-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Dices className="h-4 w-4 text-green-400" />
                {isRu ? 'Кости' : 'Dice Roll'}
              </CardTitle>
              <CardDescription>{isRu ? 'Угадай результат броска — выигрыш x1.8' : 'Guess the roll — win x1.8'}</CardDescription>
            </CardHeader>
            <CardContent><DiceGame /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slots">
          <Card className="glass glass-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cherry className="h-4 w-4 text-orange-400" />
                {isRu ? 'Слот-машина' : 'Slot Machine'}
              </CardTitle>
              <CardDescription>{isRu ? 'Крути барабаны — 3 в ряд на средней линии = выигрыш!' : 'Spin the reels — 3 in a row on the payline = win!'}</CardDescription>
            </CardHeader>
            <CardContent><SlotMachine /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blackjack">
          <Card className="glass glass-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-400" />
                {isRu ? 'Блэкджек (21)' : 'Blackjack (21)'}
              </CardTitle>
              <CardDescription>{isRu ? 'Набери 21 — Blackjack x2.5, победа x2' : 'Get 21 — Blackjack x2.5, win x2'}</CardDescription>
            </CardHeader>
            <CardContent><BlackjackGame /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="number-guess">
          <Card className="glass glass-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-cyan-400" />
                {isRu ? 'Угадай число' : 'Number Guess'}
              </CardTitle>
              <CardDescription>{isRu ? 'Угадай число 1-100. Точнее = больше выигрыш (до x10)' : 'Guess 1-100. Closer = bigger win (up to x10)'}</CardDescription>
            </CardHeader>
            <CardContent><NumberGuessGame /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crash">
          <Card className="glass glass-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                {isRu ? 'Крэш' : 'Crash'}
              </CardTitle>
              <CardDescription>{isRu ? 'Выбери множитель кэшаута — успей до крэша!' : 'Pick cashout multiplier — cash out before crash!'}</CardDescription>
            </CardHeader>
            <CardContent><CrashGame /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="glass glass-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                {isRu ? 'История игр' : 'Game History'}
              </CardTitle>
            </CardHeader>
            <CardContent><GameHistoryTab /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
