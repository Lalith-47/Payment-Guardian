"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { Suspense, useMemo, useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { ProceduralObjects } from "./ProceduralObjects";
import gsap from "gsap";

interface LoginCanvasProps {
  fallback?: React.ReactNode;
}

export function LoginCanvas({ fallback }: LoginCanvasProps) {
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
    return <div className="fixed inset-0 -z-10 pointer-events-none" aria-hidden="true" />;
  }

  if (webglError) {
    return fallback || <CanvasFallback />;
  }

  return (
    <Canvas
      className="fixed inset-0 -z-10 pointer-events-none"
      camera={{ position: [0, 0, 28], fov: 40 }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
      onCreated={({ gl }) => {
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      }}
      aria-hidden="true"
    >
      <color attach="background" args={[0x0d0d12]} />
      <fog attach="fog" args={[0x0d0d12, 10, 60]} />
      <Suspense fallback={<LoadingFallback />}>
        <LoginSceneContent />
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableRotate={false}
        autoRotate={true}
        autoRotateSpeed={0.1}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minPolarAngle={0.15}
      />
    </Canvas>
  );
}

function LoginSceneContent() {
  const { camera } = useThree();
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
    mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.04;
    mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.04;
    camera.position.x += (mouseRef.current.x * 1.2 - camera.position.x) * 0.02;
    camera.position.y += (-mouseRef.current.y * 1.2 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <LoginLights />
      <ProceduralObjects count={40} spread={35} seed={23946651} />
      <ContactShadows opacity={0.1} scale={60} blur={2} far={40} />
      <Environment background={false} preset="studio" resolution={256} />
    </>
  );
}

function LoginLights() {
  return (
    <>
      <ambientLight color={0xffffff} intensity={0.35} />
      <directionalLight
        position={[8, 12, 8]}
        color={0xfff5e6}
        intensity={1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-6, 8, -6]} color={0xe8d5c4} intensity={0.4} />
      <pointLight position={[0, 4, 4]} color={0xf5a623} intensity={0.6} decay={2} distance={25} />
    </>
  );
}

function LoadingFallback() {
  return null;
}

function CanvasFallback() {
  return (
    <div
      className="fixed inset-0 -z-10 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--color-board)_0%,_var(--color-deep)_100%)]"
      aria-hidden="true"
    >
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--color-accent)_0%,_transparent_50%)] opacity-10" />
    </div>
  );
}