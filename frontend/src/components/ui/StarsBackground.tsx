"use client";

import { useEffect, useRef } from "react";

interface GlassNode {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  speed: number;
  offset: number;
  color: "blue" | "green" | "indigo" | "teal" | "purple";
}

export default function StarsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GlassNode[]>([]);
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

    const colors: GlassNode["color"][] = ["blue", "green", "indigo", "teal", "purple"];

    nodesRef.current = Array.from({ length: 24 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 40 + 12,
      opacity: Math.random() * 0.18 + 0.06,
      speed: Math.random() * 0.12 + 0.03,
      offset: Math.random() * Math.PI * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    const colorMap = {
      blue: { r: 59, g: 130, b: 246 },
      green: { r: 34, g: 197, b: 94 },
      indigo: { r: 129, g: 140, b: 248 },
      teal: { r: 45, g: 212, b: 191 },
      purple: { r: 168, g: 85, b: 247 },
    };

    let time = 0;
    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      time += 1;

      const dpr = window.devicePixelRatio || 1;

      nodesRef.current.forEach((node) => {
        const sway = Math.sin(time * 0.005 + node.offset) * 0.35;
        const breathe = Math.sin(time * 0.012 + node.offset) * 0.04;
        const pulse = Math.sin(time * 0.008 + node.offset * 2) * 0.2;
        const currentOpacity = node.opacity + breathe;
        const currentRadius = node.radius * (1 + pulse * 0.08);

        node.y -= node.speed;
        node.x += sway * 0.15;

        if (node.y < -node.radius * 3) {
          node.y = rect.height + node.radius * 3;
          node.x = Math.random() * rect.width * dpr;
        }

        const { r, g, b } = colorMap[node.color];
        const px = node.x / dpr;
        const py = node.y / dpr;

        // Large soft outer glow
        const glowGradient = ctx.createRadialGradient(px, py, currentRadius * 0.3, px, py, currentRadius * 3);
        glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${Math.max(0, currentOpacity * 0.5)})`);
        glowGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${Math.max(0, currentOpacity * 0.15)})`);
        glowGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(px, py, currentRadius * 3, 0, Math.PI * 2);
        ctx.fill();

        // Glass body — translucent fill with depth
        const fillGradient = ctx.createRadialGradient(
          px - currentRadius * 0.25, py - currentRadius * 0.25, 0,
          px, py, currentRadius,
        );
        fillGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${Math.max(0, currentOpacity * 0.9)})`);
        fillGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${Math.max(0, currentOpacity * 0.35)})`);
        fillGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${Math.max(0, currentOpacity * 0.08)})`);
        ctx.fillStyle = fillGradient;
        ctx.beginPath();
        ctx.arc(px, py, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        // Subtle glass rim
        ctx.beginPath();
        ctx.arc(px, py, currentRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${Math.max(0, currentOpacity * 1.5)})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner specular highlight — top-left
        const hlGradient = ctx.createRadialGradient(
          px - currentRadius * 0.3, py - currentRadius * 0.35, 0,
          px - currentRadius * 0.3, py - currentRadius * 0.35, currentRadius * 0.45,
        );
        hlGradient.addColorStop(0, `rgba(255, 255, 255, ${Math.max(0, currentOpacity * 1.0)})`);
        hlGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = hlGradient;
        ctx.beginPath();
        ctx.arc(px - currentRadius * 0.3, py - currentRadius * 0.35, currentRadius * 0.45, 0, Math.PI * 2);
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
      {/* Dark base */}
      <div className="fixed inset-0 z-0 bg-[#0a0e1a]" />
      {/* Subtle radial accent blurs */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 20% 20%, rgba(59, 130, 246, 0.08) 0%, transparent 50%), " +
            "radial-gradient(ellipse at 80% 80%, rgba(168, 85, 247, 0.06) 0%, transparent 50%), " +
            "radial-gradient(ellipse at 50% 60%, rgba(34, 197, 94, 0.04) 0%, transparent 40%)",
        }}
      />
      {/* Glass nodes canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      />
    </>
  );
}
