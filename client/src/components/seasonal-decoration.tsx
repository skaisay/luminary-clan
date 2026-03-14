import { useQuery } from "@tanstack/react-query";
import type { ClanSettings } from "@shared/schema";

export function SeasonalDecoration() {
  const { data: settings } = useQuery<ClanSettings>({
    queryKey: ["/api/clan/settings"],
  });

  const theme = settings?.seasonalTheme || "none";

  if (theme === "none") return null;

  return (
    <>
      {theme === "halloween" && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute text-4xl animate-float opacity-70"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${3 + Math.random() * 2}s`,
                }}
              >
                🎃
              </div>
            ))}
          </div>
        </div>
      )}

      {theme === "newyear" && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="absolute text-2xl opacity-80"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-10%`,
                  animation: `snowfall ${5 + Math.random() * 5}s linear infinite`,
                  animationDelay: `${Math.random() * 5}s`,
                }}
              >
                ❄️
              </div>
            ))}
          </div>
          <style>{`
            @keyframes snowfall {
              to {
                transform: translateY(110vh) rotate(360deg);
              }
            }
          `}</style>
        </div>
      )}

      {theme === "christmas" && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full">
            {[...Array(25)].map((_, i) => (
              <div
                key={i}
                className="absolute text-3xl animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 1}s`,
                }}
              >
                {["🎄", "⭐", "🎁", "🔔"][Math.floor(Math.random() * 4)]}
              </div>
            ))}
          </div>
        </div>
      )}

      {theme === "easter" && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full">
            {[...Array(15)].map((_, i) => (
              <div
                key={i}
                className="absolute text-3xl animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 1}s`,
                }}
              >
                {["🐰", "🥚", "🌸", "🐣"][Math.floor(Math.random() * 4)]}
              </div>
            ))}
          </div>
        </div>
      )}

      {theme === "valentine" && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute text-3xl animate-pulse opacity-75"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                }}
              >
                💕
              </div>
            ))}
          </div>
        </div>
      )}

      {theme === "summer" && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="absolute text-4xl animate-float opacity-80"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${4 + Math.random() * 2}s`,
                }}
              >
                {["☀️", "🌊", "🏖️", "🍉"][Math.floor(Math.random() * 4)]}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
