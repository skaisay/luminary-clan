import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import splashImage from "@assets/splash-image.jpg";

interface SplashScreenProps {
  onComplete: () => void;
  clanName?: string;
  splashImageUrl?: string;
  cacheVersion?: string;
}

export default function SplashScreen({ onComplete, clanName = "LUMINARY", splashImageUrl, cacheVersion }: SplashScreenProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>("");

  useEffect(() => {
    if (splashImageUrl) {
      const srcWithCache = cacheVersion 
        ? `${splashImageUrl}?v=${new Date(cacheVersion).getTime()}`
        : splashImageUrl;
      
      const img = new Image();
      img.onload = () => {
        setImageSrc(srcWithCache);
        setImageLoaded(true);
      };
      img.onerror = () => {
        setImageSrc(splashImage);
        setImageLoaded(true);
      };
      img.src = srcWithCache;
    } else {
      setImageSrc(splashImage);
      setImageLoaded(true);
    }
  }, [splashImageUrl, cacheVersion]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes dissolve {
        0% {
          filter: url(#dissolve-filter);
          transform: scale(1);
          opacity: 1;
        }
        50% {
          filter: url(#dissolve-filter);
          transform: scale(1.1);
          opacity: 1;
        }
        100% {
          filter: url(#dissolve-filter);
          transform: scale(1.1);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const handleStart = () => {
    setIsAnimating(true);
    
    const img = document.getElementById("splash-image") as HTMLElement;
    const disp = document.querySelector("#dissolve-filter feDisplacementMap") as SVGFEDisplacementMapElement;
    const bNoise = document.querySelector('#dissolve-filter feTurbulence[result="bigNoise"]') as SVGFETurbulenceElement;
    
    // Проверка на мобильные устройства
    const isMobile = window.innerWidth < 768;
    
    if (!img) {
      onComplete();
      return;
    }

    // На мобильных используем простую анимацию без SVG фильтров
    if (isMobile || !disp || !bNoise) {
      const config = { duration: 1000, ease: (t: number) => 1 - Math.pow(1 - t, 3) };
      const start = performance.now();
      
      const animate = (now: number) => {
        const elapsed = now - start;
        const t = Math.min(elapsed / config.duration, 1);
        const eased = config.ease(t);
        
        img.style.transform = `scale(${1 + 0.2 * eased})`;
        img.style.opacity = String(1 - eased);
        
        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          setTimeout(onComplete, 100);
        }
      };
      
      requestAnimationFrame(animate);
      return;
    }

    // На десктопе используем полную анимацию с фильтром
    const config = { duration: 1000, maxScale: 2000, ease: (t: number) => 1 - Math.pow(1 - t, 3) };
    bNoise.setAttribute("seed", String(Math.floor(Math.random() * 1000)));
    
    const start = performance.now();
    
    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / config.duration, 1);
      const eased = config.ease(t);
      
      disp.setAttribute("scale", String(eased * config.maxScale));
      img.style.transform = `scale(${1 + 0.1 * eased})`;
      img.style.opacity = t < 0.5 ? "1" : String(1 - (t - 0.5) / 0.5);
      
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        setTimeout(onComplete, 100);
      }
    };
    
    requestAnimationFrame(animate);
  };

  if (!imageLoaded) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="animate-pulse text-white text-2xl" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <svg xmlns="http://www.w3.org/2000/svg" style={{ display: "none" }}>
        <defs>
          <filter
            id="dissolve-filter"
            x="-200%"
            y="-200%"
            width="500%"
            height="500%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves={1} result="bigNoise" />
            <feComponentTransfer in="bigNoise" result="bigNoiseAdjusted">
              <feFuncR type="linear" slope="5" intercept="-2" />
              <feFuncG type="linear" slope="5" intercept="-2" />
            </feComponentTransfer>
            <feTurbulence type="fractalNoise" baseFrequency="1" numOctaves={1} result="fineNoise" />
            <feMerge result="mergedNoise">
              <feMergeNode in="bigNoiseAdjusted" />
              <feMergeNode in="fineNoise" />
            </feMerge>
            <feDisplacementMap
              in="SourceGraphic"
              in2="mergedNoise"
              scale="0"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <div className="relative w-full h-full flex items-center justify-center p-4 md:p-8">
        {/* Название: на мобильных сверху по центру, на десктопе в левом верхнем углу */}
        {!isAnimating && (
          <>
            <div className="absolute top-6 left-6 md:top-8 md:left-8 z-20 md:block hidden">
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-wider" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                {clanName}
              </h1>
            </div>
            <div className="mb-6 md:hidden z-20 absolute top-6">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-wider text-center" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                {clanName}
              </h1>
            </div>
          </>
        )}

        {/* Контейнер с изображением - адаптивный */}
        <div className="relative w-full max-w-[90vw] sm:max-w-[500px] md:max-w-[600px] aspect-square rounded-3xl overflow-visible">
          <img
            id="splash-image"
            src={imageSrc}
            alt="Splash"
            className="w-full h-full object-cover rounded-3xl"
            style={{
              filter: window.innerWidth >= 768 ? "url(#dissolve-filter)" : "none",
              WebkitFilter: window.innerWidth >= 768 ? "url(#dissolve-filter)" : "none",
              transform: "scale(1)",
              opacity: 1,
              willChange: "transform, opacity",
            }}
          />
          
          {!isAnimating && (
            <div className="absolute inset-0 flex items-end justify-center pb-8 md:pb-12">
              <Button
                data-testid="button-start-splash"
                onClick={handleStart}
                size="default"
                className="bg-cyan-500/40 hover:bg-cyan-500/60 text-white font-semibold px-6 sm:px-8 py-2 sm:py-3 text-sm sm:text-base rounded-lg border border-cyan-400/30 transition-all hover:scale-105 active:scale-95"
              >
                Start
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
