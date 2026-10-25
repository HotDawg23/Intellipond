import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, MeshDistortMaterial, Sphere } from "@react-three/drei";
import { useMemo, useRef, Suspense, type ComponentRef } from "react";
import * as THREE from "three";
import { useCanvasVisibility } from "@/hooks/use-canvas-visibility";
import MilkfishModel from "@/components/MilkfishModel";

function Fish({ position, color, speed = 1, scale = 1 }: { position: [number, number, number]; color: string; speed?: number; scale?: number }) {
  const ref = useRef<THREE.Group>(null!);
  const offset = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + offset;
    if (!ref.current) return;
    ref.current.position.x = position[0] + Math.sin(t * 0.4) * 1.4;
    ref.current.position.y = position[1] + Math.sin(t * 0.8) * 0.25;
    ref.current.position.z = position[2] + Math.cos(t * 0.4) * 0.6;
    ref.current.rotation.y = Math.atan2(0.24 * Math.sin(t * 0.4), 0.56 * Math.cos(t * 0.4));
    ref.current.rotation.z = Math.sin(t * 2) * 0.15;
  });
  return (
    <group ref={ref} scale={scale}>
      <MilkfishModel color={color} speed={speed} />
    </group>
  );
}

function Bubbles() {
  const group = useRef<THREE.Group>(null!);
  const bubbles = useMemo(
    () => new Array(18).fill(0).map(() => ({
      x: (Math.random() - 0.5) * 6,
      z: (Math.random() - 0.5) * 3,
      speed: 0.3 + Math.random() * 0.6,
      size: 0.05 + Math.random() * 0.12,
      offset: Math.random() * 5,
    })),
    []
  );
  useFrame((state) => {
    if (!group.current) return;
    group.current.children.forEach((c, i) => {
      const b = bubbles[i];
      const t = (state.clock.elapsedTime * b.speed + b.offset) % 5;
      c.position.y = -2 + t;
      (c as THREE.Mesh).scale.setScalar(1 - t / 6);
    });
  });
  return (
    <group ref={group}>
      {bubbles.map((b, i) => (
        <mesh key={i} position={[b.x, -2, b.z]}>
          <sphereGeometry args={[b.size, 16, 16]} />
          <meshStandardMaterial color="#9be8ff" transparent opacity={0.5} roughness={0} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

function WaterBlob() {
  const ref = useRef<ComponentRef<typeof MeshDistortMaterial>>(null!);
  useFrame((state) => {
    if (ref.current) ref.current.distort = 0.35 + Math.sin(state.clock.elapsedTime) * 0.08;
  });
  return (
    <Sphere args={[2.4, 64, 64]} position={[0, 0, -1.5]}>
      <MeshDistortMaterial ref={ref} color="#0a4a6e" speed={1.5} distort={0.4} roughness={0.1} metalness={0.3} transparent opacity={0.35} />
    </Sphere>
  );
}

export const PondScene = () => {
  const { containerRef, isVisible } = useCanvasVisibility(true);

  return (
    <div ref={containerRef} className="h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 40 }}
        dpr={[1, 1.25]}
        frameloop={isVisible ? "always" : "never"}
        resize={{ scroll: false }}
        style={{ width: "100%", height: "100%", display: "block" }}
        className="touch-pan-y"
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} color="#9be8ff" />
          <pointLight position={[-3, -2, 2]} intensity={1} color="#3ec6e0" />
          <WaterBlob />
          <Float speed={2} rotationIntensity={0.4} floatIntensity={0.6}>
            <Fish position={[0, 0.6, 0]} color="#c5d8e0" speed={0.8} scale={1.2} />
          </Float>
          <Float speed={1.6} rotationIntensity={0.3} floatIntensity={0.5}>
            <Fish position={[1.2, -0.8, 0.5]} color="#7fb8d1" speed={1.1} scale={0.9} />
          </Float>
          <Float speed={1.8} rotationIntensity={0.4} floatIntensity={0.6}>
            <Fish position={[-1.4, -0.2, -0.3]} color="#a8c8d6" speed={0.95} scale={0.8} />
          </Float>
          <Bubbles />
          <Environment preset="sunset" />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default PondScene;
