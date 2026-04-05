import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Coins, Palette, Check, ShoppingBag, LogIn, Sparkles, Crown } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

type ColorPreset = {
  id: string;
  name: string;
  color: string;
  price: number;
};

type GradientPreset = {
  id: string;
  name: string;
  colors: string[];
  price: number;
};

type DiscordPreview = {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  banner: string | null;
  bannerColor: string | null;
  highestRoleColor: string | null;
  status: string;
  roles: Array<{ id: string; name: string; color: string }>;
};

export default function NicknameColorsPage() {
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState("#ff6b6b");
  const [previewColor, setPreviewColor] = useState<string | null>(null);
  const [selectedGradient, setSelectedGradient] = useState<string | null>(null);
  const [customGradientColors, setCustomGradientColors] = useState(["#ff0000", "#0000ff"]);

  const { data: colors, isLoading: colorsLoading } = useQuery<ColorPreset[]>({
    queryKey: ["/api/nickname-colors"],
  });

  const { data: gradients } = useQuery<GradientPreset[]>({
    queryKey: ["/api/nickname-gradients"],
  });

  const { data: preview, isLoading: previewLoading } = useQuery<DiscordPreview>({
    queryKey: ["/api/nickname-colors/preview"],
    enabled: isAuthenticated && !!user?.discordId,
    queryFn: async () => {
      const res = await fetch("/api/nickname-colors/preview", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: balance } = useQuery<{ balance: number }>({
    queryKey: [`/api/shop/balance/${user?.discordId}`],
    enabled: !!user?.discordId,
  });

  const buyMutation = useMutation({
    mutationFn: async (data: { colorId: string; customColor?: string }) => {
      const res = await apiRequest("POST", "/api/nickname-colors/buy", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: t('nicknameColors.colorApplied', 'Цвет никнейма применён! 🎨'), description: `${t('nicknameColors.newBalance', 'Новый баланс')}: ${data.newBalance} LC` });
      setSelectedColor(null);
      queryClient.invalidateQueries({ queryKey: ["/api/nickname-colors/preview"] });
      queryClient.invalidateQueries({ queryKey: [`/api/shop/balance/${user?.discordId}`] });
    },
    onError: (e: any) => {
      toast({ title: t('nicknameColors.error', 'Ошибка'), description: e.message, variant: "destructive" });
    },
  });

  const buyGradientMutation = useMutation({
    mutationFn: async (data: { gradientId: string; customColors?: string[] }) => {
      const res = await apiRequest("POST", "/api/nickname-gradients/buy", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: t('nicknameColors.gradientActivated', 'Градиент активирован! 🌈'), description: `${t('nicknameColors.nickShimmers', 'Ваш ник теперь переливается!')} ${t('nicknameColors.newBalance', 'Баланс')}: ${data.newBalance} LC` });
      setSelectedGradient(null);
      queryClient.invalidateQueries({ queryKey: ["/api/nickname-colors/preview"] });
      queryClient.invalidateQueries({ queryKey: [`/api/shop/balance/${user?.discordId}`] });
    },
    onError: (e: any) => {
      toast({ title: t('nicknameColors.error', 'Ошибка'), description: e.message, variant: "destructive" });
    },
  });

  const currentPreset = colors?.find(c => c.id === selectedColor);
  const currentGradient = gradients?.find(g => g.id === selectedGradient);
  const displayColor = previewColor || preview?.highestRoleColor || "#ffffff";

  useEffect(() => {
    if (selectedColor === "custom") {
      setPreviewColor(customColor);
      setSelectedGradient(null);
    } else if (selectedColor) {
      const p = colors?.find(c => c.id === selectedColor);
      if (p) setPreviewColor(p.color);
      setSelectedGradient(null);
    } else if (!selectedGradient) {
      setPreviewColor(null);
    }
  }, [selectedColor, customColor, colors]);

  // Animate preview color for gradients
  useEffect(() => {
    if (!selectedGradient || !gradients) return;
    const grad = gradients.find(g => g.id === selectedGradient);
    if (!grad) return;
    setSelectedColor(null);

    const gColors = selectedGradient === 'grad-custom' ? customGradientColors : grad.colors;
    if (gColors.length < 2) return;

    let step = 0;
    const totalSteps = 20;
    const interval = setInterval(() => {
      const segments = gColors.length;
      const progress = (step % totalSteps) / totalSteps;
      const segFloat = progress * segments;
      const segIdx = Math.floor(segFloat) % segments;
      const t = segFloat - Math.floor(segFloat);
      const c1 = gColors[segIdx];
      const c2 = gColors[(segIdx + 1) % gColors.length];
      // Interpolate
      const r = Math.round(parseInt(c1.slice(1, 3), 16) + (parseInt(c2.slice(1, 3), 16) - parseInt(c1.slice(1, 3), 16)) * t);
      const g = Math.round(parseInt(c1.slice(3, 5), 16) + (parseInt(c2.slice(3, 5), 16) - parseInt(c1.slice(3, 5), 16)) * t);
      const b = Math.round(parseInt(c1.slice(5, 7), 16) + (parseInt(c2.slice(5, 7), 16) - parseInt(c1.slice(5, 7), 16)) * t);
      setPreviewColor(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
      step = (step + 1) % totalSteps;
    }, 200);
    return () => clearInterval(interval);
  }, [selectedGradient, gradients, customGradientColors]);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Palette className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h2 className="text-2xl font-bold mb-2">{t('nicknameColors.shopTitle', 'Магазин цветов никнейма')}</h2>
        <p className="text-muted-foreground mb-6">{t('nicknameColors.loginPrompt', 'Войдите через Discord, чтобы купить цвет')}</p>
        <Button onClick={() => setLocation("/login")} size="lg">
          <LogIn className="w-5 h-5 mr-2" /> {t('nicknameColors.login', 'Войти')}
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-3">
          <Palette className="w-8 h-8" />
          {t('nicknameColors.title', 'Цвет никнейма')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('nicknameColors.subtitle', 'Выбери цвет для своего никнейма в Discord — он будет виден всем на сервере')}
        </p>
        {balance && (
          <Badge variant="outline" className="mt-3 text-base px-4 py-1">
            <Coins className="w-4 h-4 mr-1" /> {(balance.balance ?? 0).toLocaleString()} LC
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Discord Preview Card */}
        <div className="order-1 lg:order-2">
          <Card className="overflow-hidden border-0 bg-[#232428] shadow-2xl sticky top-24">
            {/* Banner */}
            <div
              className="h-32 relative"
              style={{
                background: preview?.banner
                  ? `url(${preview.banner}) center/cover`
                  : preview?.bannerColor
                    ? preview.bannerColor
                    : "linear-gradient(135deg, #5865f2 0%, #eb459e 100%)",
              }}
            />

            {/* Avatar */}
            <div className="relative px-4">
              <div className="absolute -top-12 left-4">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-[6px] border-[#232428] overflow-hidden bg-[#2b2d31]">
                    {previewLoading ? (
                      <Skeleton className="w-full h-full rounded-full" />
                    ) : (
                      <img
                        src={preview?.avatar || user?.avatar || ""}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  {/* Status indicator */}
                  <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full border-[3px] border-[#232428]"
                    style={{
                      backgroundColor:
                        preview?.status === "online" ? "#23a55a" :
                        preview?.status === "idle" ? "#f0b232" :
                        preview?.status === "dnd" ? "#f23f43" : "#80848e",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Info */}
            <CardContent className="pt-16 pb-4 px-4">
              <div className="bg-[#111214] rounded-lg p-4 space-y-3">
                {/* Display Name with color */}
                <div>
                  {previewLoading ? (
                    <Skeleton className="h-7 w-40" />
                  ) : (
                    <h3
                      className="text-xl font-bold transition-colors duration-300"
                      style={{ color: displayColor }}
                    >
                      {preview?.displayName || user?.username || "Username"}
                    </h3>
                  )}
                  <p className="text-sm text-[#b5bac1]">
                    {preview?.username || user?.username || "username"}
                  </p>
                </div>

                {/* Divider */}
                <div className="h-px bg-[#2e3035]" />

                {/* About section */}
                <div>
                  <h4 className="text-xs font-bold text-[#b5bac1] uppercase mb-1">{t('nicknameColors.aboutMe', 'О себе')}</h4>
                  <p className="text-sm text-[#dbdee1]">
                    {t('nicknameColors.memberOf', 'Участник клана Luminary ✨')}
                  </p>
                </div>

                {/* Roles */}
                {preview?.roles && preview.roles.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-[#b5bac1] uppercase mb-2">
                      {t('nicknameColors.roles', 'Роли')} — {preview.roles.length}
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.roles.map(r => (
                        <span
                          key={r.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#2b2d31] text-[#dbdee1]"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: r.color !== "#000000" ? r.color : "#99aab5" }}
                          />
                          {r.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Color Selection */}
        <div className="order-2 lg:order-1 space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                {t('nicknameColors.chooseColor', 'Выберите цвет')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {colorsLoading ? (
                <div className="grid grid-cols-3 gap-3">
                  {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {colors?.filter(c => c.id !== "custom").map(color => (
                    <button
                      key={color.id}
                      onClick={() => setSelectedColor(color.id)}
                      className={`relative p-3 rounded-xl border-2 transition-all hover:scale-105 ${
                        selectedColor === color.id
                          ? "border-white shadow-lg shadow-white/20"
                          : "border-transparent hover:border-white/20"
                      }`}
                      style={{ background: `linear-gradient(135deg, ${color.color}22, ${color.color}44)` }}
                    >
                      <div
                        className="w-8 h-8 rounded-full mx-auto mb-2 shadow-lg"
                        style={{ backgroundColor: color.color, boxShadow: `0 0 15px ${color.color}80` }}
                      />
                      <p className="text-sm font-medium" style={{ color: color.color }}>
                        {color.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {color.price} LC
                      </p>
                      {selectedColor === color.id && (
                        <div className="absolute top-1 right-1">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  ))}

                  {/* Custom color */}
                  {colors?.find(c => c.id === "custom") && (
                    <button
                      onClick={() => setSelectedColor("custom")}
                      className={`relative p-3 rounded-xl border-2 transition-all hover:scale-105 ${
                        selectedColor === "custom"
                          ? "border-white shadow-lg shadow-white/20"
                          : "border-transparent hover:border-white/20"
                      }`}
                      style={{ background: `linear-gradient(135deg, ${customColor}22, ${customColor}44)` }}
                    >
                      <div className="flex items-center justify-center mb-2">
                        <input
                          type="color"
                          value={customColor}
                          onChange={(e) => setCustomColor(e.target.value)}
                          className="w-8 h-8 rounded-full cursor-pointer border-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <p className="text-sm font-medium" style={{ color: customColor }}>
                        {t('nicknameColors.customColor', 'Свой цвет')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {colors.find(c => c.id === "custom")?.price} LC
                      </p>
                      {selectedColor === "custom" && (
                        <div className="absolute top-1 right-1">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Custom color input */}
              {selectedColor === "custom" && (
                <div className="mt-4 flex items-center gap-3">
                  <Input
                    value={customColor}
                    onChange={(e) => {
                      if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                        setCustomColor(e.target.value);
                      }
                    }}
                    placeholder="#FF6B6B"
                    className="w-32"
                  />
                  <div
                    className="w-10 h-10 rounded-full border"
                    style={{ backgroundColor: customColor }}
                  />
                  <span className="text-sm text-muted-foreground">{t('nicknameColors.hexCode', 'HEX код вашего цвета')}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Buy Button */}
          {selectedColor && currentPreset && (
            <Card className="glass-card border-primary/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: selectedColor === "custom" ? customColor : currentPreset.color }}
                    />
                    <span className="font-medium">
                      {currentPreset.name}
                      {selectedColor === "custom" && ` (${customColor})`}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-base">
                    <Coins className="w-4 h-4 mr-1" /> {currentPreset.price} LC
                  </Badge>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  disabled={buyMutation.isPending}
                  onClick={() => {
                    buyMutation.mutate({
                      colorId: selectedColor,
                      customColor: selectedColor === "custom" ? customColor : undefined,
                    });
                  }}
                >
                  {buyMutation.isPending ? (
                    <><ShoppingBag className="w-5 h-5 mr-2 animate-pulse" /> {t('nicknameColors.applying', 'Применяем...')}</>
                  ) : (
                    <><Crown className="w-5 h-5 mr-2" /> {t('nicknameColors.buyColor', 'Купить цвет')}</>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Info */}
          <Card className="glass-card">
            <CardContent className="p-4">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> {t('nicknameColors.howItWorks', 'Как это работает?')}
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li>• {t('nicknameColors.info1', 'Выбранный цвет станет цветом вашего никнейма в Discord')}</li>
                <li>• {t('nicknameColors.info2', 'Бот создаёт персональную цветовую роль')}</li>
                <li>• {t('nicknameColors.info3', 'Цвет виден всем участникам сервера')}</li>
                <li>• {t('nicknameColors.info4', 'Можно менять цвет в любое время (за LC)')}</li>
                <li>• {t('nicknameColors.info5', 'Свой цвет — любой HEX-код на ваш вкус')}</li>
              </ul>
            </CardContent>
          </Card>

          {/* Animated Gradient Section */}
          <Card className="glass-card border-purple-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                {t('nicknameColors.gradientsTitle', 'Переливающиеся градиенты')}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('nicknameColors.gradientsSubtitle', 'Ник будет плавно менять цвет в реальном времени на сервере')}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {gradients?.filter(g => g.id !== "grad-custom").map(grad => (
                  <button
                    key={grad.id}
                    onClick={() => setSelectedGradient(grad.id)}
                    className={`relative p-3 rounded-xl border-2 transition-all hover:scale-105 ${
                      selectedGradient === grad.id
                        ? "border-white shadow-lg shadow-white/20"
                        : "border-transparent hover:border-white/20"
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${grad.colors.join(', ')})`,
                    }}
                  >
                    <div className="bg-black/40 rounded-lg p-2">
                      <p className="text-sm font-medium text-white drop-shadow">
                        {grad.name}
                      </p>
                      <p className="text-xs text-white/70 mt-0.5">
                        {grad.price.toLocaleString()} LC
                      </p>
                    </div>
                    {selectedGradient === grad.id && (
                      <div className="absolute top-1 right-1">
                        <Check className="w-4 h-4 text-white drop-shadow" />
                      </div>
                    )}
                  </button>
                ))}

                {/* Custom gradient */}
                {gradients?.find(g => g.id === "grad-custom") && (
                  <button
                    onClick={() => setSelectedGradient("grad-custom")}
                    className={`relative p-3 rounded-xl border-2 transition-all hover:scale-105 ${
                      selectedGradient === "grad-custom"
                        ? "border-white shadow-lg shadow-white/20"
                        : "border-transparent hover:border-white/20"
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${customGradientColors.join(', ')})`,
                    }}
                  >
                    <div className="bg-black/40 rounded-lg p-2">
                      <p className="text-sm font-medium text-white drop-shadow">
                        ✨ {t('nicknameColors.customGradient', 'Свой градиент')}
                      </p>
                      <p className="text-xs text-white/70 mt-0.5">
                        {gradients.find(g => g.id === "grad-custom")?.price?.toLocaleString()} LC
                      </p>
                    </div>
                    {selectedGradient === "grad-custom" && (
                      <div className="absolute top-1 right-1">
                        <Check className="w-4 h-4 text-white drop-shadow" />
                      </div>
                    )}
                  </button>
                )}
              </div>

              {/* Custom gradient color pickers */}
              {selectedGradient === "grad-custom" && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-muted-foreground">{t('nicknameColors.chooseGradientColors', 'Выберите цвета для градиента (2-6):')}:</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    {customGradientColors.map((c, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <input
                          type="color"
                          value={c}
                          onChange={(e) => {
                            const newColors = [...customGradientColors];
                            newColors[i] = e.target.value;
                            setCustomGradientColors(newColors);
                          }}
                          className="w-8 h-8 rounded cursor-pointer border-0"
                        />
                        {customGradientColors.length > 2 && (
                          <button
                            onClick={() => setCustomGradientColors(customGradientColors.filter((_, idx) => idx !== i))}
                            className="text-xs text-red-400 hover:text-red-300"
                          >✕</button>
                        )}
                      </div>
                    ))}
                    {customGradientColors.length < 6 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCustomGradientColors([...customGradientColors, "#ffffff"])}
                      >
                        + {t('nicknameColors.addColor', 'Цвет')}
                      </Button>
                    )}
                  </div>
                  <div
                    className="h-6 rounded-full mt-2"
                    style={{ background: `linear-gradient(90deg, ${customGradientColors.join(', ')})` }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Buy Gradient Button */}
          {selectedGradient && currentGradient && (
            <Card className="glass-card border-purple-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full"
                      style={{
                        background: `linear-gradient(135deg, ${
                          selectedGradient === "grad-custom"
                            ? customGradientColors.join(', ')
                            : currentGradient.colors.join(', ')
                        })`,
                      }}
                    />
                    <span className="font-medium">{currentGradient.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-base">
                    <Coins className="w-4 h-4 mr-1" /> {currentGradient.price.toLocaleString()} LC
                  </Badge>
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  size="lg"
                  disabled={buyGradientMutation.isPending}
                  onClick={() => {
                    buyGradientMutation.mutate({
                      gradientId: selectedGradient,
                      customColors: selectedGradient === "grad-custom" ? customGradientColors : undefined,
                    });
                  }}
                >
                  {buyGradientMutation.isPending ? (
                    <><ShoppingBag className="w-5 h-5 mr-2 animate-pulse" /> {t('nicknameColors.activating', 'Активируем...')}</>
                  ) : (
                    <><Sparkles className="w-5 h-5 mr-2" /> {t('nicknameColors.buyGradient', 'Купить градиент')}</>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {t('nicknameColors.gradientInfo', 'Цвет ника будет плавно переливаться между выбранными цветами каждые ~4 сек')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
