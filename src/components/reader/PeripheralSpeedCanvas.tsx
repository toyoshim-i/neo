import React, { useEffect, useRef } from 'react';

interface PeripheralSpeedCanvasProps {
  wpm: number;
  active: boolean;
}

/**
 * Renders peripheral speed streaks along the outer left/right edges when WPM >= 300.
 * Never draws inside the central reading zone to preserve 100% text clarity.
 */
export const PeripheralSpeedCanvas: React.FC<PeripheralSpeedCanvasProps> = ({
  wpm,
  active,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active || wpm < 280) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const streaks = Array.from({ length: 24 }, (_, idx) => ({
      side: idx % 2 === 0 ? ('left' as const) : ('right' as const),
      xRatio: Math.random() * 0.14, // Outer 14% margin only
      y: Math.random() * window.innerHeight,
      len: 40 + Math.random() * 90,
      speed: 2 + Math.random() * 4,
    }));

    const render = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const intensity = Math.min(1, Math.max(0, (wpm - 280) / 220));
      const speedMult = 1 + (wpm - 280) / 120;
      const isOverclock = wpm >= 400;

      // Subtle corner aura when >= 400 WPM
      if (isOverclock) {
        const gradLeft = ctx.createLinearGradient(0, 0, width * 0.14, 0);
        gradLeft.addColorStop(0, `rgba(255, 30, 122, ${0.09 * intensity})`);
        gradLeft.addColorStop(1, 'rgba(255, 30, 122, 0)');
        ctx.fillStyle = gradLeft;
        ctx.fillRect(0, 0, width * 0.14, height);

        const gradRight = ctx.createLinearGradient(width, 0, width * 0.86, 0);
        gradRight.addColorStop(0, `rgba(0, 245, 212, ${0.09 * intensity})`);
        gradRight.addColorStop(1, 'rgba(0, 245, 212, 0)');
        ctx.fillStyle = gradRight;
        ctx.fillRect(width * 0.86, 0, width * 0.14, height);
      }

      streaks.forEach((s) => {
        s.y -= s.speed * speedMult;
        if (s.y + s.len < 0) {
          s.y = height + 20;
        }
        const x =
          s.side === 'left'
            ? width * s.xRatio
            : width - width * s.xRatio;

        ctx.strokeStyle =
          isOverclock && s.side === 'left'
            ? `rgba(255, 30, 122, ${0.22 * intensity})`
            : `rgba(0, 245, 212, ${0.22 * intensity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, s.y);
        ctx.lineTo(x, s.y + s.len);
        ctx.stroke();
      });

      animId = window.requestAnimationFrame(render);
    };

    animId = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [wpm, active]);

  if (!active || wpm < 280) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-10"
    />
  );
};
