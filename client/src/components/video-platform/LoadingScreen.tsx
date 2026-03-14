import { useState, useEffect, useRef } from "react";

interface LoadingScreenProps {
  onComplete: () => void;
}

declare global {
  interface Window {
    butterfliesBackground?: any;
  }
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const butterfliesInstanceRef = useRef<any>(null);
  const onCompleteRef = useRef(onComplete);
  
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Предзагрузка фонового изображения
  useEffect(() => {
    const bgSettings = localStorage.getItem('videoPlatformBackground');
    if (bgSettings) {
      if (bgSettings === "background1" || bgSettings === "background2" || bgSettings === "background3") {
        setBackgroundLoaded(true);
      } else {
        try {
          const bg = JSON.parse(bgSettings);
          if (bg.type === 'image' && bg.url) {
            const img = new Image();
            img.onload = () => setBackgroundLoaded(true);
            img.onerror = () => setBackgroundLoaded(true);
            img.src = bg.url;
          } else {
            setBackgroundLoaded(true);
          }
        } catch {
          setBackgroundLoaded(true);
        }
      }
    } else {
      setBackgroundLoaded(true);
    }
  }, []);

  // Загрузка библиотеки threejs-toys с timeout
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const loadScript = () => {
      const script = document.createElement('script');
      script.type = 'module';
      script.innerHTML = `
        import { butterfliesBackground } from 'https://unpkg.com/threejs-toys@0.0.8/build/threejs-toys.module.cdn.min.js';
        window.butterfliesBackground = butterfliesBackground;
        window.dispatchEvent(new Event('butterflies-loaded'));
      `;
      
      script.onerror = () => {
        console.warn('Failed to load butterflies animation, continuing without it');
        setLibraryLoaded(true);
      };
      
      document.head.appendChild(script);
    };

    const handleLoaded = () => {
      clearTimeout(timeoutId);
      setLibraryLoaded(true);
    };

    // Timeout: если библиотека не загрузится за 3 секунды, продолжаем без неё
    timeoutId = setTimeout(() => {
      console.warn('Butterflies library load timeout, continuing without animation');
      setLibraryLoaded(true);
    }, 3000);

    window.addEventListener('butterflies-loaded', handleLoaded);
    loadScript();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('butterflies-loaded', handleLoaded);
    };
  }, []);

  // Инициализация Three.js анимации бабочек
  useEffect(() => {
    if (!canvasContainerRef.current || !backgroundLoaded || !libraryLoaded) return;
    if (!window.butterfliesBackground) {
      console.warn('Butterflies library not available, skipping animation');
      return;
    }

    try {
      butterfliesInstanceRef.current = window.butterfliesBackground({
        el: canvasContainerRef.current,
        eventsEl: document.body,
        gpgpuSize: 18,
        background: 0x000000, // Черный фон вместо синего
        material: 'phong',
        lights: [
          { type: 'ambient', params: [0xffffff, 0.5] },
          { type: 'directional', params: [0xffffff, 1], props: { position: [10, 0, 0] } }
        ],
        materialParams: { transparent: true, alphaTest: 0.5 },
        texture: 'https://assets.codepen.io/33787/butterflies.png',
        textureCount: 4,
        wingsScale: [2, 2, 2],
        wingsWidthSegments: 16,
        wingsHeightSegments: 16,
        wingsSpeed: 0.75,
        wingsDisplacementScale: 1.25,
        noiseCoordScale: 0.01,
        noiseTimeCoef: 0.0005,
        noiseIntensity: 0.0025,
        attractionRadius1: 100,
        attractionRadius2: 150,
        maxVelocity: 0.1
      });
    } catch (error) {
      console.error('Failed to initialize butterflies animation:', error);
    }

    return () => {
      if (butterfliesInstanceRef.current && butterfliesInstanceRef.current.dispose) {
        butterfliesInstanceRef.current.dispose();
      }
    };
  }, [backgroundLoaded, libraryLoaded]);

  // Автоматический запуск загрузки после предзагрузки фона и библиотеки
  useEffect(() => {
    if (!backgroundLoaded || !libraryLoaded) return;

    const duration = 2000; // 2 секунды
    const steps = 100;
    const stepDuration = duration / steps;
    
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 1;
      setProgress(currentProgress);
      
      if (currentProgress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          onCompleteRef.current();
        }, 300);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [backgroundLoaded, libraryLoaded]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Three.js Canvas контейнер */}
      <div 
        ref={canvasContainerRef} 
        className="absolute inset-0"
        style={{ 
          overflow: 'hidden',
          touchAction: 'pan-up'
        }}
      />

      {/* Контент поверх анимации */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {/* Логотип с бабочкой */}
        <div className="mb-12 text-center">
          <h1 
            className="text-6xl md:text-7xl font-bold text-white tracking-tight"
            style={{
              textShadow: '0 0 5px #000000, 0 0 20px #000'
            }}
          >
            <span className="inline-block animate-flap">🦋</span>
            <br />
            Highlights
          </h1>
        </div>

        {/* Прогресс бар */}
        <div className="w-full max-w-2xl px-8">
          <div className="relative">
            <div 
              className="w-full h-1 bg-white/20 backdrop-blur-sm rounded-full overflow-hidden"
              data-testid="loading-progress-bar"
              style={{
                boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)'
              }}
            >
              <div 
                className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-lg shadow-cyan-500/50 transition-all duration-100 ease-out"
                style={{ width: `${progress}%` }}
                data-testid="loading-progress-fill"
              />
            </div>
            
            <p 
              className="text-white/60 text-sm font-light mt-6 text-center"
              data-testid="loading-progress-text"
              style={{
                textShadow: '0 0 5px #000000, 0 0 10px #000'
              }}
            >
              {progress}%
            </p>
          </div>
        </div>
      </div>

      {/* Анимация взмаха бабочки */}
      <style>{`
        @keyframes flap {
          0%, 20%, 80%, 100% {
            transform: scaleX(1) rotate(5deg);
          }
          50% {
            transform: scaleX(0.7) rotate(7deg);
          }
        }
        .animate-flap {
          display: inline-block;
          animation: flap 0.75s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
