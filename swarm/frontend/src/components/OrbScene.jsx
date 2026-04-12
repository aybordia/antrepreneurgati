// Pure CSS orb — no WebGL, no Three.js, no context loss
export default function OrbScene({ color = "#7B6CFF", speaking = false, size = 200 }) {
  const glow = speaking ? size * 0.5 : size * 0.25;
  const speed = speaking ? "1.2s" : "3s";

  return (
    <div style={{ width: `${size}px`, height: `${size}px`, flexShrink: 0, position: "relative", borderRadius: "50%" }}>
      {/* Outer pulse ring */}
      <div style={{
        position: "absolute",
        inset: speaking ? "-12%" : "-6%",
        borderRadius: "50%",
        border: `1px solid ${color}44`,
        animation: `orbRingPulse ${speed} ease-in-out infinite`,
        pointerEvents: "none",
      }} />
      {/* Mid ring */}
      <div style={{
        position: "absolute",
        inset: speaking ? "-6%" : "-2%",
        borderRadius: "50%",
        border: `1px solid ${color}22`,
        animation: `orbRingPulse ${speed} ease-in-out infinite`,
        animationDelay: "0.3s",
        pointerEvents: "none",
      }} />
      {/* Core orb */}
      <div style={{
        width: "100%", height: "100%",
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 30%, ${color}ff 0%, ${color}cc 30%, ${color}66 65%, ${color}22 100%)`,
        boxShadow: `0 0 ${glow}px ${color}88, 0 0 ${glow * 2}px ${color}33, inset 0 0 ${size * 0.3}px ${color}22`,
        animation: `orbBreath ${speed} ease-in-out infinite`,
        transition: "box-shadow 0.4s ease, background 0.4s ease",
      }} />
      {/* Highlight */}
      <div style={{
        position: "absolute",
        top: "14%", left: "22%",
        width: "28%", height: "18%",
        borderRadius: "50%",
        background: "rgba(255,255,255,0.35)",
        filter: "blur(4px)",
        pointerEvents: "none",
      }} />
      <style>{`
        @keyframes orbBreath {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(${speaking ? 1.06 : 1.02}); }
        }
        @keyframes orbRingPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0; transform: scale(1.18); }
        }
      `}</style>
    </div>
  );
}
