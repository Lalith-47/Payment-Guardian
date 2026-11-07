"use client";

import * as THREE from "three";
import { useMemo, useRef, useEffect, useState } from "react";

interface ProceduralObjectsProps {
  count?: number;
  spread?: number;
  seed?: number;
}

export function ProceduralObjects({ count = 60, spread = 40, seed = 23946651 }: ProceduralObjectsProps) {
  const geometries = useMemo(() => {
    const geoms: THREE.BufferGeometry[] = [];
    const rng = mulberry32(seed);

    for (let i = 0; i < count; i++) {
      const type = rng() * 3;
      let geom: THREE.BufferGeometry;

      if (type < 1) {
        geom = createCoinGeometry(rng);
      } else if (type < 2) {
        geom = createShieldGeometry(rng);
      } else {
        geom = createInvoiceSheetGeometry(rng);
      }

      geoms.push(geom);
    }

    return geoms;
  }, [count, seed]);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const rng = mulberry32(seed + 1);
    for (let i = 0; i < count; i++) {
      const radius = spread * (0.3 + rng() * 0.7);
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);
    }
    return pos;
  }, [count, spread, seed]);

  const rotations = useMemo(() => {
    const rot = new Float32Array(count * 3);
    const rng = mulberry32(seed + 2);
    for (let i = 0; i < count; i++) {
      rot[i * 3] = rng() * Math.PI * 2;
      rot[i * 3 + 1] = rng() * Math.PI * 2;
      rot[i * 3 + 2] = rng() * Math.PI * 2;
    }
    return rot;
  }, [count, seed]);

  const scales = useMemo(() => {
    const scl = new Float32Array(count);
    const rng = mulberry32(seed + 3);
    for (let i = 0; i < count; i++) {
      scl[i] = 0.15 + rng() * 0.35;
    }
    return scl;
  }, [count, seed]);

  const colors = useMemo(() => {
    const col = new Float32Array(count * 3);
    const rng = mulberry32(seed + 4);
    const palette = [
      new THREE.Color(0xf5a623),
      new THREE.Color(0xe87d2e),
      new THREE.Color(0xffffff),
      new THREE.Color(0x1a1a2e),
      new THREE.Color(0x2d2d44),
    ];
    for (let i = 0; i < count; i++) {
      const c = palette[Math.floor(rng() * palette.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return col;
  }, [count, seed]);

  return (
    <group>
      {geometries.map((geom, i) => (
        <ProceduralMesh
          key={i}
          geometry={geom}
          position={[
            positions[i * 3],
            positions[i * 3 + 1],
            positions[i * 3 + 2],
          ]}
          rotation={[
            rotations[i * 3],
            rotations[i * 3 + 1],
            rotations[i * 3 + 2],
          ]}
          scale={scales[i]}
          color={new THREE.Color(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2])}
          index={i}
          seed={seed}
        />
      ))}
    </group>
  );
}

function ProceduralMesh({
  geometry,
  position,
  rotation,
  scale,
  color,
  index,
  seed,
}: {
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  color: THREE.Color;
  index: number;
  seed: number;
}) {
  const materialRef = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        metalness: 0.15,
        flatShading: true,
      }),
    [color]
  );

  const rng = mulberry32(seed + index * 7 + 100);
  const floatSpeed = 0.15 + rng() * 0.25;
  const floatOffset = rng() * Math.PI * 2;
  const rotationSpeed = (rng() - 0.5) * 0.3;

  const clockRef = useRef(new THREE.Clock());
  const [time, setTime] = useState(0);

  useEffect(() => {
    const animate = () => {
      setTime(clockRef.current.getElapsedTime());
      requestAnimationFrame(animate);
    };
    animate();
  }, []);

  const animatedPosition = useMemo(() => {
    const y = position[1] + Math.sin(time * floatSpeed + floatOffset) * 0.8;
    return [position[0], y, position[2]] as [number, number, number];
  }, [position, time, floatSpeed, floatOffset]);

  const animatedRotation = useMemo(() => {
    return [
      rotation[0] + time * rotationSpeed * 0.5,
      rotation[1] + time * rotationSpeed,
      rotation[2] + time * rotationSpeed * 0.3,
    ] as [number, number, number];
  }, [rotation, time, rotationSpeed]);

  return (
    <mesh
      position={animatedPosition}
      rotation={animatedRotation}
      scale={scale}
      geometry={geometry}
      material={materialRef}
      castShadow
      receiveShadow
    />
  );
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createCoinGeometry(rng: () => number): THREE.BufferGeometry {
  const radius = 0.8 + rng() * 0.4;
  const thickness = 0.1 + rng() * 0.08;
  const segments = 8 + Math.floor(rng() * 8);
  return new THREE.CylinderGeometry(radius, radius, thickness, segments, 1, false);
}

function createShieldGeometry(rng: () => number): THREE.BufferGeometry {
  const width = 0.6 + rng() * 0.4;
  const height = width * 1.3;
  const shape = new THREE.Shape();
  shape.moveTo(0, height / 2);
  shape.bezierCurveTo(width / 2, height / 2, width / 2, -height / 3, 0, -height / 2);
  shape.bezierCurveTo(-width / 2, -height / 3, -width / 2, height / 2, 0, height / 2);
  const extrudeSettings = {
    depth: 0.08 + rng() * 0.06,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  };
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

function createInvoiceSheetGeometry(rng: () => number): THREE.BufferGeometry {
  const width = 0.5 + rng() * 0.3;
  const height = width * 1.4;
  const thickness = 0.02;
  const geom = new THREE.BoxGeometry(width, height, thickness, 2, 2, 1);
  const positions = geom.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    if (Math.abs(y) > height * 0.4 && Math.abs(x) < width * 0.3) {
      positions.setZ(i, positions.getZ(i) + (rng() - 0.5) * 0.01);
    }
  }
  geom.computeVertexNormals();
  return geom;
}