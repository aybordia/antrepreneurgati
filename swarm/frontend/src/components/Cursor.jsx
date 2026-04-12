import { useEffect, useRef } from "react";

export default function Cursor() {
  const dotRef  = useRef(null);
  const ringRef = useRef(null);
  const pos     = useRef({ x: -100, y: -100 });
  const ring    = useRef({ x: -100, y: -100 });
  const raf     = useRef(null);
  const hover   = useRef(false);

  useEffect(() => {
    const onMove = (e) => { pos.current = { x: e.clientX, y: e.clientY }; };
    const onOver = (e) => {
      const t = e.target.closest("button, a, input, textarea, [data-cursor]");
      hover.current = !!t;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseover", onOver);

    const lerp = (a, b, t) => a + (b - a) * t;

    const tick = () => {
      ring.current.x = lerp(ring.current.x, pos.current.x, 0.12);
      ring.current.y = lerp(ring.current.y, pos.current.y, 0.12);

      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${pos.current.x - 3}px, ${pos.current.y - 3}px)`;
      }
      if (ringRef.current) {
        const scale = hover.current ? 1.8 : 1;
        ringRef.current.style.transform = `translate(${ring.current.x - 18}px, ${ring.current.y - 18}px) scale(${scale})`;
        ringRef.current.style.borderColor = hover.current
          ? "rgba(123,108,255,0.7)"
          : "rgba(255,255,255,0.22)";
        ringRef.current.style.background = hover.current
          ? "rgba(123,108,255,0.06)"
          : "transparent";
      }
      raf.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <>
      {/* Trailing ring */}
      <div ref={ringRef} style={{
        position: "fixed", top: 0, left: 0,
        width: 36, height: 36, borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.22)",
        pointerEvents: "none", zIndex: 99999,
        willChange: "transform",
        transition: "border-color 0.2s, background 0.2s, transform 0.15s cubic-bezier(0.16,1,0.3,1)",
        mixBlendMode: "difference",
      }} />
      {/* Sharp dot */}
      <div ref={dotRef} style={{
        position: "fixed", top: 0, left: 0,
        width: 6, height: 6, borderRadius: "50%",
        background: "white",
        pointerEvents: "none", zIndex: 99999,
        willChange: "transform",
        mixBlendMode: "difference",
      }} />
    </>
  );
}
