"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3-force";
import { motion } from "motion/react";
import useMeasure from "react-use-measure";
import { COLOR_HEX, confidenceToNodeFill, confidenceToNodeBorder } from "@/lib/colors";
import { RefreshCw } from "lucide-react";

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

interface SimNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  index?: number;
  level?: number;
  relevance?: number;
}

interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
}

const NODE_BASE_RADIUS = 36;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

export default function KnowledgeGraph({
  nodes,
  edges,
  activeConceptId,
  highlightedNodeIds,
  onNodeClick,
}: KnowledgeGraphProps) {
  const [containerRef, bounds] = useMeasure();
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simLinks, setSimLinks] = useState<SimLink[]>([]);
  const [tick, setTick] = useState(0);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffset = useRef({ x: 0, y: 0 });

  // Stable refs for callbacks
  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;

  // Initialize data and compute topological levels for left-to-right layout
  useEffect(() => {
    if (nodes.length === 0) return;

    const nodesCopy: SimNode[] = nodes.map((n) => ({
      ...n,
      relevance: (n.difficulty || 3) / 5,
    }));
    const linksCopy: SimLink[] = edges.map((e) => ({ source: e.source, target: e.target }));

    // Build adjacency and compute levels via relaxed edge propagation
    const levels: Record<string, number> = {};
    nodesCopy.forEach((n) => { levels[n.id] = 0; });

    for (let i = 0; i < nodesCopy.length; i++) {
      linksCopy.forEach((l) => {
        const s = typeof l.source === "object" ? l.source.id : l.source;
        const t = typeof l.target === "object" ? l.target.id : l.target;
        if (levels[s] !== undefined && levels[t] !== undefined) {
          if (levels[t] < levels[s] + 1) {
            levels[t] = levels[s] + 1;
          }
        }
      });
    }

    nodesCopy.forEach((n) => {
      n.level = levels[n.id];
    });

    setSimNodes(nodesCopy);
    setSimLinks(linksCopy);
  }, [nodes, edges]);

  // Run d3 force simulation
  useEffect(() => {
    if (!bounds.width || !bounds.height || simNodes.length === 0) return;

    const paddingX = 100;
    const availableWidth = bounds.width - paddingX * 2;
    const maxLevel = Math.max(...simNodes.map((n) => n.level || 0));

    const getTargetX = (node: SimNode) => {
      if (maxLevel === 0) return bounds.width / 2;
      return paddingX + ((node.level || 0) / maxLevel) * availableWidth;
    };

    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(180),
      )
      .force("charge", d3.forceManyBody().strength(-500))
      .force(
        "collide",
        d3.forceCollide<SimNode>().radius((d) => ((d.relevance || 0.6) * 20 + NODE_BASE_RADIUS) * 2),
      )
      .force(
        "x",
        d3.forceX<SimNode>().x((d) => getTargetX(d)).strength(0.8),
      )
      .force("y", d3.forceY(bounds.height / 2).strength(0.1));

    simulation.on("tick", () => {
      setTick((t) => t + 1);
    });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
    };
  }, [bounds.width, bounds.height, simNodes.length]);

  // Zoom handler (wheel)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * delta));
    });
  }, []);

  // Pan handlers (mouse drag on background)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-graph-node]")) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOffset.current = { x: pan.x, y: pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    setPan({
      x: panOffset.current.x + (e.clientX - panStart.current.x),
      y: panOffset.current.y + (e.clientY - panStart.current.y),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (simulationRef.current) {
      simulationRef.current.alpha(1).restart();
    }
  }, []);

  const handleNodeClick = useCallback((node: SimNode) => {
    if (onNodeClickRef.current) onNodeClickRef.current(node);
  }, []);

  // Determine which nodes/links are in the ancestor path
  const activeSet = useMemo(() => {
    const set = new Set<string>();
    if (highlightedNodeIds) {
      highlightedNodeIds.forEach((id) => set.add(id));
    }
    return set;
  }, [highlightedNodeIds]);

  const selectedNodeId = useMemo(() => {
    if (!highlightedNodeIds || highlightedNodeIds.size === 0) return null;
    return null;
  }, [highlightedNodeIds]);

  void tick;
  void selectedNodeId;

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-gradient-to-br from-[#fafafa] via-white to-gray-50/50 rounded-xl border border-gray-200/80 font-sans"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ touchAction: "none" }}
    >
      {/* Dot grid background */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Container for measurement */}
      <div ref={containerRef} className="w-full h-full">
        {/* Zoom/pan transform wrapper */}
        <div
          className="absolute inset-0 origin-center"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
        {/* SVG layer for links */}
        <svg className="absolute inset-0 pointer-events-none" width={bounds.width || "100%"} height={bounds.height || "100%"} style={{ overflow: "visible" }}>
          <defs>
            <marker id="arrowhead" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <polygon points="0 0, 12 5, 0 10" fill="#64748b" />
            </marker>
            <marker id="arrowhead-active" markerWidth="14" markerHeight="10" refX="12" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <polygon points="0 0, 14 5, 0 10" fill="#3b82f6" />
            </marker>
          </defs>

          <g>
            {simLinks.map((link, i) => {
              const source = link.source as SimNode;
              const target = link.target as SimNode;
              if (source.x == null || target.x == null || source.y == null || target.y == null) return null;

              const isSourceRel = activeSet.has(source.id);
              const isTargetRel = activeSet.has(target.id);
              const isPath = isSourceRel && isTargetRel;

              // Shorten line to stop at edge of nodes (so arrowhead is visible)
              const targetSize = (target.relevance || 0.6) * 20 + NODE_BASE_RADIUS;
              const sourceSize = (source.relevance || 0.6) * 20 + NODE_BASE_RADIUS;
              const totalDx = target.x - source.x;
              const totalDy = target.y - source.y;
              const dist = Math.sqrt(totalDx * totalDx + totalDy * totalDy);
              if (dist === 0) return null;

              const ux = totalDx / dist;
              const uy = totalDy / dist;

              // Only shorten if there's enough room between the two node edges
              const margin = 6; // space for arrowhead
              const totalInset = sourceSize + targetSize + margin;
              let sx: number, sy: number, tx: number, ty: number;
              if (dist > totalInset) {
                sx = source.x + ux * sourceSize;
                sy = source.y + uy * sourceSize;
                tx = target.x - ux * (targetSize + margin);
                ty = target.y - uy * (targetSize + margin);
              } else {
                // Nodes overlap or are very close — just draw a short line between centers
                sx = source.x;
                sy = source.y;
                tx = target.x;
                ty = target.y;
              }

              const cdx = tx - sx;
              const d = `M${sx},${sy} C${sx + cdx / 2},${sy} ${tx - cdx / 2},${ty} ${tx},${ty}`;

              return (
                <path
                  key={`link-${i}`}
                  d={d}
                  stroke={isPath ? "#3b82f6" : "#64748b"}
                  strokeWidth={isPath ? 2.5 : 1.5}
                  opacity={isPath ? 1 : 0.8}
                  fill="none"
                  markerEnd={isPath ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                />
              );
            })}
          </g>
        </svg>

        {/* DOM layer for nodes */}
        <div className="absolute inset-0 pointer-events-none" data-graph-nodes>
          {simNodes.map((node) => {
            if (node.x === undefined || node.y === undefined) return null;
            const size = (node.relevance || 0.6) * 20 + NODE_BASE_RADIUS;
            const borderColor = confidenceToNodeBorder(node.confidence ?? 0);
            const isInSet = activeSet.has(node.id);
            const hasSelection = activeSet.size > 0;
            const isDimmed = hasSelection && !isInSet;
            const isActive = node.id === activeConceptId;
            const glowColor = isActive ? COLOR_HEX.active : borderColor;

            // 4-bucket fill matching heatmap: orange / yellow / green / gray
            const baseFill = confidenceToNodeFill(node.confidence ?? 0);

            return (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: isDimmed ? 0.2 : 1,
                  scale: isInSet && !isDimmed ? 1.08 : 1,
                  x: node.x - size,
                  y: node.y - size,
                }}
                transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
                data-graph-node
                className="absolute rounded-full flex items-center justify-center cursor-pointer pointer-events-auto transition-all duration-500 ease-out"
                style={{
                  width: size * 2,
                  height: size * 2,
                  background: isInSet || isActive
                    ? `linear-gradient(135deg, ${glowColor}20, ${glowColor}10)`
                    : baseFill,
                  border: isInSet
                    ? `2.5px solid ${glowColor}`
                    : isActive
                      ? `2.5px solid ${COLOR_HEX.active}`
                      : `2px solid ${borderColor}`,
                  boxShadow: isInSet
                    ? `0 0 24px ${glowColor}40, 0 4px 12px ${glowColor}20`
                    : isActive
                      ? `0 0 20px ${COLOR_HEX.active}35, 0 4px 12px ${COLOR_HEX.active}15`
                      : `0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)`,
                }}
                onClick={() => handleNodeClick(node)}
              >
                {/* Glossy top highlight */}
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    top: "8%",
                    left: "15%",
                    width: "55%",
                    height: "35%",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 100%)",
                    borderRadius: "50%",
                  }}
                />

                {/* Text label */}
                <div className="absolute inset-0 flex items-center justify-center p-1.5 text-center pointer-events-none overflow-hidden">
                  <p
                    className={`font-semibold leading-[1.15] transition-colors ${
                      isInSet || isActive ? "text-gray-900" : "text-gray-700"
                    }`}
                    style={{
                      fontSize: node.label.length > 16 ? "9px" : node.label.length > 10 ? "10px" : "11px",
                      wordBreak: "break-word",
                      hyphens: "auto",
                    }}
                  >
                    {node.label}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
        </div>{/* close zoom/pan wrapper */}
      </div>

      {/* Reset button */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          onClick={handleReset}
          className="p-2 rounded-lg bg-white/70 hover:bg-gray-100 text-gray-400 border border-gray-200/80 backdrop-blur-md transition-colors"
          title="Reset View"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 p-4 rounded-xl bg-white/70 border border-gray-200/80 backdrop-blur-md">
        <div className="flex flex-col gap-3 text-xs text-gray-400 font-medium">
          <div className="flex items-center gap-3">
            <svg width="32" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="#64748b" strokeWidth="1.5" /><polygon points="26,0 32,3 26,6" fill="#64748b" /></svg>
            <span>Prerequisite</span>
          </div>
          <div className="h-px bg-gray-200 my-1" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#4ade80" }} />
              <span>Mastered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#a3e635" }} />
              <span>On Track</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#facc15" }} />
              <span>Building</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#fb923c" }} />
              <span>Developing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#94a3b8" }} />
              <span>Not Started</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
