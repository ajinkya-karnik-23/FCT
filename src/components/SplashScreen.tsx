import { useEffect, useRef, useState, useCallback } from 'react'
import { colors } from '../theme/tokens'

/**
 * SplashScreen — full-screen animated shader gradient shown on app boot:
 * a 3D ShaderGradient liquid sphere/water plane with animated gold icon &
 * shimmer title.
 *
 * Auto-dismisses after ~3.5s, or click anywhere to skip.
 */

const MIN_SPLASH_MS = 3500

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [fading, setFading] = useState(false)
  const completeCalled = useRef(false)

  const finish = useCallback(() => {
    if (completeCalled.current) return
    completeCalled.current = true
    setFading(true)
    setTimeout(onComplete, 900)
  }, [onComplete])

  // Auto-dismiss after minimum splash time
  useEffect(() => {
    const timer = setTimeout(finish, MIN_SPLASH_MS)
    return () => clearTimeout(timer)
  }, [finish])

  return (
    <div
      onClick={finish}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: colors.bgRoot,
        cursor: 'pointer',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.045,
          mixBlendMode: 'soft-light',
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23g)'/></svg>")`,
        }}
      />

      {/* Centered icon + title overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 1,
          gap: 24,
        }}
      >
        {/* Tower icon — animated stroke draw-on */}
        <div
          style={{
            opacity: fading ? 0 : 1,
            transform: fading ? 'scale(0.9)' : 'scale(1)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
            animation: 'splash-icon-in 1s cubic-bezier(0.16, 1, 0.3, 1) both',
          }}
        >
          <svg
            width="132"
            height="220"
            viewBox="0 0 100 170"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ overflow: 'visible', filter: 'drop-shadow(0 0 18px rgba(255, 255, 255, 0.18))' }}
          >
            {/* Soft fill so the silhouette reads as a solid tower */}
            <g
              fill="rgba(255, 255, 255, 0.12)"
              stroke="none"
              style={{ animation: 'splash-beacon 0.6s 0.35s ease both' }}
            >
              <path d="M12 158 L88 158 L70 48 L30 48 Z" />
              <path d="M30 43 L70 43 L64 20 L36 20 Z" />
              <path d="M26 20 Q50 3 74 20 Z" />
            </g>

            {/* Island / rock base */}
            <path
              d="M4 166 C22 148 36 145 50 145 C64 145 78 148 96 166"
              stroke="#ffffff"
              strokeWidth="3.2"
              strokeLinecap="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1,
                animation: 'splash-stroke 0.7s 0.12s cubic-bezier(0.4, 0, 0.2, 1) forwards',
              }}
            />

            {/* Tapered body */}
            <path
              d="M12 158 L88 158 L70 48 L30 48 Z"
              stroke="#ffffff"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1,
                animation: 'splash-stroke 1.05s 0.18s cubic-bezier(0.4, 0, 0.2, 1) forwards',
              }}
            />

            {/* Stripe bands */}
            <path
              d="M24 120 L76 120 L72 96 L28 96 Z"
              stroke="#ffffff"
              strokeWidth="2.4"
              strokeLinejoin="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1,
                animation: 'splash-stroke 0.6s 0.7s ease forwards',
              }}
            />
            <path
              d="M32 70 L68 70 L66 52 L34 52 Z"
              stroke="#ffffff"
              strokeWidth="2.4"
              strokeLinejoin="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1,
                animation: 'splash-stroke 0.55s 0.82s ease forwards',
              }}
            />

            {/* Gallery deck */}
            <path
              d="M16 48 H84 V42 H16 Z"
              stroke="#ffffff"
              strokeWidth="2.6"
              strokeLinejoin="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1,
                animation: 'splash-stroke 0.5s 0.75s ease forwards',
              }}
            />
            <path
              d="M22 42 V35 M34 42 V35 M50 42 V35 M66 42 V35 M78 42 V35"
              stroke="#ffffff"
              strokeWidth="2.4"
              strokeLinecap="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1,
                animation: 'splash-stroke 0.4s 0.95s ease forwards',
              }}
            />
            <path
              d="M10 35 H90"
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinecap="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1,
                animation: 'splash-stroke 0.4s 1s ease forwards',
              }}
            />

            {/* Lantern house */}
            <path
              d="M32 43 L68 43 L62 20 L38 20 Z"
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1,
                animation: 'splash-stroke 0.7s 0.45s cubic-bezier(0.4, 0, 0.2, 1) forwards',
              }}
            />
            <path
              d="M42 43 L44 20 M50 43 V20 M58 43 L56 20"
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinecap="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1,
                animation: 'splash-stroke 0.45s 1.05s ease forwards',
              }}
            />

            {/* Dome roof + finial */}
            <path
              d="M26 20 Q50 2 74 20"
              stroke="#ffffff"
              strokeWidth="3.2"
              strokeLinecap="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1,
                animation: 'splash-stroke 0.55s 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards',
              }}
            />
            <path
              d="M50 8 V1"
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinecap="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1,
                animation: 'splash-stroke 0.3s 1.1s ease forwards',
              }}
            />
            <circle
              cx="50"
              cy="1.5"
              r="2.8"
              fill="#ffffff"
              style={{ animation: 'splash-beacon 0.35s 1.15s ease both' }}
            />

            {/* Lantern hub */}
            <circle
              cx="50"
              cy="32"
              r="4.2"
              fill="#ffffff"
              style={{ animation: 'splash-beacon 0.4s 0.9s ease both' }}
            />
          </svg>
        </div>

        {/* Title with gold shimmer */}
        <div
          className="splash-title"
          style={{
            fontSize: 58,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#ffffff',
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
            textShadow: '0 0 28px rgba(255, 255, 255, 0.28)',
            opacity: fading ? 0 : 1,
            transform: fading ? 'translateY(-12px)' : 'translateY(0)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
            animation: 'splash-title-in 1s 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
            position: 'relative',
          }}
        >
          Finance Control Tower
        </div>
      </div>

      <style>{`
        @keyframes splash-icon-in {
          0% {
            opacity: 0;
            transform: scale(0.6) translateY(16px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes splash-stroke {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes splash-beacon {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes splash-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes splash-draw {
          0% {
            opacity: 0;
            transform: scaleX(0);
          }
          100% {
            opacity: 0.9;
            transform: scaleX(1);
          }
        }
        @keyframes splash-title-in {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.97);
            filter: blur(6px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0px);
          }
        }
        @keyframes splash-shimmer {
          0% {
            background-position: -200% center;
          }
          100% {
            background-position: 200% center;
          }
        }
        .splash-title {
          background: linear-gradient(
            90deg,
            #ffffff 0%,
            #ffffff 35%,
            #d8d8d8 50%,
            #ffffff 65%,
            #ffffff 100%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation:
            splash-title-in 1s 0.3s cubic-bezier(0.16, 1, 0.3, 1) both,
            splash-shimmer 3s 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

