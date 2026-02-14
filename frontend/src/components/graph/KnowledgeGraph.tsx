"use client";

import { useCallback, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { COLOR_HEX } from "@/lib/colors";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

export interface GraphNode {
  id: string;
  label: string;
  color: string;
  confidence: number;
  description?: string;
  category?: string;
  difficulty?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  activeConceptId?: string | null;
  highlightedNodeIds?: Set<string>;
  onNodeClick?: (node: GraphNode) => void;
  width?: number;
  height?: number;
}

export default function KnowledgeGraph({
  nodes,
  edges,
  activeConceptId,
  highlightedNodeIds,
  onNodeClick,
  width,
  height,
}: KnowledgeGraphProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const animationRef = useRef(0);
  const hoveredRef = useRef<string | null>(null);

  // Refs for reactive props so callbacks have stable references
  const activeConceptRef = useRef(activeConceptId);
  activeConceptRef.current = activeConceptId;

  const highlightedRef = useRef(highlightedNodeIds);
  highlightedRef.current = highlightedNodeIds;

  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;

  useEffect(() => {
    let frame: number;
    const tick = () => {
      animationRef.current = (animationRef.current + 1) % 120;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const graphData = useMemo(() => ({
    nodes: nodes.map((n) => ({ ...n })),
    links: edges.map((e) => ({ source: e.source, target: e.target })),
  }), [nodes, edges]);

  const nodeCanvasObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.label || "";
      const fontSize = 11 / globalScale;
      const baseRadius = 8 / globalScale;
      const hex = COLOR_HEX[node.color] || COLOR_HEX.gray;
      const isActive = node.id === activeConceptRef.current;
      const isHovered = node.id === hoveredRef.current;
      const isHighlighted = highlightedRef.current?.has(node.id) ?? false;

      // Outer glow (inspired by ParticleBackground radial gradient)
      if (isActive || isHovered || isHighlighted) {
        const pulse = isActive
          ? 0.5 + 0.5 * Math.sin((animationRef.current / 120) * Math.PI * 2)
          : isHighlighted ? 0.7 : 0.8;
        const glowColor = isActive ? COLOR_HEX.active : hex;
        const glowRadius = baseRadius * (2.5 + (isActive ? pulse * 0.8 : 0));

        const gradient = ctx.createRadialGradient(
          node.x, node.y, baseRadius * 0.5,
          node.x, node.y, glowRadius,
        );
        gradient.addColorStop(0, glowColor + "60");
        gradient.addColorStop(0.5, glowColor + "20");
        gradient.addColorStop(1, glowColor + "00");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowRadius, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Node circle with gradient fill
      const nodeGradient = ctx.createRadialGradient(
        node.x - baseRadius * 0.3, node.y - baseRadius * 0.3, 0,
        node.x, node.y, baseRadius,
      );
      const fillColor = isActive ? COLOR_HEX.active : hex;
      nodeGradient.addColorStop(0, fillColor + "ff");
      nodeGradient.addColorStop(1, fillColor + "cc");

      ctx.beginPath();
      ctx.arc(node.x, node.y, baseRadius, 0, 2 * Math.PI);
      ctx.fillStyle = nodeGradient;
      ctx.fill();

      // Subtle border
      ctx.strokeStyle = isActive ? COLOR_HEX.active : "#ffffff40";
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();

      // Inner highlight for depth
      ctx.beginPath();
      ctx.arc(node.x - baseRadius * 0.2, node.y - baseRadius * 0.2, baseRadius * 0.4, 0, 2 * Math.PI);
      ctx.fillStyle = "#ffffff20";
      ctx.fill();

      // Label with background for readability
      ctx.font = `${isHovered ? "bold " : ""}${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const textY = node.y + baseRadius + 3 / globalScale;
      const textWidth = ctx.measureText(label).width;
      const padding = 2 / globalScale;

      ctx.fillStyle = "#0f172a99";
      ctx.beginPath();
      ctx.roundRect(
        node.x - textWidth / 2 - padding,
        textY - padding,
        textWidth + padding * 2,
        fontSize + padding * 2,
        2 / globalScale,
      );
      ctx.fill();

      ctx.fillStyle = isHovered || isActive || isHighlighted ? "#ffffff" : "#cbd5e1";
      ctx.fillText(label, node.x, textY);
    },
    [],
  );

  // Custom link rendering with glow effect (inspired by LiveDataFlowDiagram)
  const linkCanvasObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const source = link.source;
      const target = link.target;
      if (!source || !target || source.x == null || target.x == null) return;

      const sourceHex = COLOR_HEX[source.color] || COLOR_HEX.gray;
      const targetHex = COLOR_HEX[target.color] || COLOR_HEX.gray;
      const isActiveEdge = source.id === activeConceptRef.current || target.id === activeConceptRef.current;
      const isHighlightedEdge = (highlightedRef.current?.has(source.id) && highlightedRef.current?.has(target.id)) ?? false;
      const isBright = isActiveEdge || isHighlightedEdge;

      // Edge line with gradient
      const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
      gradient.addColorStop(0, sourceHex + (isBright ? "80" : "40"));
      gradient.addColorStop(1, targetHex + (isBright ? "80" : "40"));

      ctx.strokeStyle = gradient;
      ctx.lineWidth = (isBright ? 2 : 1) / globalScale;

      // Glow for active/highlighted edges
      if (isActiveEdge) {
        ctx.shadowBlur = 6 / globalScale;
        ctx.shadowColor = COLOR_HEX.active + "60";
      } else if (isHighlightedEdge) {
        ctx.shadowBlur = 4 / globalScale;
        ctx.shadowColor = sourceHex + "40";
      }

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    },
    [],
  );

  const handleNodeClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => {
      if (onNodeClickRef.current) onNodeClickRef.current(node as GraphNode);
    },
    [],
  );

  // Fallback: when clicking the background, manually check if a node is nearby.
  // This catches cases where the shadow canvas hit-detection misses nodes.
  const handleBackgroundClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      const fg = fgRef.current;
      if (!fg) return;
      const coords = fg.screen2GraphCoords(event.offsetX, event.offsetY);
      const HIT_RADIUS = 14; // graph units, matches nodePointerAreaPaint
      let closest: { node: unknown; dist: number } | null = null;
      for (const node of graphData.nodes) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const n = node as any;
        if (n.x == null || n.y == null) continue;
        const dx = coords.x - n.x;
        const dy = coords.y - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < HIT_RADIUS && (!closest || dist < closest.dist)) {
          closest = { node: n, dist };
        }
      }
      if (closest && onNodeClickRef.current) {
        onNodeClickRef.current(closest.node as GraphNode);
      }
    },
    [graphData],
  );

  const handleNodeHover = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => {
      hoveredRef.current = node ? node.id : null;
    },
    [],
  );

  // Stable callback for pointer area (hit detection)
  const nodePointerAreaPaint = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const r = 14 / globalScale;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    [],
  );

  // No-op so links paint nothing on the shadow canvas (hit detection).
  // Without this, default link hit areas occlude node hit areas, making
  // nodes that sit on link paths unclickable.
  const linkPointerAreaPaint = useCallback(() => {}, []);

  // Stable callback for particle color
  const particleColor = useCallback(() => COLOR_HEX.active + "aa", []);

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={graphData}
      width={width}
      height={height}
      nodeCanvasObject={nodeCanvasObject}
      nodePointerAreaPaint={nodePointerAreaPaint}
      linkCanvasObject={linkCanvasObject}
      linkPointerAreaPaint={linkPointerAreaPaint}
      onNodeClick={handleNodeClick}
      onBackgroundClick={handleBackgroundClick}
      onNodeHover={handleNodeHover}
      linkDirectionalParticles={2}
      linkDirectionalParticleWidth={3}
      linkDirectionalParticleSpeed={0.004}
      linkDirectionalParticleColor={particleColor}
      backgroundColor="#0f172a"
      cooldownTicks={100}
    />
  );
}
