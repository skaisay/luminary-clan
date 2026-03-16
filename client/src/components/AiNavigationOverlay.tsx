import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface NavAction {
  path: string;
  label: string;
}

interface StepInfo {
  current: number;
  total: number;
}

interface Props {
  action: NavAction | null;
  onNavigate: (path: string) => void;
  onComplete: () => void;
  stepInfo?: StepInfo;
}

/*
  Animation phases:
  0 = hidden
  1 = enter (brackets + scale + scan line)
  2 = target card appears in center
  3 = virtual cursor appears at bottom-right
  4 = cursor moves toward target card
  5 = click effect on target
  6 = flash + navigate
  7 = exit (fade out, unscale)
*/

export function AiNavigationOverlay({ action, onNavigate, onComplete, stepInfo }: Props) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!action) { setPhase(0); return; }

    // Scale down the app content behind the overlay
    const root = document.getElementById('root');
    if (root) {
      root.style.transition = 'transform 0.6s cubic-bezier(0.4,0,0.2,1), filter 0.6s ease';
      root.style.transform = 'scale(0.96)';
      root.style.filter = 'brightness(0.7)';
    }
    setPhase(1);

    const t = [
      setTimeout(() => setPhase(2), 400),
      setTimeout(() => setPhase(3), 700),
      setTimeout(() => setPhase(4), 1000),
      setTimeout(() => setPhase(5), 1700),
      setTimeout(() => { setPhase(6); onNavigate(action.path); }, 2000),
      setTimeout(() => {
        setPhase(7);
        if (root) { root.style.transform = ''; root.style.filter = ''; }
      }, 2350),
      setTimeout(() => {
        setPhase(0);
        if (root) root.style.transition = '';
        onComplete();
      }, 2850),
    ];

    return () => {
      t.forEach(clearTimeout);
      if (root) { root.style.transform = ''; root.style.filter = ''; root.style.transition = ''; }
    };
  }, [action]);

  if (phase === 0 || !action) return null;

  const fade = phase === 7;
  const showTarget = phase >= 2;
  const showCursor = phase >= 3 && phase < 7;
  const cursorMoved = phase >= 4;
  const isClick = phase === 5;
  const isFlash = phase === 6;

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        pointerEvents: 'none',
        opacity: fade ? 0 : 1,
        transition: 'opacity 0.45s ease',
      }}
    >
      {/* Animation keyframes */}
      <style>{`
        @keyframes ainBracket{from{opacity:0;transform:scale(1.4)}to{opacity:1;transform:scale(1)}}
        @keyframes ainScan{from{top:0;opacity:.7}to{top:100%;opacity:0}}
        @keyframes ainTarget{from{opacity:0;transform:translate(-50%,-50%) scale(.7)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
        @keyframes ainRipple{from{width:0;height:0;opacity:.5}to{width:120px;height:120px;opacity:0}}
        @keyframes ainFlash{0%{opacity:0}25%{opacity:.22}100%{opacity:0}}
        @keyframes ainGlow{0%,100%{opacity:.4}50%{opacity:1}}
      `}</style>

      {/* Dark backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,.2) 0%, rgba(0,0,0,.45) 100%)',
      }} />

      {/* Scan line sweeps down on entry */}
      {phase === 1 && (
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, transparent 5%, rgba(167,139,250,.5) 30%, rgba(167,139,250,.85) 50%, rgba(167,139,250,.5) 70%, transparent 95%)',
          boxShadow: '0 0 20px rgba(167,139,250,.3)',
          animation: 'ainScan .85s ease-out forwards',
        }} />
      )}

      {/* Corner brackets — L-shaped lines at each corner */}
      {/* Top-left */}
      <div style={{
        position: 'absolute', top: 20, left: 20,
        width: 55, height: 55,
        borderLeft: '2px solid rgba(167,139,250,.6)',
        borderTop: '2px solid rgba(167,139,250,.6)',
        borderRadius: '4px 0 0 0',
        animation: 'ainBracket .3s ease-out 0s both',
      }} />
      {/* Top-right */}
      <div style={{
        position: 'absolute', top: 20, right: 20,
        width: 55, height: 55,
        borderRight: '2px solid rgba(167,139,250,.6)',
        borderTop: '2px solid rgba(167,139,250,.6)',
        borderRadius: '0 4px 0 0',
        animation: 'ainBracket .3s ease-out .06s both',
      }} />
      {/* Bottom-left */}
      <div style={{
        position: 'absolute', bottom: 20, left: 20,
        width: 55, height: 55,
        borderLeft: '2px solid rgba(167,139,250,.6)',
        borderBottom: '2px solid rgba(167,139,250,.6)',
        borderRadius: '0 0 0 4px',
        animation: 'ainBracket .3s ease-out .12s both',
      }} />
      {/* Bottom-right */}
      <div style={{
        position: 'absolute', bottom: 20, right: 20,
        width: 55, height: 55,
        borderRight: '2px solid rgba(167,139,250,.6)',
        borderBottom: '2px solid rgba(167,139,250,.6)',
        borderRadius: '0 0 4px 0',
        animation: 'ainBracket .3s ease-out .18s both',
      }} />

      {/* Corner glow dots */}
      {[
        { top: 20, left: 20 },
        { top: 20, right: 20 },
        { bottom: 20, left: 20 },
        { bottom: 20, right: 20 },
      ].map((pos, i) => (
        <div key={i} style={{
          position: 'absolute', ...pos,
          width: 4, height: 4, borderRadius: '50%',
          background: 'rgba(167,139,250,.55)',
          boxShadow: '0 0 8px rgba(167,139,250,.35)',
          animation: `ainGlow 2s ease-in-out ${i * .12}s infinite`,
        }} />
      ))}

      {/* Target destination card in center */}
      {showTarget && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          animation: 'ainTarget .35s ease-out both',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 32px',
            borderRadius: 20,
            border: `1px solid ${isFlash ? 'rgba(255,255,255,.6)' : isClick ? 'rgba(139,92,246,.5)' : 'rgba(139,92,246,.18)'}`,
            background: isFlash ? 'rgba(255,255,255,.88)' : isClick ? 'rgba(139,92,246,.55)' : 'rgba(139,92,246,.08)',
            backdropFilter: 'blur(24px)',
            boxShadow: isFlash
              ? '0 0 60px rgba(255,255,255,.35)'
              : isClick
                ? '0 0 40px rgba(139,92,246,.4)'
                : '0 0 25px rgba(139,92,246,.08)',
            transform: isClick ? 'scale(.92)' : 'scale(1)',
            transition: 'all .15s ease',
          }}>
            <span style={{
              fontSize: 16, fontWeight: 600, letterSpacing: .3,
              color: isFlash ? '#5b21b6' : '#fff',
              transition: 'color .12s',
            }}>
              {action.label}
            </span>
          </div>

          {/* Click ripple ring */}
          {isClick && (
            <div style={{
              position: 'absolute', left: '50%', top: '50%',
              transform: 'translate(-50%,-50%)',
              borderRadius: '50%',
              border: '1.5px solid rgba(167,139,250,.35)',
              animation: 'ainRipple .6s ease-out forwards',
            }} />
          )}
        </div>
      )}

      {/* Virtual mouse cursor */}
      {showCursor && (
        <div style={{
          position: 'absolute',
          left: cursorMoved ? 'calc(50% + 50px)' : 'calc(100% - 60px)',
          top: cursorMoved ? 'calc(50% + 10px)' : 'calc(100% - 60px)',
          transition: phase >= 4
            ? 'left .7s cubic-bezier(.25,.1,.25,1), top .7s cubic-bezier(.25,.1,.25,1), transform .1s ease'
            : 'transform .1s ease',
          filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.6))',
          transform: isClick ? 'scale(.78)' : 'scale(1)',
        }}>
          {/* Standard arrow cursor */}
          <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
            <path
              d="M2 1L2 19L6.2 15.2C6.3 15.1 6.45 15.05 6.6 15.05L13.5 15.05L2 1Z"
              fill="white" stroke="#1a1a1a" strokeWidth="1.3" strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {/* Full-screen flash on navigate */}
      {isFlash && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(167,139,250,.15) 0%, transparent 60%)',
          animation: 'ainFlash .5s ease-out forwards',
        }} />
      )}

      {/* Status bar at bottom */}
      <div style={{
        position: 'absolute', bottom: 14, left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        {/* Step progress indicator */}
        {stepInfo && stepInfo.total > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {/* Step dots */}
            {Array.from({ length: stepInfo.total }, (_, i) => (
              <div key={i} style={{
                width: i + 1 === stepInfo.current ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i + 1 <= stepInfo.current
                  ? 'rgba(167,139,250,.7)'
                  : 'rgba(167,139,250,.15)',
                boxShadow: i + 1 === stepInfo.current ? '0 0 8px rgba(167,139,250,.4)' : 'none',
                transition: 'all .3s ease',
              }} />
            ))}
            <span style={{
              fontSize: 10, fontFamily: 'monospace',
              letterSpacing: 1,
              color: 'rgba(167,139,250,.55)',
              marginLeft: 4,
            }}>
              {stepInfo.current}/{stepInfo.total}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: 'rgba(167,139,250,.5)',
            boxShadow: '0 0 6px rgba(167,139,250,.3)',
            animation: 'ainGlow 1.5s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: 9, fontFamily: 'monospace',
            letterSpacing: 3,
            color: 'rgba(167,139,250,.35)',
            textTransform: 'uppercase',
          }}>
            {stepInfo && stepInfo.total > 1
              ? `Luminary AI • Step ${stepInfo.current} of ${stepInfo.total}`
              : 'Luminary AI • Navigation'
            }
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
