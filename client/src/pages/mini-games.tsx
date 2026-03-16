import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Gamepad2, Coins, Loader2, RotateCw, Hand, Scissors,
  Circle, Square, ChevronRight, History, Dices, CircleDot,
  ArrowUp, ArrowDown, Hash, Swords, Users, X as XIcon, Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";

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
  { label: "x1.5", multiplier: 1.5, color: "#22c55e" },
  { label: "x0", multiplier: 0, color: "#475569" },
  { label: "x2", multiplier: 2, color: "#eab308" },
  { label: "x0.5", multiplier: 0.5, color: "#dc2626" },
  { label: "x3", multiplier: 3, color: "#a855f7" },
  { label: "x1", multiplier: 1, color: "#06b6d4" },
  { label: "x0.5", multiplier: 0.5, color: "#f97316" },
  { label: "x1.5", multiplier: 1.5, color: "#10b981" },
  { label: "x5", multiplier: 5, color: "#ec4899" },
  { label: "x1", multiplier: 1, color: "#6366f1" },
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
      const res = await apiRequest("POST", "/api/mini-games/wheel", {
        discordId: user?.discordId,
        bet: betAmount,
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
      const res = await apiRequest("POST", "/api/mini-games/rps", {
        discordId: user?.discordId, choice, bet: betAmount,
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
      const res = await apiRequest("POST", "/api/mini-games/coinflip", {
        discordId: user?.discordId, bet: betAmount, guess,
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
      const res = await apiRequest("POST", "/api/mini-games/dice", {
        discordId: user?.discordId, bet: betAmount, guess,
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

// ============= PVP DUEL (BETA) =============

const GEMS = [
  { id: 'ruby', emoji: '🔴', name: { ru: 'Рубин', en: 'Ruby' }, color: 'border-red-500 bg-red-500/10 hover:bg-red-500/20', activeColor: 'border-red-500 bg-red-500/20 ring-2 ring-red-400' },
  { id: 'sapphire', emoji: '🔵', name: { ru: 'Сапфир', en: 'Sapphire' }, color: 'border-blue-500 bg-blue-500/10 hover:bg-blue-500/20', activeColor: 'border-blue-500 bg-blue-500/20 ring-2 ring-blue-400' },
  { id: 'emerald', emoji: '🟢', name: { ru: 'Изумруд', en: 'Emerald' }, color: 'border-green-500 bg-green-500/10 hover:bg-green-500/20', activeColor: 'border-green-500 bg-green-500/20 ring-2 ring-green-400' },
];
const GEM_BY_ID = Object.fromEntries(GEMS.map(g => [g.id, g]));

interface DuelInfo {
  id: string;
  challengerId: string;
  challengerName: string;
  challengerAvatar: string | null;
  opponentId: string | null;
  opponentName: string | null;
  opponentAvatar: string | null;
  bet: number;
  challengerChoice: string | null;
  opponentChoice: string | null;
  winnerId: string | null;
  winnerName: string | null;
  status: 'pending' | 'choosing' | 'resolved' | 'cancelled';
  resultType: string | null;
  challengerNewBalance: number | null;
  opponentNewBalance: number | null;
  createdAt: number;
}

function PlayerCard({ name, avatar, discordId, choice, revealed, isMe }: {
  name: string | null; avatar: string | null; discordId: string | null;
  choice: string | null; revealed: boolean; isMe: boolean;
}) {
  const gem = choice && choice !== 'hidden' ? GEM_BY_ID[choice] : null;
  return (
    <div className="flex flex-col items-center gap-2 min-w-[100px]">
      <Avatar className="h-12 w-12 border-2 border-muted">
        <AvatarImage src={avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png` : undefined} />
        <AvatarFallback className="bg-primary/20 text-primary text-sm">
          {(name || '?').slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs font-medium truncate max-w-[90px]">{name || '...'}</span>
      {isMe && <Badge variant="outline" className="text-[10px] py-0">YOU</Badge>}
      <div className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl transition-all ${
        revealed && gem ? gem.activeColor :
        choice === 'hidden' ? 'border-muted bg-muted/30' :
        choice && gem ? gem.activeColor :
        'border-muted/30 bg-muted/10'
      }`}>
        {revealed && gem ? gem.emoji :
         choice === 'hidden' ? '❓' :
         choice && gem ? gem.emoji : '—'}
      </div>
    </div>
  );
}

function PvPDuel() {
  const { user, updateBalance } = useAuth();
  const { language } = useLanguage();
  const isRu = (language || 'ru') === 'ru';
  const [activeDuelId, setActiveDuelId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(100);
  const [error, setError] = useState('');
  const [myChoice, setMyChoice] = useState<string | null>(null);
  const balance = user?.lumiCoins ?? 0;
  const myId = user?.discordId || '';

  // Poll open duels when not in a duel
  const { data: openDuels = [] } = useQuery<DuelInfo[]>({
    queryKey: ['/api/mini-games/duel/list'],
    refetchInterval: activeDuelId ? false : 3000,
    enabled: !activeDuelId,
    staleTime: 0,
  });

  // Poll active duel status
  const { data: duelData, refetch: refetchDuel } = useQuery<{ duel: DuelInfo }>({
    queryKey: [`/api/mini-games/duel/${activeDuelId}?discordId=${myId}`],
    refetchInterval: activeDuelId ? 1500 : false,
    enabled: !!activeDuelId,
    staleTime: 0,
  });
  const duel = duelData?.duel;

  // Auto-detect if I'm already in a duel
  useEffect(() => {
    if (!activeDuelId && openDuels.length > 0) {
      const myDuel = openDuels.find(d =>
        (d.challengerId === myId || d.opponentId === myId) &&
        (d.status === 'pending' || d.status === 'choosing')
      );
      if (myDuel) {
        setActiveDuelId(myDuel.id);
      }
    }
  }, [openDuels, myId, activeDuelId]);

  // Update balance when duel resolves
  useEffect(() => {
    if (duel?.status === 'resolved') {
      const myNewBalance = duel.challengerId === myId ? duel.challengerNewBalance : duel.opponentNewBalance;
      if (myNewBalance !== null && myNewBalance !== undefined) {
        updateBalance(myNewBalance);
      }
      saveGameHistory({
        game: 'duel',
        bet: duel.bet,
        reward: duel.winnerId === myId ? duel.bet : duel.resultType === 'draw' ? 0 : -duel.bet,
        result: duel.winnerId === myId ? 'win' : duel.resultType === 'draw' ? 'draw' : 'lose',
      });
    }
  }, [duel?.status]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/mini-games/duel/create', { discordId: myId, bet: betAmount });
      return res.json();
    },
    onSuccess: (data: { duel: DuelInfo; newBalance: number }) => {
      setError('');
      setActiveDuelId(data.duel.id);
      setMyChoice(null);
      updateBalance(data.newBalance);
    },
    onError: (err: Error) => setError(err.message),
  });

  const acceptMutation = useMutation({
    mutationFn: async (duelId: string) => {
      const res = await apiRequest('POST', '/api/mini-games/duel/accept', { duelId, discordId: myId });
      return res.json();
    },
    onSuccess: (data: { duel: DuelInfo; newBalance: number }) => {
      setError('');
      setActiveDuelId(data.duel.id);
      setMyChoice(null);
      updateBalance(data.newBalance);
    },
    onError: (err: Error) => setError(err.message),
  });

  const chooseMutation = useMutation({
    mutationFn: async (choice: string) => {
      const res = await apiRequest('POST', '/api/mini-games/duel/choose', { duelId: activeDuelId, discordId: myId, choice });
      return res.json();
    },
    onSuccess: (data: { duel: DuelInfo }) => {
      setError('');
      refetchDuel();
    },
    onError: (err: Error) => setError(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/mini-games/duel/cancel', { duelId: activeDuelId, discordId: myId });
      return res.json();
    },
    onSuccess: (data: { newBalance: number }) => {
      setError('');
      setActiveDuelId(null);
      setMyChoice(null);
      updateBalance(data.newBalance);
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleChoose = (gemId: string) => {
    if (myChoice) return;
    setMyChoice(gemId);
    chooseMutation.mutate(gemId);
  };

  const handleClose = () => {
    setActiveDuelId(null);
    setMyChoice(null);
    setError('');
  };

  const isResolved = duel?.status === 'resolved';
  const isChoosing = duel?.status === 'choosing';
  const isPending = duel?.status === 'pending';
  const amChallenger = duel?.challengerId === myId;
  const iWon = duel?.winnerId === myId;
  const isDraw = duel?.resultType === 'draw';

  // ---- LOBBY VIEW (no active duel) ----
  if (!activeDuelId) {
    const otherDuels = openDuels.filter(d => d.challengerId !== myId && d.status === 'pending');
    return (
      <div className="space-y-6">
        {/* Create duel */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground">{isRu ? 'Ставка' : 'Bet'}:</span>
            <div className="flex gap-1">
              {[100, 1000, 10000].map(val => (
                <Button key={val} size="sm" variant={betAmount === val ? "default" : "outline"}
                  onClick={() => { setBetAmount(val); setError(''); }} className="text-xs">
                  {val >= 1000 ? `${val/1000}K` : val}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={() => { setBetAmount(balance); setError(''); }}
                className="text-xs font-bold">MAX</Button>
            </div>
            <Input type="number" min={10} value={betAmount}
              onChange={(e) => { setBetAmount(Math.max(10, parseInt(e.target.value) || 10)); setError(''); }}
              className="w-28 h-8 text-xs text-center" />
          </div>
          {error && <p className="text-center text-sm text-red-400">{error}</p>}
          <div className="flex justify-center">
            <Button onClick={() => createMutation.mutate()}
              disabled={balance < betAmount || createMutation.isPending || !myId}
              className="gap-2" size="lg">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
              {isRu ? `Создать дуэль (${betAmount.toLocaleString()} LC)` : `Create Duel (${betAmount.toLocaleString()} LC)`}
            </Button>
          </div>
        </div>

        {/* Open duels from other players */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            {isRu ? 'Открытые дуэли' : 'Open Duels'}
            {otherDuels.length > 0 && <Badge variant="outline" className="text-xs">{otherDuels.length}</Badge>}
          </h3>
          {otherDuels.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              {isRu ? 'Нет открытых дуэлей. Создай свою!' : 'No open duels. Create one!'}
            </p>
          ) : otherDuels.map(d => (
            <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-muted/30">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={d.challengerAvatar ? `https://cdn.discordapp.com/avatars/${d.challengerId}/${d.challengerAvatar}.png` : undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {d.challengerName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{d.challengerName}</p>
                  <p className="text-xs text-muted-foreground">{d.bet.toLocaleString()} LC</p>
                </div>
              </div>
              <Button size="sm" variant="default"
                onClick={() => acceptMutation.mutate(d.id)}
                disabled={balance < d.bet || acceptMutation.isPending}
                className="gap-1">
                <Swords className="h-3 w-3" />
                {isRu ? 'Принять' : 'Accept'}
              </Button>
            </div>
          ))}
        </div>

        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            {isRu ? '🔴 Рубин бьёт 🟢 Изумруд • 🟢 Изумруд бьёт 🔵 Сапфир • 🔵 Сапфир бьёт 🔴 Рубин' :
             '🔴 Ruby beats 🟢 Emerald • 🟢 Emerald beats 🔵 Sapphire • 🔵 Sapphire beats 🔴 Ruby'}
          </p>
          <p className="text-xs text-muted-foreground">
            {isRu ? 'Одинаковый выбор = ничья, ставки возвращаются' : 'Same choice = draw, bets returned'}
          </p>
        </div>
      </div>
    );
  }

  // ---- ACTIVE DUEL VIEW ----
  if (!duel) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{isRu ? 'Загрузка дуэли...' : 'Loading duel...'}</p>
      </div>
    );
  }

  const challengerName = duel.challengerName;
  const opponentName = duel.opponentName;
  const myChoiceFromDuel = amChallenger ? duel.challengerChoice : duel.opponentChoice;
  const theirChoiceFromDuel = amChallenger ? duel.opponentChoice : duel.challengerChoice;

  return (
    <div className="space-y-5">
      {/* Duel header */}
      <div className="text-center">
        <Badge variant="outline" className="text-xs gap-1 mb-2">
          <Swords className="h-3 w-3" />
          {duel.bet.toLocaleString()} LC
          {isPending && ` • ${isRu ? 'Ожидание' : 'Waiting'}`}
          {isChoosing && ` • ${isRu ? 'Выбор' : 'Choosing'}`}
          {isResolved && ` • ${isRu ? 'Завершено' : 'Finished'}`}
        </Badge>
      </div>

      {/* Player cards */}
      <div className="flex items-center justify-center gap-6">
        <PlayerCard
          name={amChallenger ? challengerName : opponentName}
          avatar={amChallenger ? duel.challengerAvatar : duel.opponentAvatar}
          discordId={amChallenger ? duel.challengerId : duel.opponentId}
          choice={myChoiceFromDuel || myChoice}
          revealed={true}
          isMe={true}
        />
        <div className="text-xl font-bold text-muted-foreground">⚔️</div>
        <PlayerCard
          name={amChallenger ? opponentName : challengerName}
          avatar={amChallenger ? duel.opponentAvatar : duel.challengerAvatar}
          discordId={amChallenger ? duel.opponentId : duel.challengerId}
          choice={isResolved ? theirChoiceFromDuel : (theirChoiceFromDuel === 'hidden' ? 'hidden' : null)}
          revealed={isResolved}
          isMe={false}
        />
      </div>

      {/* Pending: waiting for opponent */}
      {isPending && (
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{isRu ? 'Ожидание соперника...' : 'Waiting for opponent...'}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending} className="text-xs text-muted-foreground gap-1">
            <XIcon className="h-3 w-3" /> {isRu ? 'Отменить' : 'Cancel'}
          </Button>
        </div>
      )}

      {/* Choosing: pick a gem */}
      {isChoosing && !myChoiceFromDuel && !myChoice && (
        <div className="space-y-3">
          <p className="text-center text-sm font-medium">{isRu ? 'Выбери камень:' : 'Pick a gem:'}</p>
          <div className="flex justify-center gap-4">
            {GEMS.map(gem => (
              <Button key={gem.id} variant="outline" size="lg"
                onClick={() => handleChoose(gem.id)}
                disabled={chooseMutation.isPending}
                className={`flex-col h-auto py-3 px-5 gap-1 border-2 ${gem.color}`}>
                <span className="text-3xl">{gem.emoji}</span>
                <span className="text-xs">{gem.name[language as 'ru' | 'en'] || gem.name.ru}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Waiting for opponent's choice */}
      {isChoosing && (myChoiceFromDuel || myChoice) && (
        <div className="text-center space-y-2">
          <p className="text-sm text-green-400 flex items-center justify-center gap-1">
            <Check className="h-4 w-4" /> {isRu ? 'Твой выбор сделан!' : 'Your choice is locked!'}
          </p>
          {theirChoiceFromDuel !== 'hidden' && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{isRu ? 'Ожидание выбора соперника...' : 'Waiting for opponent...'}</span>
            </div>
          )}
          {theirChoiceFromDuel === 'hidden' && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{isRu ? 'Соперник выбирает...' : 'Opponent is choosing...'}</span>
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {isResolved && (
        <div className="text-center space-y-3">
          <p className={`text-2xl font-bold ${iWon ? 'text-green-400' : isDraw ? 'text-yellow-400' : 'text-red-400'}`}>
            {iWon ? (isRu ? '🎉 Победа!' : '🎉 You win!') :
             isDraw ? (isRu ? '🤝 Ничья!' : '🤝 Draw!') :
             (isRu ? '😔 Поражение' : '😔 You lose')}
          </p>
          <Badge className={`text-base px-4 py-1 gap-1 ${
            iWon ? 'bg-green-500/20 text-green-400' :
            isDraw ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            <Coins className="h-4 w-4" />
            {iWon ? `+${duel.bet.toLocaleString()}` : isDraw ? '0' : `-${duel.bet.toLocaleString()}`} LC
          </Badge>
          <div>
            <Button size="sm" variant="outline" onClick={handleClose} className="gap-1 mt-2">
              {isRu ? 'Назад в лобби' : 'Back to lobby'}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-center text-sm text-red-400">{error}</p>}
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
    duel: isRu ? 'Дуэль' : 'Duel',
  };

  const gameIcons: Record<string, any> = {
    wheel: RotateCw,
    rps: Scissors,
    coinflip: Coins,
    dice: Dices,
    duel: Swords,
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
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl pt-24">
      <div className="flex items-center gap-3 mb-4">
        <Gamepad2 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{isRu ? 'Мини-игры' : 'Mini-Games'}</h1>
          <p className="text-sm text-muted-foreground">{isRu ? 'Играй и зарабатывай LumiCoins' : 'Play and earn LumiCoins'}</p>
        </div>
      </div>

      <BalanceBar />

      <Tabs defaultValue="wheel">
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
          <TabsTrigger value="duel" className="flex-1 gap-1 text-xs relative" data-ai="game-duel">
            <Swords className="h-3 w-3" /> {isRu ? 'Дуэль' : 'Duel'}
            <span className="absolute -top-1 -right-1 text-[8px] bg-purple-500 text-white px-1 rounded-full leading-tight">β</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 gap-1 text-xs" data-ai="game-history">
            <History className="h-3 w-3" /> {isRu ? 'История' : 'History'}
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

        <TabsContent value="duel">
          <Card className="glass glass-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Swords className="h-4 w-4 text-orange-400" />
                {isRu ? 'Дуэль игроков' : 'PvP Duel'}
                <Badge variant="outline" className="text-[10px] py-0 px-1">βeta</Badge>
              </CardTitle>
              <CardDescription>{isRu ? 'Сразись с другим игроком — выбери камень' : 'Fight another player — choose a gem'}</CardDescription>
            </CardHeader>
            <CardContent><PvPDuel /></CardContent>
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
