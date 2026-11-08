"use client";

import React, { useEffect, useRef } from "react";

export interface VantageLayers {
  stream: boolean;
  disputes: boolean;
  guardrails: boolean;
  recoveries: boolean;
}

interface VantageCanvasProps {
  layers?: VantageLayers;
  className?: string;
}

export function VantageCanvas({
  layers = { stream: true, disputes: true, guardrails: true, recoveries: true },
  className = "",
}: VantageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef(layers);
  layersRef.current = layers;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    const gl = canvas.getContext("webgl", {
      antialias: false,
      premultipliedAlpha: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    if (!gl) return;

    // OKLCH token reading fallback in linear sRGB
    const COL = {
      lo: [0.12, 0.22, 0.42], // point-lo: dark teal/blue
      mid: [0.38, 0.52, 0.72], // point-mid: steel blue
      hi: [0.86, 0.92, 0.98], // point-hi: pale steel white
      acc: [0.72, 0.98, 0.22], // chromatic-lime: #b8fa38
    };

    // 1. Generate Transaction Topology Point Cloud (14,000+ points)
    const pos: number[] = [];
    const cls: number[] = []; // 0=stream, 1=disputes, 2=guardrails, 3=recoveries
    const rndVals: number[] = [];
    const shVals: number[] = [];

    let seed = 20261108;
    const rnd = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const W = 110;
    const D = 80;
    const BASE_Y = 32;

    // Layer 0: Base Transaction Stream (Lattice plane across time/amount)
    for (let z = -D; z <= D; z += 1.4) {
      const timeWave = Math.sin(z * 0.04) * 2.2;
      for (let x = -W; x <= W; x += 1.1) {
        const jitterX = (rnd() - 0.5) * 0.4;
        const jitterZ = (rnd() - 0.5) * 0.4;
        const waveY = Math.sin(x * 0.05 + z * 0.03) * 3.5;
        const y = BASE_Y + waveY + timeWave + (rnd() - 0.5) * 0.6;
        pos.push(x + jitterX, y, z + jitterZ);
        cls.push(0);
        rndVals.push(rnd());
        shVals.push(0.8 + 0.2 * Math.cos(x * 0.1));
      }
    }

    // Layer 1: Dispute & Decline Ridges (Elevated clusters where risk triggers rise)
    const disputeCenters = [
      { x: -35, z: -15, r: 24, h: 18 },
      { x: 30, z: 20, r: 20, h: 15 },
      { x: 55, z: -25, r: 16, h: 12 },
    ];

    disputeCenters.forEach((center) => {
      for (let i = 0; i < 900; i++) {
        const angle = rnd() * Math.PI * 2;
        const dist = Math.sqrt(rnd()) * center.r;
        const px = center.x + Math.cos(angle) * dist;
        const pz = center.z + Math.sin(angle) * dist;
        const falloff = 1 - dist / center.r;
        const py = BASE_Y + center.h * Math.pow(falloff, 1.4) + (rnd() - 0.5) * 1.5;
        pos.push(px, py, pz);
        cls.push(1);
        rndVals.push(rnd());
        shVals.push(0.95);
      }
    });

    // Layer 2: Guardrail Threshold Boundary (Architectural safety shell at y = 46)
    const CEILING_Y = 48;
    for (let x = -70; x <= 70; x += 3.5) {
      for (let z = -50; z <= 50; z += 3.5) {
        if (Math.abs(x) > 60 || Math.abs(z) > 42 || (x % 7 === 0 && z % 7 === 0)) {
          pos.push(x + (rnd() - 0.5) * 0.3, CEILING_Y + (rnd() - 0.5) * 0.4, z + (rnd() - 0.5) * 0.3);
          cls.push(2);
          rndVals.push(rnd());
          shVals.push(0.7);
        }
      }
    }

    // Layer 3: Autonomous Recovery Nodes (Signals identified, policy-approved, resolved via PayPal)
    const recoveryNodes = [
      { x: -32, y: BASE_Y + 16, z: -14 },
      { x: -30, y: BASE_Y + 14, z: -12 },
      { x: 28, y: BASE_Y + 14, z: 22 },
      { x: 52, y: BASE_Y + 11, z: -23 },
      { x: 0, y: BASE_Y + 6, z: 0 },
      { x: -15, y: BASE_Y + 8, z: 25 },
      { x: 18, y: BASE_Y + 7, z: -35 },
    ];

    recoveryNodes.forEach((node) => {
      // Cluster of 80 dense lime points around each recovered transaction
      for (let i = 0; i < 80; i++) {
        const rad = 2.4 * Math.cbrt(rnd());
        const theta = rnd() * Math.PI * 2;
        const phi = Math.acos(2 * rnd() - 1);
        const px = node.x + rad * Math.sin(phi) * Math.cos(theta);
        const py = node.y + rad * Math.sin(phi) * Math.sin(theta);
        const pz = node.z + rad * Math.cos(phi);
        pos.push(px, py, pz);
        cls.push(3);
        rndVals.push(rnd());
        shVals.push(1.0);
      }
    });

    const N = cls.length;
    const POS = new Float32Array(pos);
    const CLS = new Float32Array(cls);
    const RND = new Float32Array(rndVals);
    const SHD = new Float32Array(shVals);

    // 2. WebGL Shaders (Point Cloud Rendering & Laser Sweep)
    const VS = `
      attribute vec3 p;
      attribute float c;
      attribute float r;
      attribute float sh;

      uniform mat4 m;
      uniform vec2 off;
      uniform float dpr, size, sweep, alpha;
      uniform vec4 show; // x=stream, y=disputes, z=guardrails, w=recoveries
      uniform vec3 lo, mid, hi, acc;
      uniform vec2 hr, ext;

      varying vec4 col;

      void main() {
        float activeLayer = c < 0.5 ? show.x : c < 1.5 ? show.y : c < 2.5 ? show.z : show.w;
        vec4 q = m * vec4(p, 1.0);
        q.xy += off * q.w;
        gl_Position = q;

        // Height ramp
        float h = clamp((p.y - hr.x) / (hr.y - hr.x), 0.0, 1.0);
        vec3 colorBase = h < 0.5 ? mix(lo, mid, h * 2.0) : mix(mid, hi, (h - 0.5) * 2.0);
        colorBase *= (0.55 + 0.55 * sh);

        // Laser lidar sweep
        float distFromSweep = sweep - p.x;
        float sweepGlow = distFromSweep >= 0.0 
          ? 0.7 * exp(-distFromSweep / 2.5) + 0.3 * exp(-distFromSweep / 18.0) 
          : exp(distFromSweep / 0.8);
        colorBase = mix(colorBase, hi * 1.25, min(1.0, sweepGlow * 1.2));

        // Chromatic lime signal for recovered transactions
        if (c > 2.5) {
          colorBase = acc;
        }

        float depthFade = clamp(1.0 - (q.w - 80.0) / 360.0, 0.25, 1.0);
        float edgeVignette = smoothstep(1.0, 0.75, length(p.xz / ext));

        gl_PointSize = clamp(size * dpr * 240.0 / q.w * (0.8 + 0.4 * r) * (1.0 + 0.3 * sweepGlow), 1.2 * dpr, 3.8 * dpr);
        col = vec4(colorBase, activeLayer * depthFade * edgeVignette * alpha);

        if (activeLayer < 0.01) {
          gl_Position = vec4(3.0, 3.0, 3.0, 1.0);
        }
      }
    `;

    const FS = `
      precision mediump float;
      varying vec4 col;

      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float distSq = dot(d, d);
        if (distSq > 0.25) discard;
        float alphaCircle = col.a * smoothstep(0.25, 0.12, distSq);
        gl_FragColor = vec4(col.rgb * alphaCircle, alphaCircle);
      }
    `;

    const createShader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const program = gl.createProgram()!;
    gl.attachShader(program, createShader(gl.VERTEX_SHADER, VS));
    gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(program);
    gl.useProgram(program);

    const bindBuffer = (data: Float32Array, name: string, size: number) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };

    bindBuffer(POS, "p", 3);
    bindBuffer(CLS, "c", 1);
    bindBuffer(RND, "r", 1);
    bindBuffer(SHD, "sh", 1);

    const U: Record<string, WebGLUniformLocation | null> = {};
    ["m", "off", "dpr", "size", "sweep", "alpha", "show", "lo", "mid", "hi", "acc", "hr", "ext"].forEach((name) => {
      U[name] = gl.getUniformLocation(program, name);
    });

    gl.uniform3fv(U.lo, COL.lo);
    gl.uniform3fv(U.mid, COL.mid);
    gl.uniform3fv(U.hi, COL.hi);
    gl.uniform3fv(U.acc, COL.acc);
    gl.uniform2f(U.hr, 28, 54);
    gl.uniform2f(U.ext, W + 10, D + 10);
    gl.uniform1f(U.dpr, DPR);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);

    // Camera matrix helpers
    const persp = (fov: number, asp: number, n: number, f: number) => {
      const t = 1 / Math.tan(fov / 2);
      return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0];
    };

    const lookAt = (e: number[], c: number[]) => {
      let zx = e[0] - c[0],
        zy = e[1] - c[1],
        zz = e[2] - c[2];
      let l = Math.hypot(zx, zy, zz);
      zx /= l;
      zy /= l;
      zz /= l;
      let xx = zz,
        xy = 0,
        xz = -zx;
      l = Math.hypot(xx, xy, xz);
      xx /= l;
      xz /= l;
      const yx = zy * xz - zz * xy,
        yy = zz * xx - zx * xz,
        yz = zx * xy - zy * xx;
      return [
        xx,
        yx,
        zx,
        0,
        xy,
        yy,
        zy,
        0,
        xz,
        yz,
        zz,
        0,
        -(xx * e[0] + xy * e[1] + xz * e[2]),
        -(yx * e[0] + yy * e[1] + yz * e[2]),
        -(zx * e[0] + zy * e[1] + zz * e[2]),
        1,
      ];
    };

    const mul = (a: number[], b: number[]) => {
      const o = new Array(16);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          let s = 0;
          for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
          o[i * 4 + j] = s;
        }
      }
      return o;
    };

    // State tracking for smooth parallax interpolation
    let targetPx = 0;
    let targetPy = 0;
    let currentPx = 0;
    let currentPy = 0;
    let yaw = 0.55;
    let alpha = 0;
    let isVisible = true;
    let animId = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * DPR);
      canvas.height = Math.round(rect.height * DPR);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener("resize", resize);

    // Cursor Reactivity: tracks mouse pointer with parallax tilt
    const handlePointerMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      targetPx = ((e.clientX - cx) / cx);
      targetPy = ((e.clientY - cy) / cy);
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });

    // IntersectionObserver to pause rendering when scrolled off screen
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(canvas);

    let lastTime = performance.now();

    const render = (time: number) => {
      if (!isVisible) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Smooth camera interpolation toward cursor target
      const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.min(1, k * dt);
      currentPx = lerp(currentPx, targetPx, 3.5);
      currentPy = lerp(currentPy, targetPy, 3.5);

      if (!reduceMotion) {
        yaw += 0.03 * dt; // slow organic rotation
      }
      alpha = lerp(alpha, 1.0, 2.0);

      const w = canvas.clientWidth || 800;
      const h = canvas.clientHeight || 600;

      // Parallax camera calculation
      const camYaw = yaw + currentPx * 0.18;
      const camPitch = 0.44 + currentPy * 0.12;
      const dist = w < 768 ? 220 : 170;

      const target = [0, 36, 0];
      const eye = [
        target[0] + dist * Math.cos(camPitch) * Math.sin(camYaw),
        target[1] + dist * Math.sin(camPitch),
        target[2] + dist * Math.cos(camPitch) * Math.cos(camYaw),
      ];

      const proj = persp(0.72, w / h, 20, 900);
      const view = lookAt(eye, target);
      const mvp = mul(proj, view);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniformMatrix4fv(U.m, false, mvp);
      gl.uniform2fv(U.off, [0, 0]);
      gl.uniform1f(U.size, 1.15);
      gl.uniform1f(U.alpha, alpha);

      // Sweep calculation across 6.4 seconds
      const sweepPeriod = 6.4;
      const tNorm = ((time / 1000) % sweepPeriod) / sweepPeriod;
      const sweepPos = reduceMotion ? 0 : -W - 15 + tNorm * (2 * W + 30);
      gl.uniform1f(U.sweep, sweepPos);

      // Dynamic layer visibility from props
      const currentLayers = layersRef.current;
      gl.uniform4f(
        U.show,
        currentLayers.stream ? 1.0 : 0.0,
        currentLayers.disputes ? 1.0 : 0.0,
        currentLayers.guardrails ? 1.0 : 0.0,
        currentLayers.recoveries ? 1.0 : 0.0
      );

      gl.drawArrays(gl.POINTS, 0, N);

      if (!reduceMotion) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handlePointerMove);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      aria-hidden="true"
    />
  );
}

