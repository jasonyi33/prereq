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
  onNodeClick?: (node: GraphNode) => void;
  width?: number;
  height?: number;
}

export default function KnowledgeGraph({
  nodes,
  edges,
  activeConceptId,
  onNodeClick,
  width,
  height,
}: KnowledgeGraphProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const animationRef = useRef(0);

  useEffect(() => {
    let frame: number;
    const tick = () => {
      animationRef.current = (animationRef.current + 1) % 60;
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
      const fontSize = 12 / globalScale;
      const nodeRadius = 6 / globalScale;
      const hex = COLOR_HEX[node.color] || COLOR_HEX.gray;
      const isActive = node.id === activeConceptId;

      // Active glow
      if (isActive) {
        const pulse = 0.5 + 0.5 * Math.sin((animationRef.current / 60) * Math.PI * 2);
        const glowRadius = nodeRadius * (1.8 + pulse * 0.6);
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowRadius, 0, 2 * Math.PI);
        ctx.fillStyle = `${COLOR_HEX.active}${Math.round(40 + pulse * 30).toString(16).padStart(2, "0")}`;
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = isActive ? COLOR_HEX.active : hex;
      ctx.fill();
      ctx.strokeStyle = isActive ? COLOR_HEX.active : "#ffffff";
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();

      // Label
      ctx.font = `${fontSize}px Sans-Serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(label, node.x, node.y + nodeRadius + 2 / globalScale);
    },
    [activeConceptId],
  );

  const handleNodeClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => {
      if (onNodeClick) {
        onNodeClick(node as GraphNode);
      }
    },
    [onNodeClick],
  );

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={graphData}
      width={width}
      height={height}
      nodeCanvasObject={nodeCanvasObject}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const r = 6 / globalScale;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      }}
      onNodeClick={handleNodeClick}
      linkColor={() => "#334155"}
      linkWidth={1}
      backgroundColor="#0f172a"
      cooldownTicks={100}
    />
  );
}
