import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SiDiscord } from "react-icons/si";
import { useLocation } from "wouter";

interface DiscordAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DiscordAuthModal({ open, onOpenChange }: DiscordAuthModalProps) {
  const [location] = useLocation();

  const handleDiscordLogin = () => {
    // Для видео-платформы - остаемся на видео-платформе
    // Для остального сайта - возвращаемся на ту же страницу
    let returnTo = location;
    if (!location.startsWith("/video-platform") && !location.startsWith("/v/")) {
      returnTo = "/video-platform";
    }
    const encoded = encodeURIComponent(returnTo);
    window.location.href = `/auth/discord?returnTo=${encoded}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md backdrop-blur-xl bg-white/10 border-white/20 rounded-3xl shadow-2xl">
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
          {/* Discord Logo */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/50">
            <SiDiscord className="h-10 w-10 text-white" />
          </div>

          {/* Title */}
          <DialogTitle className="text-2xl font-bold text-white mb-2">
            Вход в Highlights
          </DialogTitle>
          <DialogDescription className="text-white/70 mb-8 max-w-sm">
            Войдите через Discord, чтобы загружать видео, ставить лайки и оставлять комментарии
          </DialogDescription>

          {/* Discord Login Button */}
          <Button
            onClick={handleDiscordLogin}
            className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-6 text-lg shadow-lg shadow-indigo-500/30 transition-all hover:scale-105"
            data-testid="button-discord-login"
          >
            <SiDiscord className="mr-2 h-6 w-6" />
            Войти через Discord
          </Button>

          {/* Info Text */}
          <p className="text-white/50 text-xs mt-6">
            Нажимая кнопку, вы соглашаетесь с условиями использования
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
