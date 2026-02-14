"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3-force";
import { motion } from "motion/react";
import useMeasure from "react-use-measure";
import { COLOR_HEX } from "@/lib/colors";
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

const NODE_BASE_RADIUS = 30;

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
          .distance(120),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force(
        "collide",
        d3.forceCollide<SimNode>().radius((d) => ((d.relevance || 0.6) * 20 + NODE_BASE_RADIUS) * 1.5),
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

  const handleReset = useCallback(() => {
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

  // Find the selected node (the one that's both in activeSet and triggered the selection)
  const selectedNodeId = useMemo(() => {
    if (!highlightedNodeIds || highlightedNodeIds.size === 0) return null;
    // The selected node is the one where clicking triggered ancestor computation
    // It's included in highlightedNodeIds (parent adds node.id to the set)
    return null; // We don't have a direct selectedNodeId, we use activeSet for highlighting
  }, [highlightedNodeIds]);

  // Suppress unused var warning — tick is read to trigger re-render
  void tick;
  void selectedNodeId;

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-inner font-sans">
      {/* Dot grid background */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #94a3b8 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Container for measurement */}
      <div ref={containerRef} className="w-full h-full">
        {/* SVG layer for links */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" opacity="0.6" />
            </marker>
            <marker id="arrowhead-active" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#60a5fa" opacity="0.9" />
            </marker>
          </defs>

          <g>
            {simLinks.map((link, i) => {
              const source = link.source as SimNode;
              const target = link.target as SimNode;
              if (!source.x || !target.x || !source.y || !target.y) return null;

              const isSourceRel = activeSet.has(source.id);
              const isTargetRel = activeSet.has(target.id);
              const isPath = isSourceRel && isTargetRel;

              // Check if this is a "prerequisite" relationship (dashed)
              const isPrereq = true; // all edges are prerequisites in our data model

              const dx = target.x - source.x;
              const d = `M${source.x},${source.y} C${source.x + dx / 2},${source.y} ${target.x - dx / 2},${target.y} ${target.x},${target.y}`;

              return (
                <path
                  key={`link-${i}`}
                  d={d}
                  stroke={isPath ? "#60a5fa" : "#475569"}
                  strokeWidth={isPath ? 2 : 1.5}
                  strokeDasharray={isPrereq ? "5,5" : "none"}
                  opacity={isPath ? 0.8 : 0.2}
                  fill="none"
                  markerEnd={isPath ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                />
              );
            })}
          </g>
        </svg>

        {/* DOM layer for nodes */}
        <div className="absolute inset-0 pointer-events-none">
          {simNodes.map((node) => {
            if (node.x == null || node.y == null) return null;
            const size = (node.relevance || 0.6) * 20 + NODE_BASE_RADIUS;
            const color = COLOR_HEX[node.color] || COLOR_HEX.gray;
            const isInSet = activeSet.has(node.id);
            const hasSelection = activeSet.size > 0;
            const isDimmed = hasSelection && !isInSet;
            const isActive = node.id === activeConceptId;

            // Determine if this is the "clicked" node (the non-ancestor in the set that the others lead to)
            // For glow purposes, use blue for activeConceptId, else mastery color
            const glowColor = isActive ? COLOR_HEX.active : color;

            return (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: isDimmed ? 0.2 : 1,
                  scale: isInSet && !isDimmed ? 1.05 : 1,
                  x: node.x - size,
                  y: node.y - size,
                }}
                transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
                className="absolute rounded-full flex items-center justify-center cursor-pointer pointer-events-auto border transition-all duration-500 ease-out"
                style={{
                  width: size * 2,
                  height: size * 2,
                  background: `radial-gradient(130% 130% at 30% 30%, ${glowColor}15 0%, ${glowColor}05 40%, rgba(15, 23, 42, 0.8) 100%)`,
                  borderColor: isInSet
                    ? glowColor
                    : isActive
                      ? COLOR_HEX.active
                      : "rgba(255,255,255,0.1)",
                  boxShadow: isInSet
                    ? `0 0 30px ${glowColor}80, inset 0 0 20px ${glowColor}40, 0 0 60px ${glowColor}40`
                    : isActive
                      ? `0 0 20px ${COLOR_HEX.active}60, inset 0 0 15px ${COLOR_HEX.active}30`
                      : "0 4px 12px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.1)",
                }}
                onClick={() => handleNodeClick(node)}
              >
                {/* Glass reflections */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent opacity-50" />
                <div className="absolute top-[10%] left-[10%] w-[30%] h-[20%] bg-white/20 rounded-full blur-[3px]" />

                {/* Text label */}
                <div className="absolute inset-0 flex items-center justify-center p-2 text-center pointer-events-none">
                  <p
                    className={`text-[11px] font-medium leading-tight tracking-wide drop-shadow-lg transition-colors ${
                      isInSet || isActive ? "text-white font-semibold" : "text-slate-300"
                    }`}
                  >
                    {node.label}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Reset button */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          onClick={handleReset}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700 backdrop-blur-md transition-colors"
          title="Reset View"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 p-4 rounded-xl bg-slate-900/40 border border-slate-700/30 backdrop-blur-md shadow-lg">
        <div className="flex flex-col gap-3 text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-3">
            <div className="w-8 h-[2px] bg-slate-500 rounded-full" />
            <span>Flow / Uses</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-[2px] bg-slate-500 border-b-2 border-dashed border-slate-500" />
            <span>Prerequisite</span>
          </div>
          <div className="h-px bg-slate-700/50 my-1" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              <span>Mastered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
              <span>Partial</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              <span>Struggling</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              <span>Not Started</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
