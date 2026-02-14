"use client";

import { useEffect, useRef } from "react";

interface BubbleNode {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  speed: number;
  offset: number;
  color: "blue" | "green" | "indigo" | "teal";
}

export default function StarsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<BubbleNode[]>([]);
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

    const colors: BubbleNode["color"][] = ["blue", "green", "indigo", "teal"];

    // Create glass bubble nodes — fewer but much larger
    nodesRef.current = Array.from({ length: 18 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 30 + 15,
      opacity: Math.random() * 0.12 + 0.04,
      speed: Math.random() * 0.15 + 0.05,
      offset: Math.random() * Math.PI * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    const colorMap = {
      blue: { r: 59, g: 130, b: 246 },
      green: { r: 34, g: 197, b: 94 },
      indigo: { r: 99, g: 102, b: 241 },
      teal: { r: 20, g: 184, b: 166 },
    };

    let time = 0;
    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      time += 1;

      const dpr = window.devicePixelRatio || 1;

      nodesRef.current.forEach((node) => {
        const sway = Math.sin(time * 0.006 + node.offset) * 0.4;
        const breathe = Math.sin(time * 0.015 + node.offset) * 0.03;
        const pulse = Math.sin(time * 0.01 + node.offset * 2) * 0.15;
        const currentOpacity = node.opacity + breathe;
        const currentRadius = node.radius * (1 + pulse * 0.1);

        // Drift upward slowly, sway sideways
        node.y -= node.speed;
        node.x += sway * 0.2;

        // Wrap around
        if (node.y < -node.radius * 2) {
          node.y = rect.height + node.radius * 2;
          node.x = Math.random() * rect.width * dpr;
        }

        const { r, g, b } = colorMap[node.color];
        const px = node.x / dpr;
        const py = node.y / dpr;

        // Outer glow
        const glowGradient = ctx.createRadialGradient(px, py, currentRadius * 0.5, px, py, currentRadius * 2.5);
        glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${Math.max(0, currentOpacity * 0.6)})`);
        glowGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(px, py, currentRadius * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Glass bubble fill
        const fillGradient = ctx.createRadialGradient(
          px - currentRadius * 0.2, py - currentRadius * 0.2, 0,
          px, py, currentRadius,
        );
        fillGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${Math.max(0, currentOpacity * 1.2)})`);
        fillGradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${Math.max(0, currentOpacity * 0.5)})`);
        fillGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${Math.max(0, currentOpacity * 0.15)})`);
        ctx.fillStyle = fillGradient;
        ctx.beginPath();
        ctx.arc(px, py, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        // Ring
        ctx.beginPath();
        ctx.arc(px, py, currentRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${Math.max(0, currentOpacity * 1.8)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Inner glass highlight (top-left bright spot)
        const hlGradient = ctx.createRadialGradient(
          px - currentRadius * 0.3, py - currentRadius * 0.3, 0,
          px - currentRadius * 0.3, py - currentRadius * 0.3, currentRadius * 0.5,
        );
        hlGradient.addColorStop(0, `rgba(255, 255, 255, ${Math.max(0, currentOpacity * 0.8)})`);
        hlGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = hlGradient;
        ctx.beginPath();
        ctx.arc(px - currentRadius * 0.3, py - currentRadius * 0.3, currentRadius * 0.5, 0, Math.PI * 2);
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
      {/* Bubble nodes canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      />
    </>
  );
}
