import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function OrbMesh({ color, speaking }) {
  const meshRef = useRef();
  const movingLight = useRef();
  const time = useRef(0);

  const threeColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame((_, delta) => {
    time.current += delta;
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.22;
      meshRef.current.rotation.x = Math.sin(time.current * 0.45) * 0.08;

      const pulse = speaking
        ? 1 + Math.sin(time.current * 5) * 0.055
        : 1 + Math.sin(time.current * 1.2) * 0.012;
      meshRef.current.scale.setScalar(
        THREE.MathUtils.lerp(meshRef.current.scale.x, pulse, 0.1)
      );

      if (meshRef.current.material) {
        meshRef.current.material.emissiveIntensity = THREE.MathUtils.lerp(
          meshRef.current.material.emissiveIntensity,
          speaking ? 0.65 : 0.22,
          0.06
        );
        meshRef.current.material.distort = THREE.MathUtils.lerp(
          meshRef.current.material.distort ?? 0.18,
          speaking ? 0.42 : 0.18,
          0.05
        );
      }
    }
    if (movingLight.current) {
      movingLight.current.position.x = Math.sin(time.current * 0.7) * 2.5;
      movingLight.current.position.y = Math.cos(time.current * 0.5) * 2;
    }
  });

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[3, 3, 4]} intensity={2.5} color={color} />
      <pointLight position={[-3, -1, 2]} intensity={1.2} color="#ffffff" />
      <pointLight ref={movingLight} position={[0, 2, -3]} intensity={1.0} color={color} />
      <pointLight position={[0, -3, 1]} intensity={0.5} color="#6ee7b7" />
      <Sphere ref={meshRef} args={[1, 64, 64]}>
        <MeshDistortMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.22}
          roughness={0.08}
          metalness={0.88}
          distort={0.18}
          speed={speaking ? 4.5 : 2.0}
        />
      </Sphere>
    </>
  );
}

// CSS fallback orb when WebGL is unavailable
function FallbackOrb({ color, speaking, size }) {
  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: "50%",
      background: `radial-gradient(circle at 35% 30%, ${color}ff 0%, ${color}44 60%, ${color}11 100%)`,
      boxShadow: `0 0 ${speaking ? 40 : 20}px ${color}66, 0 0 ${speaking ? 80 : 40}px ${color}22`,
      animation: speaking ? "orbPulse 0.8s ease-in-out infinite" : "orbPulse 3s ease-in-out infinite",
      flexShrink: 0,
    }} />
  );
}

export default function OrbScene({ color = "#7B6CFF", speaking = false, size = 200 }) {
  const [contextLost, setContextLost] = useState(false);

  if (contextLost) {
    return <FallbackOrb color={color} speaking={speaking} size={size} />;
  }

  return (
    <div style={{ width: `${size}px`, height: `${size}px`, flexShrink: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 44 }}
        gl={{ alpha: true, antialias: false, powerPreference: "low-power" }}
        style={{ background: "transparent" }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            setContextLost(true);
          });
        }}
      >
        <OrbMesh color={color} speaking={speaking} />
      </Canvas>
    </div>
  );
}
