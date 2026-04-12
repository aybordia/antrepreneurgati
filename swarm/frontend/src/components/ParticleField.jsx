import { useEffect, useRef } from "react";

const isMobile = window.innerWidth < 768;
const PARTICLE_COUNT = isMobile ? 80 : 160;

export default function ParticleField({ amplitude = 0 }) {
  const canvasRef = useRef(null);
  const amplitudeRef = useRef(amplitude);
  const particles = useRef([]);
  const animRef = useRef(null);

  // Keep amplitudeRef in sync so the draw loop always reads the latest value
  useEffect(() => {
    amplitudeRef.current = amplitude;
  }, [amplitude]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    particles.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      z: Math.random(),               // pseudo-depth 0–1
      vx: (Math.random() - 0.5) * 0.32,
      vy: (Math.random() - 0.5) * 0.32,
      size: Math.random() * 1.8 + 0.4,
      opacity: Math.random() * 0.55 + 0.08,
      hue: [250, 250, 166, 280][Math.floor(Math.random() * 4)], // indigo/indigo/teal/purple
    }));

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      const force = amplitudeRef.current / 100;
      const cx = w / 2;
      const cy = h / 2;

      for (const p of particles.current) {
        if (force > 0.04) {
          const dx = cx - p.x;
          const dy = cy - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 1;
          const strength = force * 28 / dist;
          p.vx += dx * strength * 0.001;
          p.vy += dy * strength * 0.001;
        }

        const speedMult = 1 + p.z * 0.45;
        p.x += p.vx * speedMult;
        p.y += p.vy * speedMult;
        p.vx *= 0.989;
        p.vy *= 0.989;

        if (p.x < -6) p.x = w + 6;
        if (p.x > w + 6) p.x = -6;
        if (p.y < -6) p.y = h + 6;
        if (p.y > h + 6) p.y = -6;

        const depthScale = 0.35 + p.z * 0.65;
        const r = (p.size + force * 2) * depthScale;
        const a = (p.opacity + force * 0.35) * depthScale;

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},78%,72%,${a})`;
        ctx.fill();
      }

      // Connecting lines between nearby particles
      const pts = particles.current;
      const maxDist = 125;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const depthFade = ((a.z + b.z) * 0.5) * 0.18;
            const alpha = (1 - dist / maxDist) * depthFade;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(123,108,255,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}
    />
  );
}
