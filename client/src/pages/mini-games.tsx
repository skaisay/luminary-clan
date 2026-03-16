import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Gamepad2, Coins, Loader2, RotateCw, Trophy, Hand, Scissors,
  Circle, Square, Star, Zap, Target, ChevronDown, Gift, Flame, History
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";

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
  const { user } = useAuth();
  const { t } = useLanguage();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<{ reward: number; label: string; multiplier: number } | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const spinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mini-games/wheel", {
        discordId: user?.discordId,
        bet: betAmount,
      });
      return res.json();
    },
    onSuccess: (data: { segmentIndex: number; reward: number; multiplier: number }) => {
      const segPerAngle = 360 / WHEEL_SEGMENTS.length;
      // Pointer is at top (270°). Segment N center = N*segPerAngle + segPerAngle/2.
      // We need: (segCenter + finalRotation) mod 360 = 270
      const segCenter = data.segmentIndex * segPerAngle + segPerAngle / 2;
      const desiredMod = ((270 - segCenter) % 360 + 360) % 360;
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
        setResult({ reward: data.reward, label: seg.label, multiplier: data.multiplier });
        // Save to local history
        saveGameHistory({ game: 'wheel', bet: betAmount, reward: data.reward, result: seg.label });
      }, 4000);
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
      // Text
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(startAngle + segAngle / 2);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(seg.label, radius * 0.65, 5);
      ctx.restore();
    });
    // Center circle
    ctx.beginPath();
    ctx.arc(center, center, 20, 0, Math.PI * 2);
    ctx.fillStyle = "#1f2937";
    ctx.fill();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.stroke();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="relative">
          {/* Pointer */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
            <ChevronDown className="h-8 w-8 text-yellow-400 drop-shadow-lg" />
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
          {[10, 25, 50, 100].map(val => (
            <Button
              key={val}
              size="sm"
              variant={betAmount === val ? "default" : "outline"}
              onClick={() => setBetAmount(val)}
              disabled={spinning}
              className="text-xs"
              data-ai={`wheel-bet-${val}`}
            >
              {val}
            </Button>
          ))}
        </div>
        <Input
          type="number"
          min={1}
          max={10000}
          value={betAmount}
          onChange={(e) => setBetAmount(Math.max(1, parseInt(e.target.value) || 1))}
          disabled={spinning}
          className="w-20 h-8 text-xs text-center"
          data-ai="wheel-bet-custom"
        />
      </div>

      {result && (
        <div className="text-center space-y-1">
          <p className={`text-2xl font-bold ${result.reward > 0 ? 'text-green-400' : result.reward < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
            {result.label} {result.multiplier > 0 ? `= ${Math.floor(betAmount * result.multiplier)} LC` : ''}
          </p>
          <Badge variant="secondary" className="text-lg px-4 py-1 gap-1">
            <Coins className="h-4 w-4 text-yellow-500" />
            {result.reward > 0 ? `+${result.reward}` : result.reward === 0 ? '0' : result.reward} LumiCoins
            {result.reward > 0 && <span className="text-xs text-muted-foreground ml-1">({t('miniGames.bet')}: {betAmount})</span>}
          </Badge>
        </div>
      )}

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={() => { setResult(null); spinMutation.mutate(); }}
          disabled={spinning || spinMutation.isPending || !user?.discordId}
          className="gap-2"
          data-ai="wheel-spin"
        >
          {spinning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
          {spinning ? t('miniGames.spinning') : `${t('miniGames.spin')} (${betAmount} LC)`}
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
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [playerChoice, setPlayerChoice] = useState<RPSChoice | null>(null);
  const [botChoice, setBotChoice] = useState<RPSChoice | null>(null);
  const [resultText, setResultText] = useState<string>("");
  const [reward, setReward] = useState<number>(0);
  const [animating, setAnimating] = useState(false);
  const [betAmount, setBetAmount] = useState(10);

  const playMutation = useMutation({
    mutationFn: async (choice: RPSChoice) => {
      const res = await apiRequest("POST", "/api/mini-games/rps", {
        discordId: user?.discordId,
        choice,
        bet: betAmount,
      });
      return res.json();
    },
    onSuccess: (data: { botChoice: RPSChoice; result: string; reward: number }) => {
      setTimeout(() => {
        setBotChoice(data.botChoice);
        setReward(data.reward);
        const resultLabel = data.result === "win" ? t('miniGames.win') :
          data.result === "lose" ? t('miniGames.lose') : t('miniGames.draw');
        setResultText(resultLabel);
        setAnimating(false);
        // Save to local history
        saveGameHistory({ game: 'rps', bet: betAmount, reward: data.reward, result: data.result });
      }, 1500);
    }
  });

  const handlePlay = (choice: RPSChoice) => {
    setPlayerChoice(choice);
    setBotChoice(null);
    setResultText("");
    setReward(0);
    setAnimating(true);
    playMutation.mutate(choice);
  };

  const resultColor = resultText === t('miniGames.win') ? "text-green-400" :
    resultText === t('miniGames.lose') ? "text-red-400" : "text-yellow-400";

  return (
    <div className="space-y-6">
      {/* Arena */}
      <div className="flex items-center justify-center gap-8">
        {/* Player */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">{t('miniGames.you')}</p>
          <div className={`w-20 h-20 rounded-xl border-2 flex items-center justify-center transition-all ${
            playerChoice ? "border-primary bg-primary/10" : "border-muted bg-muted/20"
          }`}>
            {playerChoice ? (() => {
              const Icon = RPS_ICONS[playerChoice];
              return <Icon className="h-8 w-8" />;
            })() : <Hand className="h-8 w-8 text-muted-foreground/30" />}
          </div>
          {playerChoice && <p className="text-xs mt-1">{RPS_LABELS[playerChoice][language as 'ru' | 'en'] || RPS_LABELS[playerChoice].ru}</p>}
        </div>

        <div className="text-2xl font-bold text-muted-foreground">VS</div>

        {/* Bot */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">{t('miniGames.bot')}</p>
          <div className={`w-20 h-20 rounded-xl border-2 flex items-center justify-center transition-all ${
            botChoice ? "border-red-500 bg-red-500/10" :
            animating ? "border-muted animate-pulse bg-muted/20" : "border-muted bg-muted/20"
          }`}>
            {animating ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> :
             botChoice ? (() => {
               const Icon = RPS_ICONS[botChoice];
               return <Icon className="h-8 w-8" />;
             })() : <Gamepad2 className="h-8 w-8 text-muted-foreground/30" />}
          </div>
          {botChoice && <p className="text-xs mt-1">{RPS_LABELS[botChoice][language as 'ru' | 'en'] || RPS_LABELS[botChoice].ru}</p>}
        </div>
      </div>

      {/* Result */}
      {resultText && (
        <div className="text-center space-y-1">
          <p className={`text-xl font-bold ${resultColor}`}>{resultText}</p>
          {reward !== 0 && (
            <Badge variant="secondary" className="gap-1">
              <Coins className="h-3 w-3 text-yellow-500" />
              {reward > 0 ? `+${reward}` : reward} LumiCoins
            </Badge>
          )}
        </div>
      )}

      {/* Bet */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">{t('miniGames.bet')}:</span>
        <div className="flex gap-1">
          {[10, 25, 50, 100].map(val => (
            <Button
              key={val}
              size="sm"
              variant={betAmount === val ? "default" : "outline"}
              onClick={() => setBetAmount(val)}
              disabled={animating}
              className="text-xs"
              data-ai={`rps-bet-${val}`}
            >
              {val}
            </Button>
          ))}
        </div>
        <Input
          type="number"
          min={1}
          max={10000}
          value={betAmount}
          onChange={(e) => setBetAmount(Math.max(1, parseInt(e.target.value) || 1))}
          disabled={animating}
          className="w-20 h-8 text-xs text-center"
          data-ai="rps-bet-custom"
        />
      </div>

      {/* Choice buttons */}
      <div className="flex justify-center gap-3">
        {(["rock", "paper", "scissors"] as RPSChoice[]).map(choice => {
          const Icon = RPS_ICONS[choice];
          return (
            <Button
              key={choice}
              size="lg"
              variant="outline"
              onClick={() => handlePlay(choice)}
              disabled={animating || playMutation.isPending || !user?.discordId}
              className="flex-col h-auto py-3 px-6 gap-1"
              data-ai={`rps-${choice}`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs">{RPS_LABELS[choice][language as 'ru' | 'en'] || RPS_LABELS[choice].ru}</span>
            </Button>
          );
        })}
      </div>
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
  // Keep last 100 entries
  if (history.length > 100) history.length = 100;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  // Dispatch event so GameHistory component can update
  window.dispatchEvent(new Event('game-history-updated'));
}

function GameHistory() {
  const { t } = useLanguage();
  const [history, setHistory] = useState<GameHistoryItem[]>(getGameHistory);

  useEffect(() => {
    const onUpdate = () => setHistory(getGameHistory());
    window.addEventListener('game-history-updated', onUpdate);
    return () => window.removeEventListener('game-history-updated', onUpdate);
  }, []);

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">{t('miniGames.noHistory')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.slice(0, 30).map(item => (
        <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
          <div className="flex items-center gap-3">
            {item.game === "wheel" ? (
              <RotateCw className="h-4 w-4 text-purple-400" />
            ) : (
              <Scissors className="h-4 w-4 text-blue-400" />
            )}
            <div>
              <p className="text-sm font-medium">
                {item.game === "wheel" ? t('miniGames.wheelGame') : t('miniGames.rpsGame')}
                {item.result && <span className="text-xs text-muted-foreground ml-1">({item.result})</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('miniGames.betLabel')}: {item.bet} LC • {new Date(item.playedAt).toLocaleString()}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={item.reward > 0 ? "text-green-400" : item.reward < 0 ? "text-red-400" : "text-muted-foreground"}
          >
            {item.reward > 0 ? `+${item.reward}` : item.reward} LC
          </Badge>
        </div>
      ))}
    </div>
  );
}

// ============= MAIN PAGE =============

export default function MiniGamesPage() {
  const { t } = useLanguage();
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl pt-24">
      <div className="flex items-center gap-3 mb-6">
        <Gamepad2 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t('miniGames.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('miniGames.description')}</p>
        </div>
      </div>

      <Tabs defaultValue="wheel">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="wheel" className="flex-1 gap-1" data-ai="game-wheel">
            <RotateCw className="h-3.5 w-3.5" /> {t('miniGames.wheelOfFortune')}
          </TabsTrigger>
          <TabsTrigger value="rps" className="flex-1 gap-1" data-ai="game-rps">
            <Scissors className="h-3.5 w-3.5" /> {t('miniGames.rps')}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 gap-1" data-ai="game-history">
            <History className="h-3.5 w-3.5" /> {t('miniGames.historyTab')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wheel">
          <Card className="glass glass-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RotateCw className="h-4 w-4 text-purple-400" />
                {t('miniGames.wheelOfFortune')}
              </CardTitle>
              <CardDescription>{t('miniGames.wheelDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <WheelOfFortune />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rps">
          <Card className="glass glass-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Scissors className="h-4 w-4 text-blue-400" />
                {t('miniGames.rps')}
              </CardTitle>
              <CardDescription>{t('miniGames.rpsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <RockPaperScissors />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="glass glass-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                {t('miniGames.gameHistory')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GameHistory />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
