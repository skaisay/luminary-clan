import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Settings as SettingsIcon, Check, User, Bell, Shield, Video, Play, Globe, Palette, Gauge, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const backgrounds = [
  { id: "color1", name: "Тёмный зелёный", description: "Глубокий оттенок", color: "#0F2A1D" },
  { id: "color2", name: "Зелёный", description: "Классический", color: "#375534" },
  { id: "color3", name: "Светло-зелёный", description: "Мягкий оттенок", color: "#689071" },
  { id: "color4", name: "Очень светлый", description: "Нежный", color: "#AEC3B0" },
  { id: "color5", name: "Кремовый", description: "Светлейший", color: "#E3EED4" },
];

export default function Settings() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  const [selectedBackground, setSelectedBackground] = useState("color1");
  const [autoplay, setAutoplay] = useState(true);
  const [quality, setQuality] = useState("auto");
  const [notifyNewVideos, setNotifyNewVideos] = useState(true);
  const [notifyComments, setNotifyComments] = useState(true);
  const [notifyLikes, setNotifyLikes] = useState(false);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [language, setLanguage] = useState("ru");
  const [theme, setTheme] = useState("dark");
  const [playbackSpeed, setPlaybackSpeed] = useState("1");
  const [subtitles, setSubtitles] = useState(false);
  const [autoPauseOnTab, setAutoPauseOnTab] = useState(true);
  const [savePosition, setSavePosition] = useState(true);
  const [volumeLevel, setVolumeLevel] = useState([75]);
  const [autoNext, setAutoNext] = useState(true);
  const [annotations, setAnnotations] = useState(true);

  useEffect(() => {
    const savedBg = localStorage.getItem("videoPlatformBackground");
    if (savedBg) setSelectedBackground(savedBg);
    
    const savedAutoplay = localStorage.getItem("videoAutoplay");
    if (savedAutoplay !== null) setAutoplay(savedAutoplay === "true");
    
    const savedQuality = localStorage.getItem("videoQuality");
    if (savedQuality) setQuality(savedQuality);
    
    const savedNotifyVideos = localStorage.getItem("notifyNewVideos");
    if (savedNotifyVideos !== null) setNotifyNewVideos(savedNotifyVideos === "true");
    
    const savedNotifyComments = localStorage.getItem("notifyComments");
    if (savedNotifyComments !== null) setNotifyComments(savedNotifyComments === "true");
    
    const savedNotifyLikes = localStorage.getItem("notifyLikes");
    if (savedNotifyLikes !== null) setNotifyLikes(savedNotifyLikes === "true");
    
    const savedComments = localStorage.getItem("commentsEnabled");
    if (savedComments !== null) setCommentsEnabled(savedComments === "true");
    
    const savedLanguage = localStorage.getItem("language");
    if (savedLanguage) setLanguage(savedLanguage);
    
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) setTheme(savedTheme);
    
    const savedSpeed = localStorage.getItem("playbackSpeed");
    if (savedSpeed) setPlaybackSpeed(savedSpeed);
    
    const savedSubtitles = localStorage.getItem("subtitles");
    if (savedSubtitles !== null) setSubtitles(savedSubtitles === "true");
    
    const savedAutoPause = localStorage.getItem("autoPauseOnTab");
    if (savedAutoPause !== null) setAutoPauseOnTab(savedAutoPause === "true");
    
    const savedPosition = localStorage.getItem("savePosition");
    if (savedPosition !== null) setSavePosition(savedPosition === "true");
    
    const savedVolume = localStorage.getItem("volumeLevel");
    if (savedVolume) setVolumeLevel([parseInt(savedVolume)]);
    
    const savedAutoNext = localStorage.getItem("autoNext");
    if (savedAutoNext !== null) setAutoNext(savedAutoNext === "true");
    
    const savedAnnotations = localStorage.getItem("annotations");
    if (savedAnnotations !== null) setAnnotations(savedAnnotations === "true");
  }, []);

  const handleBackgroundChange = (backgroundId: string) => {
    setSelectedBackground(backgroundId);
    localStorage.setItem("videoPlatformBackground", backgroundId);
    window.dispatchEvent(new Event("backgroundChange"));
  };

  const handleSettingChange = (key: string, value: boolean | string) => {
    localStorage.setItem(key, value.toString());
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-6">
        <Card className="max-w-md w-full backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
          <CardContent className="text-center py-12">
            <User className="h-16 w-16 mx-auto text-white/70 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Требуется авторизация
            </h3>
            <p className="text-white/70 mb-6">
              Войдите в систему для доступа к настройкам
            </p>
            <Button
              onClick={() => navigate("/login")}
              className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white"
              data-testid="button-login"
            >
              Войти
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full backdrop-blur-xl bg-white/20 border border-white/30 flex items-center justify-center">
            <SettingsIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Настройки</h1>
            <p className="text-white/70">Настройте видеоплатформу под себя</p>
          </div>
        </div>

        {/* Background Settings */}
        <Card className="backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
          <CardHeader>
            <CardTitle className="text-white text-xl">Оформление</CardTitle>
            <CardDescription className="text-white/70">
              Выберите цвет фона для видеоплатформы
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {backgrounds.map((bg) => (
                <div
                  key={bg.id}
                  onClick={() => handleBackgroundChange(bg.id)}
                  className={`relative rounded-3xl overflow-hidden cursor-pointer border-4 transition-all aspect-square ${
                    selectedBackground === bg.id
                      ? "border-white shadow-lg shadow-white/50 scale-105"
                      : "border-white/20 hover:border-white/40 hover:scale-105"
                  }`}
                  data-testid={`button-${bg.id}`}
                  title={bg.name}
                >
                  <div 
                    className="w-full h-full"
                    style={{ backgroundColor: bg.color }}
                  />
                  {selectedBackground === bg.id && (
                    <div className="absolute top-2 right-2 bg-white text-black rounded-full p-2 shadow-lg">
                      <Check className="h-5 w-5" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <p className="text-white font-semibold text-sm">{bg.name}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-white/20">
              <p className="text-white/70 text-sm">
                Цвет применяется ко всем страницам видеоплатформы и сохраняется в браузере
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Playback Settings */}
        <Card className="backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full backdrop-blur-xl bg-white/20 border border-white/30 flex items-center justify-center">
                <Play className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-xl">Воспроизведение</CardTitle>
                <CardDescription className="text-white/70">
                  Настройки плеера и качества видео
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="autoplay" className="text-white font-medium">
                  Автовоспроизведение
                </Label>
                <p className="text-sm text-white/60">
                  Автоматически воспроизводить следующее видео
                </p>
              </div>
              <Switch
                id="autoplay"
                checked={autoplay}
                onCheckedChange={(checked) => {
                  setAutoplay(checked);
                  handleSettingChange("videoAutoplay", checked);
                }}
                data-testid="switch-autoplay"
              />
            </div>

            <Separator className="bg-white/20" />

            <div className="space-y-3">
              <Label htmlFor="quality" className="text-white font-medium">
                Качество видео по умолчанию
              </Label>
              <Select
                value={quality}
                onValueChange={(value) => {
                  setQuality(value);
                  handleSettingChange("videoQuality", value);
                }}
              >
                <SelectTrigger 
                  id="quality"
                  className="rounded-full border-white/30 bg-white/10 text-white backdrop-blur-xl"
                  data-testid="select-quality"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="backdrop-blur-xl bg-slate-900/95 border-white/20">
                  <SelectItem value="auto">Авто (рекомендуется)</SelectItem>
                  <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                  <SelectItem value="720p">720p (HD)</SelectItem>
                  <SelectItem value="480p">480p</SelectItem>
                  <SelectItem value="360p">360p</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-white/60">
                Выберите качество воспроизведения (если доступно)
              </p>
            </div>
          </CardContent>
        </Card>


        {/* Notifications Settings */}
        <Card className="backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full backdrop-blur-xl bg-white/20 border border-white/30 flex items-center justify-center">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-xl">Уведомления</CardTitle>
                <CardDescription className="text-white/70">
                  Получайте уведомления о важных событиях
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="notify-videos" className="text-white font-medium">
                  Новые видео
                </Label>
                <p className="text-sm text-white/60">
                  Уведомления о новых видео от подписок
                </p>
              </div>
              <Switch
                id="notify-videos"
                checked={notifyNewVideos}
                onCheckedChange={(checked) => {
                  setNotifyNewVideos(checked);
                  handleSettingChange("notifyNewVideos", checked);
                }}
                data-testid="switch-notify-videos"
              />
            </div>

            <Separator className="bg-white/20" />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="notify-comments" className="text-white font-medium">
                  Комментарии
                </Label>
                <p className="text-sm text-white/60">
                  Уведомления о новых комментариях к вашим видео
                </p>
              </div>
              <Switch
                id="notify-comments"
                checked={notifyComments}
                onCheckedChange={(checked) => {
                  setNotifyComments(checked);
                  handleSettingChange("notifyComments", checked);
                }}
                data-testid="switch-notify-comments"
              />
            </div>

            <Separator className="bg-white/20" />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="notify-likes" className="text-white font-medium">
                  Лайки
                </Label>
                <p className="text-sm text-white/60">
                  Уведомления когда кто-то лайкает ваше видео
                </p>
              </div>
              <Switch
                id="notify-likes"
                checked={notifyLikes}
                onCheckedChange={(checked) => {
                  setNotifyLikes(checked);
                  handleSettingChange("notifyLikes", checked);
                }}
                data-testid="switch-notify-likes"
              />
            </div>
          </CardContent>
        </Card>

        {/* Language Settings */}
        <Card className="backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full backdrop-blur-xl bg-white/20 border border-white/30 flex items-center justify-center">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-xl">Язык</CardTitle>
                <CardDescription className="text-white/70">
                  Выберите язык интерфейса
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="language" className="text-white font-medium">
                Язык интерфейса
              </Label>
              <Select
                value={language}
                onValueChange={(value) => {
                  setLanguage(value);
                  handleSettingChange("language", value);
                }}
              >
                <SelectTrigger 
                  id="language"
                  className="rounded-full border-white/30 bg-white/10 text-white backdrop-blur-xl"
                  data-testid="select-language"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="backdrop-blur-xl bg-slate-900/95 border-white/20">
                  <SelectItem value="ru">Русский</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="uk">Українська</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Playback Settings */}
        <Card className="backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full backdrop-blur-xl bg-white/20 border border-white/30 flex items-center justify-center">
                <Gauge className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-xl">Расширенные настройки плеера</CardTitle>
                <CardDescription className="text-white/70">
                  Дополнительные функции воспроизведения
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="playback-speed" className="text-white font-medium">
                Скорость воспроизведения по умолчанию
              </Label>
              <Select
                value={playbackSpeed}
                onValueChange={(value) => {
                  setPlaybackSpeed(value);
                  handleSettingChange("playbackSpeed", value);
                }}
              >
                <SelectTrigger 
                  id="playback-speed"
                  className="rounded-full border-white/30 bg-white/10 text-white backdrop-blur-xl"
                  data-testid="select-playback-speed"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="backdrop-blur-xl bg-slate-900/95 border-white/20">
                  <SelectItem value="0.25">0.25x</SelectItem>
                  <SelectItem value="0.5">0.5x</SelectItem>
                  <SelectItem value="0.75">0.75x</SelectItem>
                  <SelectItem value="1">Нормальная (1x)</SelectItem>
                  <SelectItem value="1.25">1.25x</SelectItem>
                  <SelectItem value="1.5">1.5x</SelectItem>
                  <SelectItem value="1.75">1.75x</SelectItem>
                  <SelectItem value="2">2x</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator className="bg-white/20" />

            <div className="space-y-3">
              <Label htmlFor="volume" className="text-white font-medium">
                Громкость по умолчанию: {volumeLevel[0]}%
              </Label>
              <Slider
                id="volume"
                value={volumeLevel}
                onValueChange={(value) => {
                  setVolumeLevel(value);
                }}
                onValueCommit={(value) => {
                  localStorage.setItem("volumeLevel", value[0].toString());
                }}
                max={100}
                step={1}
                className="w-full"
                data-testid="slider-volume"
              />
            </div>

            <Separator className="bg-white/20" />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="subtitles" className="text-white font-medium">
                  Субтитры
                </Label>
                <p className="text-sm text-white/60">
                  Автоматически включать субтитры (если доступны)
                </p>
              </div>
              <Switch
                id="subtitles"
                checked={subtitles}
                onCheckedChange={(checked) => {
                  setSubtitles(checked);
                  handleSettingChange("subtitles", checked);
                }}
                data-testid="switch-subtitles"
              />
            </div>

            <Separator className="bg-white/20" />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="auto-pause" className="text-white font-medium">
                  Автопауза при смене вкладки
                </Label>
                <p className="text-sm text-white/60">
                  Останавливать видео при переключении на другую вкладку
                </p>
              </div>
              <Switch
                id="auto-pause"
                checked={autoPauseOnTab}
                onCheckedChange={(checked) => {
                  setAutoPauseOnTab(checked);
                  handleSettingChange("autoPauseOnTab", checked);
                }}
                data-testid="switch-auto-pause"
              />
            </div>

            <Separator className="bg-white/20" />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="save-position" className="text-white font-medium">
                  Сохранять позицию просмотра
                </Label>
                <p className="text-sm text-white/60">
                  Продолжать с того места, где остановились
                </p>
              </div>
              <Switch
                id="save-position"
                checked={savePosition}
                onCheckedChange={(checked) => {
                  setSavePosition(checked);
                  handleSettingChange("savePosition", checked);
                }}
                data-testid="switch-save-position"
              />
            </div>

            <Separator className="bg-white/20" />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="auto-next" className="text-white font-medium">
                  Автоматически переходить к следующему
                </Label>
                <p className="text-sm text-white/60">
                  Воспроизводить следующее видео из плейлиста
                </p>
              </div>
              <Switch
                id="auto-next"
                checked={autoNext}
                onCheckedChange={(checked) => {
                  setAutoNext(checked);
                  handleSettingChange("autoNext", checked);
                }}
                data-testid="switch-auto-next"
              />
            </div>

            <Separator className="bg-white/20" />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="annotations" className="text-white font-medium">
                  Аннотации и подсказки
                </Label>
                <p className="text-sm text-white/60">
                  Показывать подсказки и аннотации в видео
                </p>
              </div>
              <Switch
                id="annotations"
                checked={annotations}
                onCheckedChange={(checked) => {
                  setAnnotations(checked);
                  handleSettingChange("annotations", checked);
                }}
                data-testid="switch-annotations"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
