import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, ChevronUp } from "lucide-react";

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);

    return () => {
      window.removeEventListener("scroll", toggleVisibility);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
      }`}
    >
      <Button
        onClick={scrollToTop}
        size="icon"
        className="h-12 w-12 rounded-full glass glass-border neon-glow-cyan shadow-lg hover:scale-110 transition-transform"
        data-testid="button-scroll-to-top"
        aria-label="Прокрутить наверх"
      >
        <ChevronUp className="h-6 w-6" />
      </Button>
      
      {/* Подсказка при наведении */}
      <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="glass glass-border rounded-lg px-3 py-1.5 text-sm whitespace-nowrap">
          Наверх
        </div>
      </div>
    </div>
  );
}
