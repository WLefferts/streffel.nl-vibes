import { useEffect, useRef } from 'react';

/** Twinkling stars + one shooting star, ported from the original shooting_stars.js. */
export default function Stars() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const stars = Array.from({ length: 150 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      a: Math.random(),
      d: Math.random() * 0.02 + 0.005,
    }));

    const shooter = { x: 0, y: 0, len: 0, speed: 0, alpha: 0 };
    const angle = Math.PI / 4;
    const resetShooter = () => {
      shooter.x = Math.random() * canvas.width;
      shooter.y = (Math.random() * canvas.height) / 2;
      shooter.len = Math.random() * 80 + 10;
      shooter.speed = Math.random() * 10 + 6;
      shooter.alpha = 1;
    };
    resetShooter();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;

    const frame = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const s of stars) {
        if (!reduceMotion) {
          s.a += s.d;
          if (s.a >= 1 || s.a <= 0) s.d = -s.d;
        }
        ctx.globalAlpha = Math.min(1, Math.max(0, s.a));
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduceMotion) {
        shooter.x += shooter.speed * Math.cos(angle);
        shooter.y += shooter.speed * Math.sin(angle);
        shooter.alpha -= 0.01;
        if (shooter.alpha <= 0) resetShooter();
        ctx.globalAlpha = shooter.alpha;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(shooter.x, shooter.y);
        ctx.lineTo(shooter.x - shooter.len * Math.cos(angle), shooter.y - shooter.len * Math.sin(angle));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas id="spaceCanvas" ref={ref} aria-hidden="true" />;
}
