import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiDiscord } from "react-icons/si";
import { Users } from "lucide-react";
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
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/30 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <Card className="w-full max-w-md relative backdrop-blur-xl bg-card/80 border-primary/20" data-testid="card-login">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <SiDiscord className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {t('login.title', 'Добро пожаловать')}
          </CardTitle>
          <CardDescription className="text-base">
            {t('login.description', 'Войдите через Discord для доступа к магазину или продолжите как гость')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button
            onClick={handleDiscordLogin}
            size="lg"
            className="w-full gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white border-0"
            data-testid="button-discord-login"
          >
            <SiDiscord className="w-5 h-5" />
            {t('login.discord', 'Войти через Discord')}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                {t('login.or', 'или')}
              </span>
            </div>
          </div>

          <Button
            onClick={handleGuestMode}
            size="lg"
            variant="outline"
            className="w-full gap-2"
            data-testid="button-guest-mode"
          >
            <Users className="w-5 h-5" />
            {t('login.guest', 'Продолжить как гость')}
          </Button>

          <p className="text-sm text-muted-foreground text-center mt-4">
            {t('login.guestInfo', 'В гостевом режиме вы можете просматривать контент, но не сможете совершать покупки')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
