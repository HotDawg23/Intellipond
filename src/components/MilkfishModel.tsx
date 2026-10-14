import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

function makeFinShape(points: [number, number][]) {
  const shape = new THREE.Shape();
  const [first, ...rest] = points;
  if (!first) return shape;
  shape.moveTo(...first);
  rest.forEach(([x, y]) => shape.lineTo(x, y));
  shape.closePath();
  return shape;
}

const bodyProfile = [
  new THREE.Vector2(0, -0.55),
  new THREE.Vector2(0.05, -0.48),
  new THREE.Vector2(0.115, -0.34),
  new THREE.Vector2(0.168, -0.12),
  new THREE.Vector2(0.185, 0.03),
  new THREE.Vector2(0.16, 0.21),
  new THREE.Vector2(0.105, 0.37),
  new THREE.Vector2(0.05, 0.49),
  new THREE.Vector2(0, 0.54),
];

const tailFinShape = makeFinShape([
  [0, 0.07],
  [-0.38, 0.32],
  [-0.27, 0.05],
  [-0.4, 0],
  [-0.27, -0.05],
  [-0.38, -0.32],
  [0, -0.07],
]);

const dorsalFinShape = makeFinShape([
  [-0.16, 0],
  [-0.09, 0.2],
  [-0.01, 0.11],
  [0.11, 0.17],
  [0.18, 0],
]);

const analFinShape = makeFinShape([
  [-0.14, 0],
  [-0.06, -0.16],
  [0.04, -0.08],
  [0.14, -0.12],
  [0.17, 0],
]);

const pectoralFinShape = makeFinShape([
  [0.03, 0.06],
  [-0.17, -0.23],
  [0.08, -0.16],
  [0.18, -0.02],
]);

const fishScaleShape = new THREE.Shape();
fishScaleShape.moveTo(-0.026, 0.01);
fishScaleShape.quadraticCurveTo(0, 0.024, 0.026, 0.01);
fishScaleShape.quadraticCurveTo(0.022, -0.012, 0, -0.026);
fishScaleShape.quadraticCurveTo(-0.022, -0.012, -0.026, 0.01);

function bodyRadiusAt(x: number) {
  for (let index = 0; index < bodyProfile.length - 1; index++) {
    const from = bodyProfile[index];
    const to = bodyProfile[index + 1];
    if (from && to && x >= from.y && x <= to.y) {
      const progress = (x - from.y) / (to.y - from.y);
      return THREE.MathUtils.lerp(from.x, to.x, progress);
    }
  }
  return 0;
}

function bodySurfaceZ(x: number, y: number, side: number) {
  const radius = bodyRadiusAt(x);
  return side * (Math.sqrt(Math.max(0, radius * radius - y * y)) + 0.002);
}

type MilkfishModelProps = {
  color: string;
  speed?: number;
};

export default function MilkfishModel({ color, speed = 1 }: MilkfishModelProps) {
  const tailRef = useRef<THREE.Group>(null!);
  const scalesRef = useRef<THREE.InstancedMesh>(null!);
  const tailPhase = useMemo(() => Math.random() * Math.PI * 2, []);
  const scaleLocations = useMemo(() => {
    const locations: THREE.Vector3[] = [];
    const rows = [-0.09, -0.03, 0.03, 0.09];
    for (let column = 0; column < 8; column++) {
      const x = -0.29 + column * 0.073;
      const rowOffset = column % 2 === 0 ? 0 : 0.025;
      for (const y of rows) {
        const scaleY = y + rowOffset;
        for (const side of [-1, 1]) {
          locations.push(new THREE.Vector3(x, scaleY, bodySurfaceZ(x, scaleY, side)));
        }
      }
    }
    return locations;
  }, []);
  const scaleTransform = useMemo(() => new THREE.Object3D(), []);
  const gillCurves = useMemo(
    () =>
      [-1, 1].map(
        (side) =>
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.16, 0.12, bodySurfaceZ(0.16, 0.12, side)),
            new THREE.Vector3(0.25, 0.06, bodySurfaceZ(0.25, 0.06, side)),
            new THREE.Vector3(0.28, -0.03, bodySurfaceZ(0.28, -0.03, side)),
            new THREE.Vector3(0.2, -0.12, bodySurfaceZ(0.2, -0.12, side)),
          ]),
      ),
    [],
  );

  useLayoutEffect(() => {
    if (!scalesRef.current) return;
    scaleLocations.forEach((location, index) => {
      scaleTransform.position.copy(location);
      scaleTransform.rotation.set(0, 0, 0);
      scaleTransform.scale.set(1, 1, 1);
      scaleTransform.updateMatrix();
      scalesRef.current.setMatrixAt(index, scaleTransform.matrix);
    });
    scalesRef.current.instanceMatrix.needsUpdate = true;
    scalesRef.current.computeBoundingSphere();
  }, [scaleLocations, scaleTransform]);

  useFrame((state) => {
    if (tailRef.current) {
      tailRef.current.rotation.y = Math.sin(state.clock.elapsedTime * speed * 8 + tailPhase) * 0.5;
    }
  });

  const finMaterial = <meshStandardMaterial color={color} metalness={0.3} roughness={0.42} side={THREE.DoubleSide} />;

  return (
    <group>
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <latheGeometry args={[bodyProfile, 32]} />
        <meshStandardMaterial color={color} metalness={0.42} roughness={0.3} />
      </mesh>

      <group ref={tailRef} position={[-0.49, 0, 0]}>
        <mesh>
          <shapeGeometry args={[tailFinShape]} />
          {finMaterial}
        </mesh>
      </group>

      <mesh position={[-0.1, 0.17, 0]}>
        <shapeGeometry args={[dorsalFinShape]} />
        {finMaterial}
      </mesh>
      <mesh position={[-0.12, -0.15, 0]}>
        <shapeGeometry args={[analFinShape]} />
        {finMaterial}
      </mesh>

      {[-1, 1].map((side) => (
        <mesh key={`pectoral-${side}`} position={[0.04, -0.03, side * 0.13]}>
          <shapeGeometry args={[pectoralFinShape]} />
          {finMaterial}
        </mesh>
      ))}

      {gillCurves.map((curve, index) => (
        <mesh key={`gill-${index}`}>
          <tubeGeometry args={[curve, 12, 0.008, 6, false]} />
          <meshStandardMaterial color="#637d87" roughness={0.55} />
        </mesh>
      ))}

      <instancedMesh ref={scalesRef} args={[undefined, undefined, scaleLocations.length]}>
        <shapeGeometry args={[fishScaleShape]} />
        <meshStandardMaterial color="#e0edf1" metalness={0.2} roughness={0.38} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
      </instancedMesh>

      {[-1, 1].map((side) => (
        <group key={`eye-${side}`} position={[0.39, 0.04, bodySurfaceZ(0.39, 0.04, side)]}>
          <mesh>
            <sphereGeometry args={[0.044, 16, 16]} />
            <meshStandardMaterial color="#f3f7f8" roughness={0.25} />
          </mesh>
          <mesh position={[0.01, 0, side * 0.032]}>
            <sphereGeometry args={[0.025, 16, 16]} />
            <meshStandardMaterial color="#0a1628" roughness={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
