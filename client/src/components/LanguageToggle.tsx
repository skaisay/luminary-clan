import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'ru' ? 'en' : 'ru');
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleLanguage}
      className="glass glass-border hover-elevate rounded-full h-10 w-10"
      data-testid="button-language-toggle"
      title={language === 'ru' ? 'Switch to English (EN)' : 'Переключить на Русский (RU)'}
    >
      <Languages className="h-5 w-5" strokeWidth={1.5} />
    </Button>
  );
}
