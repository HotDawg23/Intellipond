import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCanvasVisibility } from "@/hooks/use-canvas-visibility";
import MilkfishModel from "@/components/MilkfishModel";

function Bangus({ depth, color, speed, scale, yBase }: { depth: number; color: string; speed: number; scale: number; yBase: number }) {
  const ref = useRef<THREE.Group>(null!);
  const offset = useMemo(() => Math.random() * Math.PI * 2, []);
  const dir = useMemo(() => (Math.random() > 0.5 ? 1 : -1), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + offset;
    const x = Math.sin(t * 0.35) * 3.2 * dir;
    const y = yBase + Math.sin(t * 0.9) * 0.3;
    ref.current.position.set(x, y, depth);
    // face direction of motion
    const vx = Math.cos(t * 0.35) * 0.35 * dir;
    ref.current.rotation.y = vx >= 0 ? 0 : Math.PI;
    ref.current.rotation.z = Math.sin(t * 3) * 0.18;
  });
  return (
    <group ref={ref} scale={scale}>
      <MilkfishModel color={color} speed={speed} />
    </group>
  );
}

function Seaweed({ x, z, height, hue }: { x: number; z: number; height: number; hue: string }) {
  const ref = useRef<THREE.Group>(null!);
  const offset = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame((state) => {
    const t = state.clock.elapsedTime + offset;
    if (ref.current) ref.current.rotation.z = Math.sin(t * 1.2) * 0.15;
  });
  return (
    <group ref={ref} position={[x, -1.6, z]}>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.04, 0.06, height, 8]} />
        <meshStandardMaterial color={hue} roughness={0.8} />
      </mesh>
      <mesh position={[0, height + 0.05, 0]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color={hue} roughness={0.7} />
      </mesh>
    </group>
  );
}

function SandFloor({ brightness }: { brightness: number }) {
  const ref = useRef<THREE.ShaderMaterial>(null!);
  useFrame((state) => {
    if (ref.current) {
      ref.current.uniforms.uTime.value = state.clock.elapsedTime;
      ref.current.uniforms.uBrightness.value = brightness;
    }
  });
  return (
    <mesh position={[0, -1.7, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[12, 8, 1, 1]} />
      <shaderMaterial
        ref={ref}
        uniforms={{
          uTime: { value: 0 },
          uBrightness: { value: brightness },
          uSand: { value: new THREE.Color("#cbb486") },
          uCaustic: { value: new THREE.Color("#dff6ff") },
        }}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          uniform float uTime;
          uniform float uBrightness;
          uniform vec3 uSand;
          uniform vec3 uCaustic;

          float caustic(vec2 uv, float t) {
            vec2 p = uv * 6.0;
            float a = sin(p.x * 1.3 + t * 0.9) + sin(p.y * 1.7 - t * 1.1);
            float b = sin((p.x + p.y) * 1.1 + t * 0.7) + sin((p.x - p.y) * 1.4 - t * 0.8);
            float c = sin(length(p - vec2(sin(t*0.5), cos(t*0.4))) * 2.0 - t * 1.2);
            float v = (a + b + c) / 6.0 + 0.5;
            v = pow(clamp(v, 0.0, 1.0), 3.0);
            return v;
          }

          void main() {
            float c = caustic(vUv, uTime);
            vec3 col = mix(uSand, uCaustic, clamp(c * uBrightness, 0.0, 1.0));
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

function WaterSurface({ intensity }: { intensity: number }) {
  const ref = useRef<THREE.ShaderMaterial>(null!);
  useFrame((state) => {
    if (ref.current) {
      ref.current.uniforms.uTime.value = state.clock.elapsedTime;
      ref.current.uniforms.uIntensity.value = intensity;
    }
  });
  return (
    <mesh position={[0, 1.65, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[12, 8, 64, 48]} />
      <shaderMaterial
        ref={ref}
        transparent
        side={THREE.DoubleSide}
        uniforms={{
          uTime: { value: 0 },
          uIntensity: { value: intensity },
          uColor: { value: new THREE.Color("#9be8ff") },
          uDeep: { value: new THREE.Color("#0a4a6e") },
        }}
        vertexShader={`
          varying float vWave;
          uniform float uTime;
          uniform float uIntensity;
          void main() {
            vec3 p = position;
            float w = sin(p.x * 1.8 + uTime * 1.2) * 0.06
                    + sin(p.y * 2.4 - uTime * 0.9) * 0.05
                    + sin((p.x + p.y) * 1.5 + uTime * 0.6) * 0.04;
            w *= uIntensity;
            p.z += w;
            vWave = w;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `}
        fragmentShader={`
          varying float vWave;
          uniform vec3 uColor;
          uniform vec3 uDeep;
          void main() {
            float shimmer = smoothstep(-0.05, 0.08, vWave);
            vec3 col = mix(uDeep, uColor, shimmer);
            float alpha = 0.25 + shimmer * 0.35;
            gl_FragColor = vec4(col, alpha);
          }
        `}
      />
    </mesh>
  );
}

function Bubbles({ count = 24 }: { count?: number }) {
  const group = useRef<THREE.Group>(null!);
  const items = useMemo(
    () => new Array(count).fill(0).map(() => ({
      x: (Math.random() - 0.5) * 6,
      z: (Math.random() - 0.5) * 2,
      speed: 0.4 + Math.random() * 0.7,
      size: 0.04 + Math.random() * 0.1,
      offset: Math.random() * 6,
    })),
    [count]
  );
  useFrame((state) => {
    if (!group.current) return;
    group.current.children.forEach((c, i) => {
      const b = items[i];
      const t = (state.clock.elapsedTime * b.speed + b.offset) % 4;
      c.position.y = -1.6 + t;
      c.position.x = b.x + Math.sin(t * 2) * 0.08;
      (c as THREE.Mesh).scale.setScalar(Math.max(0.1, 1 - t / 5));
    });
  });
  return (
    <group ref={group}>
      {items.map((b, i) => (
        <mesh key={i} position={[b.x, -1.6, b.z]}>
          <sphereGeometry args={[b.size, 12, 12]} />
          <meshStandardMaterial color="#bff1ff" transparent opacity={0.55} roughness={0} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}


type AquariumSceneProps = {
  rippleIntensity?: number;
  causticsBrightness?: number;
};

export const AquariumScene = ({ rippleIntensity = 1, causticsBrightness = 0.7 }: AquariumSceneProps) => {
  const { containerRef, isVisible } = useCanvasVisibility(false);
  const fish = useMemo(
    () => [
      { depth: 0.2, color: "#cdd9df", speed: 0.7, scale: 1.1, yBase: 0.4 },
      { depth: -0.4, color: "#9fc2d3", speed: 0.85, scale: 0.85, yBase: -0.2 },
      { depth: 0.6, color: "#b8cdd6", speed: 1.0, scale: 0.7, yBase: 0.8 },
      { depth: -0.8, color: "#a8c2cf", speed: 0.6, scale: 0.95, yBase: -0.6 },
      { depth: 0.0, color: "#dde6ea", speed: 1.1, scale: 0.6, yBase: 1.0 },
    ],
    []
  );
  const weeds = useMemo(
    () => [
      { x: -2.4, z: -0.5, h: 1.0, hue: "#1f7a4d" },
      { x: -1.6, z: 0.2, h: 0.7, hue: "#2a9362" },
      { x: 1.4, z: -0.3, h: 1.2, hue: "#1f7a4d" },
      { x: 2.3, z: 0.4, h: 0.85, hue: "#2a9362" },
      { x: 0.2, z: -0.6, h: 0.6, hue: "#1f7a4d" },
    ],
    []
  );
  return (
    <div ref={containerRef} className="h-full w-full">
      <Canvas
        camera={{ position: [0, 0.2, 5.5], fov: 50 }}
        dpr={[1, 1.25]}
        frameloop={isVisible ? "always" : "never"}
        resize={{ scroll: false }}
        style={{ width: "100%", height: "100%", display: "block" }}
        className="!touch-none"
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.55} />
          <directionalLight position={[2, 4, 3]} intensity={1.1} color="#aee6ff" />
          <pointLight position={[-3, 2, 2]} intensity={0.8} color="#3ec6e0" />
          <pointLight position={[3, -1, 1]} intensity={0.5} color="#9be8ff" />
          <SandFloor brightness={causticsBrightness} />
          {weeds.map((w, i) => (
            <Seaweed key={i} x={w.x} z={w.z} height={w.h} hue={w.hue} />
          ))}
          {fish.map((f, i) => (
            <Bangus key={i} {...f} />
          ))}
          <Bubbles />
          <WaterSurface intensity={rippleIntensity} />
          <fog attach="fog" args={["#0a4a6e", 5, 12]} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default AquariumScene;
