"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { Suspense, useMemo, useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { ProceduralObjects } from "./ProceduralObjects";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface LandingCanvasProps {
  fallback?: React.ReactNode;
}

export function LandingCanvas({ fallback }: LandingCanvasProps) {
  const [webglError, setWebglError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl || prefersReducedMotion) {
      setWebglError(true);
    }
  }, []);

  if (!mounted) {
    return <div className="fixed inset-0 -z-10" aria-hidden="true" />;
  }

  if (webglError) {
    return fallback || <CanvasFallback />;
  }

  return (
    <Canvas
      className="fixed inset-0 -z-10"
      camera={{ position: [0, 0, 35], fov: 45 }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
      onCreated={({ gl }) => {
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      }}
      aria-hidden="true"
    >
      <color attach="background" args={[0x0d0d12]} />
      <fog attach="fog" args={[0x0d0d12, 15, 80]} />
      <Suspense fallback={<LoadingFallback />}>
        <SceneContent />
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableRotate={true}
        autoRotate={true}
        autoRotateSpeed={0.15}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minPolarAngle={0.1}
      />
    </Canvas>
  );
}

function SceneContent() {
  const { camera, scene, gl } = useThree();
  const scrollProgressRef = useRef(0);
  const cameraTargetRef = useRef(new THREE.Vector3(0, 0, 0));

  // Sections for scroll-triggered camera movement
  const sections = useMemo(() => [
    { name: "hero", y: 0, cameraZ: 35, targetY: 0 },
    { name: "problem", y: 1, cameraZ: 30, targetY: -2 },
    { name: "solution", y: 2, cameraZ: 25, targetY: -4 },
    { name: "guardrails", y: 3, cameraZ: 20, targetY: -6 },
    { name: "cta", y: 4, cameraZ: 35, targetY: 0 },
  ], []);

  // ScrollTrigger setup
  useEffect(() => {
    const triggers = sections.map((section, i) => {
      return ScrollTrigger.create({
        trigger: `#section-${section.name}`,
        start: "top center",
        end: "bottom center",
        onUpdate: (self) => {
          scrollProgressRef.current = i + self.progress;
          animateCamera(section, self.progress);
        },
        onEnter: () => animateCamera(section, 0),
        onLeaveBack: () => {
          const prev = sections[i - 1];
          if (prev) animateCamera(prev, 1);
        },
      });
    });

    return () => triggers.forEach((t) => t.kill());
  }, [sections]);

  const animateCamera = (section: typeof sections[0], progress: number) => {
    const nextSection = sections[Math.min(sections.indexOf(section) + 1, sections.length - 1)];
    const targetZ = gsap.utils.interpolate(section.cameraZ, nextSection.cameraZ, progress);
    const targetY = gsap.utils.interpolate(section.targetY, nextSection.targetY, progress);

    gsap.to(camera.position, {
      z: targetZ,
      duration: 0.8,
      ease: "power2.out",
      overwrite: true,
    });

    gsap.to(cameraTargetRef.current, {
      y: targetY,
      duration: 0.8,
      ease: "power2.out",
      overwrite: true,
      onUpdate: () => {
        camera.lookAt(cameraTargetRef.current);
      },
    });
  };

  // Mouse parallax
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetMouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      targetMouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      targetMouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useFrame(() => {
    mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.03;
    mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.03;

    camera.position.x += (mouseRef.current.x * 1.5 - camera.position.x) * 0.02;
    camera.position.y += (-mouseRef.current.y * 1.5 - camera.position.y) * 0.02;
    camera.lookAt(cameraTargetRef.current);
  });

  return (
    <>
      <Lights />
      <ProceduralObjects count={80} spread={50} seed={23946651} />
      <ContactShadows opacity={0.15} scale={80} blur={2} far={50} />
      <Environment
        background={false}
        preset="studio"
        resolution={256}
      />
    </>
  );
}

function Lights() {
  return (
    <>
      <ambientLight color={0xffffff} intensity={0.4} />
      <directionalLight
        position={[10, 15, 10]}
        color={0xfff5e6}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.0005}
      />
      <directionalLight
        position={[-8, 10, -8]}
        color={0xe8d5c4}
        intensity={0.5}
      />
      <pointLight position={[0, 5, 5]} color={0xf5a623} intensity={0.8} decay={2} distance={30} />
      <pointLight position={[0, -5, -5]} color={0x2d2d44} intensity={0.3} decay={2} distance={30} />
    </>
  );
}

function LoadingFallback() {
  return null;
}

function CanvasFallback() {
  return (
    <div
      className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--color-board)_0%,_var(--color-deep)_100%)]"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--color-accent)_0%,_transparent_50%)] opacity-10" />
    </div>
  );
}