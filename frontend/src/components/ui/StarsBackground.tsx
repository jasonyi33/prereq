"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  offset: number;
  color: "blue" | "green" | "indigo";
}

export default function StarsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);

    const colors: Particle["color"][] = ["blue", "green", "indigo"];

    // Floating particles — soft bubbles drifting upward
    particlesRef.current = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 3 + 1.5,
      opacity: Math.random() * 0.15 + 0.05,
      speed: Math.random() * 0.3 + 0.1,
      offset: Math.random() * Math.PI * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    const colorMap = {
      blue: { r: 59, g: 130, b: 246 },
      green: { r: 34, g: 197, b: 94 },
      indigo: { r: 99, g: 102, b: 241 },
    };

    let time = 0;
    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      time += 1;

      const dpr = window.devicePixelRatio || 1;

      particlesRef.current.forEach((p) => {
        const sway = Math.sin(time * 0.01 + p.offset) * 0.5;
        const breathe = Math.sin(time * 0.02 + p.offset) * 0.04;
        const currentOpacity = p.opacity + breathe;

        // Drift upward, sway sideways
        p.y -= p.speed;
        p.x += sway * 0.3;

        // Wrap around
        if (p.y < -10) {
          p.y = rect.height * dpr + 10;
          p.x = Math.random() * rect.width * dpr;
        }

        const { r, g, b } = colorMap[p.color];
        const px = p.x / dpr;
        const py = p.y / dpr;

        // Soft glow
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, p.size * 3);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${Math.max(0, currentOpacity)})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, p.size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.max(0, currentOpacity * 1.5)})`;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", updateCanvasSize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <>
      {/* Light gradient background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background: "linear-gradient(135deg, #f0f9ff 0%, #ffffff 40%, #f0fdf4 70%, #eef2ff 100%)",
        }}
      />
      {/* Subtle radial accent */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at top right, rgba(59, 130, 246, 0.06) 0%, transparent 50%), radial-gradient(ellipse at bottom left, rgba(34, 197, 94, 0.05) 0%, transparent 50%)",
        }}
      />
      {/* Particles canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      />
    </>
  );
}
