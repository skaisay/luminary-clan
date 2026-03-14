import { Button } from "@/components/ui/button";
import { SiDiscord } from "react-icons/si";
import { Users, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect } from "react";

export default function LoginPage() {
  const { setGuestMode, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation('/shop');
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const handleGuestMode = () => {
    setGuestMode();
    setLocation('/');
  };

  const handleDiscordLogin = () => {
    window.location.href = '/auth/discord';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary to-accent animate-pulse" />
          <p className="text-muted-foreground">{t('login.checking', 'Проверка авторизации...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated fullscreen background */}
      <div className="absolute inset-0 login-animated-bg" />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="login-particle login-particle-1" />
        <div className="login-particle login-particle-2" />
        <div className="login-particle login-particle-3" />
        <div className="login-particle login-particle-4" />
        <div className="login-particle login-particle-5" />
        <div className="login-particle login-particle-6" />
      </div>

      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

      {/* Glass container */}
      <div className="w-full max-w-md relative z-10" data-testid="card-login">
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl shadow-black/30 p-8 space-y-8">
          
          {/* Logo / icon area */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#D31914] via-[#5865F2] to-[#5FCA00] flex items-center justify-center shadow-lg shadow-primary/30 rotate-3 hover:rotate-0 transition-transform duration-500">
                  <SiDiscord className="w-12 h-12 text-white drop-shadow-lg" />
                </div>
                <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-[#FFFFC9] animate-pulse" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                {t('login.title', 'Добро пожаловать')}
              </h1>
              <p className="text-white/60 mt-2 text-sm leading-relaxed">
                {t('login.description', 'Войдите через Discord для доступа к магазину или продолжите как гость')}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={handleDiscordLogin}
              size="lg"
              className="w-full gap-3 h-14 text-base font-semibold bg-[#5865F2] hover:bg-[#4752C4] text-white border-0 rounded-xl shadow-lg shadow-[#5865F2]/25 hover:shadow-[#5865F2]/40 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              data-testid="button-discord-login"
            >
              <SiDiscord className="w-6 h-6" />
              {t('login.discord', 'Войти через Discord')}
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="px-3 text-white/40 bg-transparent backdrop-blur-sm">
                  {t('login.or', 'или')}
                </span>
              </div>
            </div>

            <Button
              onClick={handleGuestMode}
              size="lg"
              variant="outline"
              className="w-full gap-3 h-12 text-sm font-medium rounded-xl border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white hover:border-white/25 transition-all duration-300"
              data-testid="button-guest-mode"
            >
              <Users className="w-5 h-5" />
              {t('login.guest', 'Продолжить как гость')}
            </Button>
          </div>

          <p className="text-xs text-white/35 text-center leading-relaxed">
            {t('login.guestInfo', 'В гостевом режиме вы можете просматривать контент, но не сможете совершать покупки')}
          </p>
        </div>
      </div>
    </div>
  );
}
