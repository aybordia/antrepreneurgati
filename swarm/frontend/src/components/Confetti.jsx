import { useEffect, useRef } from "react";

const COLORS = [
  "#7B6CFF", "#00D9FF", "#4DDDAA",
  "#c8f064", "#F5A623", "#FF6B9D",
  "#a78bfa", "#34d399", "#60a5fa",
];

const SHAPES = ["rect", "circle", "line"];

export default function Confetti({ active }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    // Burst from center-top where the score ring lives
    const originX = canvas.width / 2;
    const originY = canvas.height * 0.32;

    const particles = Array.from({ length: 80 }, (_, idx) => {
      const angle = (Math.random() * Math.PI * 2);
      const speed = 4 + Math.random() * 10;
      const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      return {
        x: originX + (Math.random() - 0.5) * 40,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6, // bias upward
        color: COLORS[idx % COLORS.length],
        size: 4 + Math.random() * 7,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        gravity: 0.22 + Math.random() * 0.18,
        drag: 0.985,
        opacity: 1,
        shape,
      };
    });

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      particles.forEach(p => {
        if (p.opacity <= 0.01) return;
        alive = true;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= p.drag;
        p.rotation += p.rotSpeed;
        p.opacity -= 0.008;
        if (p.opacity < 0) p.opacity = 0;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;

        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-p.size / 2, 0);
          ctx.lineTo(p.size / 2, 0);
          ctx.stroke();
        }

        ctx.restore();
      });

      if (alive) {
        animRef.current = requestAnimationFrame(draw);
      }
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed", inset: 0,
        pointerEvents: "none",
        zIndex: 500,
        width: "100%", height: "100%",
      }}
    />
  );
}
