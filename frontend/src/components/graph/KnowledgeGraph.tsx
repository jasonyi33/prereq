"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3-force";
import { motion } from "motion/react";
import useMeasure from "react-use-measure";
import { COLOR_HEX, confidenceToNodeFill, confidenceToNodeBorder } from "@/lib/colors";
import { RefreshCw, ZoomIn, ZoomOut } from "lucide-react";

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
const NODE_FONT_SIZE = 10;
const CHAR_WIDTH_RATIO = 0.68;
const NODE_PADDING = 14;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const REVEAL_DURATION_MS = 2000;
const REVEAL_INITIAL_DELAY = 300;
const REVEAL_FPS = 30;
const DRAG_THRESHOLD = 8; // px of movement before a pointer-down becomes a drag

/** Compute the node radius so the longest word fits without breaking */
function getNodeRadius(label: string, relevance: number): number {
  const charWidth = NODE_FONT_SIZE * CHAR_WIDTH_RATIO;
  const longestWord = label.split(/[\s/\-]+/).reduce((a, b) => (a.length > b.length ? a : b), "");
  const wordWidth = longestWord.length * charWidth;
  const minRadiusForWord = (wordWidth + NODE_PADDING) / 2;
  const baseRadius = relevance * 20 + NODE_BASE_RADIUS;
  return Math.max(baseRadius, minRadiusForWord);
}

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
  const [ready, setReady] = useState(false);
  const positionCacheRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const originalPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Zoom & pan state
  const [zoom, setZoom] = useState(0.75);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffset = useRef({ x: 0, y: 0 });

  // Left-to-right sweep: 0 = nothing visible, 1 = everything visible
  const [revealProgress, setRevealProgress] = useState(0);

  // Stable refs for callbacks
  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;

  // Drag state — refs so callbacks stay stable across renders
  const draggingNodeId = useRef<string | null>(null);
  const dragStartPointer = useRef({ x: 0, y: 0 });
  const dragStartNodePos = useRef({ x: 0, y: 0 });
  const hasDraggedPastThreshold = useRef(false);
  const simNodesRef = useRef(simNodes);
  simNodesRef.current = simNodes;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Initialize data and compute topological levels for left-to-right layout
  useEffect(() => {
    if (nodes.length === 0) return;

    const nodesCopy: SimNode[] = nodes.map((n) => {
      const cached = positionCacheRef.current.get(n.id);
      return {
        ...n,
        relevance: (n.difficulty || 3) / 5,
        ...(cached ? { x: cached.x, y: cached.y } : {}),
      };
    });
    const nodeIds = new Set(nodesCopy.map((n) => n.id));
    const linksCopy: SimLink[] = edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));

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

  // Animate revealProgress from 0 → 1 after layout is ready
  useEffect(() => {
    if (!ready) return;
    setRevealProgress(0);
    const stepMs = 1000 / REVEAL_FPS;
    const steps = Math.ceil(REVEAL_DURATION_MS / stepMs);
    let frame = 0;
    const cleanupRef = { current: () => {} };
    const delayTimer = setTimeout(() => {
      const interval = setInterval(() => {
        frame++;
        const t = Math.min(frame / steps, 1);
        setRevealProgress(t);
        if (t >= 1) clearInterval(interval);
      }, stepMs);
      cleanupRef.current = () => clearInterval(interval);
    }, REVEAL_INITIAL_DELAY);
    return () => { clearTimeout(delayTimer); cleanupRef.current(); };
  }, [ready]);

  // Run d3 force simulation synchronously to pre-stabilize layout
  useEffect(() => {
    if (!bounds.width || !bounds.height || simNodes.length === 0) return;

    // If positions are already cached (mastery update), skip re-simulation
    const allCached = simNodes.every((n) => n.x !== undefined && n.y !== undefined);
    if (allCached && ready) {
      return;
    }

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
        d3.forceCollide<SimNode>().radius((d) => getNodeRadius(d.label, d.relevance || 0.6) * 2),
      )
      .force(
        "x",
        d3.forceX<SimNode>().x((d) => getTargetX(d)).strength(0.8),
      )
      .force("y", d3.forceY(bounds.height / 2).strength(0.1));

    // Pre-stabilize synchronously — no async tick callbacks
    simulation.stop();
    for (let i = 0; i < 300; i++) {
      simulation.tick();
    }

    // Cache final positions and save originals (first run only)
    const isFirstLayout = originalPositionsRef.current.size === 0;
    for (const node of simNodes) {
      if (node.x !== undefined && node.y !== undefined) {
        positionCacheRef.current.set(node.id, { x: node.x, y: node.y });
        if (isFirstLayout) {
          originalPositionsRef.current.set(node.id, { x: node.x, y: node.y });
        }
      }
    }

    // Auto-fit: compute bounding box and set zoom/pan so entire graph is centered
    const xs = simNodes.filter((n) => n.x != null).map((n) => n.x!);
    const ys = simNodes.filter((n) => n.y != null).map((n) => n.y!);
    if (xs.length > 0 && ys.length > 0) {
      const maxR = Math.max(...simNodes.map((n) => getNodeRadius(n.label, n.relevance || 0.6)));
      const pad = maxR + 20;
      const minX = Math.min(...xs) - pad;
      const maxX = Math.max(...xs) + pad;
      const minY = Math.min(...ys) - pad;
      const maxY = Math.max(...ys) + pad;
      const graphW = maxX - minX;
      const graphH = maxY - minY;
      const scaleX = bounds.width / graphW;
      const scaleY = bounds.height / graphH;
      const fitZoom = Math.min(scaleX, scaleY, 1);
      const graphCenterX = (minX + maxX) / 2;
      const graphCenterY = (minY + maxY) / 2;
      const containerCenterX = bounds.width / 2;
      const containerCenterY = bounds.height / 2;
      setZoom(fitZoom);
      setPan({
        x: containerCenterX - graphCenterX * fitZoom - containerCenterX * (1 - fitZoom),
        y: containerCenterY - graphCenterY * fitZoom - containerCenterY * (1 - fitZoom),
      });
    }

    // Single render with settled layout
    setSimNodes([...simNodes]);
    setReady(true);

    return () => {
      simulation.stop();
    };
  }, [bounds.width, bounds.height, simNodes.length]);

  // Rank-based reveal: sort nodes by x, assign evenly-spaced thresholds
  const revealRank = useMemo(() => {
    const positioned = simNodes.filter((n) => n.x != null);
    if (positioned.length === 0) return new Map<string, number>();
    const sorted = [...positioned].sort((a, b) => a.x! - b.x!);
    const map = new Map<string, number>();
    sorted.forEach((n, i) => {
      map.set(n.id, sorted.length > 1 ? i / (sorted.length - 1) : 0);
    });
    return map;
  }, [simNodes]);

  // Zoom handler (wheel)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * delta));
    });
  }, []);

  // Pan handlers (mouse drag on background) + node drag
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const nodeEl = (e.target as HTMLElement).closest("[data-graph-node]");
    if (nodeEl) {
      // Start tracking a potential node drag
      const nodeId = nodeEl.getAttribute("data-node-id");
      if (!nodeId) return;
      const node = simNodesRef.current.find((n) => n.id === nodeId);
      if (!node || node.x === undefined || node.y === undefined) return;
      draggingNodeId.current = nodeId;
      dragStartPointer.current = { x: e.clientX, y: e.clientY };
      dragStartNodePos.current = { x: node.x, y: node.y };
      hasDraggedPastThreshold.current = false;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOffset.current = { x: pan.x, y: pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Node dragging
    if (draggingNodeId.current) {
      const dx = e.clientX - dragStartPointer.current.x;
      const dy = e.clientY - dragStartPointer.current.y;
      if (!hasDraggedPastThreshold.current) {
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
        hasDraggedPastThreshold.current = true;
      }
      const z = zoomRef.current;
      const newX = dragStartNodePos.current.x + dx / z;
      const newY = dragStartNodePos.current.y + dy / z;
      const id = draggingNodeId.current;
      positionCacheRef.current.set(id, { x: newX, y: newY });
      setSimNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, x: newX, y: newY } : n)),
      );
      return;
    }
    // Background panning
    if (!isPanning.current) return;
    setPan({
      x: panOffset.current.x + (e.clientX - panStart.current.x),
      y: panOffset.current.y + (e.clientY - panStart.current.y),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    if (draggingNodeId.current) {
      if (!hasDraggedPastThreshold.current) {
        // Pointer barely moved — treat as a click
        const node = simNodesRef.current.find((n) => n.id === draggingNodeId.current);
        if (node) onNodeClickRef.current?.(node);
      }
      draggingNodeId.current = null;
      hasDraggedPastThreshold.current = false;
      return;
    }
    isPanning.current = false;
  }, []);

  const handleReset = useCallback(() => {
    setZoom(0.75);
    setPan({ x: 0, y: 0 });
    // Restore nodes to their original simulation positions
    if (originalPositionsRef.current.size > 0) {
      const originals = originalPositionsRef.current;
      positionCacheRef.current = new Map(originals);
      setSimNodes((prev) =>
        prev.map((n) => {
          const pos = originals.get(n.id);
          return pos ? { ...n, x: pos.x, y: pos.y } : n;
        }),
      );
    }
  }, []);

  // Fast node lookup — edges use this to read current positions after drags
  const nodeMap = useMemo(() => {
    const map = new Map<string, SimNode>();
    simNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [simNodes]);

  // Determine which nodes/links are in the ancestor path
  const activeSet = useMemo(() => {
    const set = new Set<string>();
    if (highlightedNodeIds) {
      highlightedNodeIds.forEach((id) => set.add(id));
    }
    return set;
  }, [highlightedNodeIds]);

  void useMemo(() => {
    if (!highlightedNodeIds || highlightedNodeIds.size === 0) return null;
    return null;
  }, [highlightedNodeIds]);

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
              // Resolve from nodeMap so edges follow dragged nodes
              const srcId = typeof link.source === "object" ? (link.source as SimNode).id : link.source;
              const tgtId = typeof link.target === "object" ? (link.target as SimNode).id : link.target;
              const source = nodeMap.get(srcId);
              const target = nodeMap.get(tgtId);
              if (!source || !target || source.x == null || target.x == null || source.y == null || target.y == null) return null;

              const isSourceRel = activeSet.has(source.id);
              const isTargetRel = activeSet.has(target.id);
              const isPath = isSourceRel && isTargetRel;

              // Shorten line to stop at edge of nodes (so arrowhead is visible)
              const targetSize = getNodeRadius(target.label, target.relevance || 0.6);
              const sourceSize = getNodeRadius(source.label, source.relevance || 0.6);
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

              // Edge reveals after both endpoint nodes
              const sourceRank = revealRank.get(source.id) ?? 0;
              const targetRank = revealRank.get(target.id) ?? 0;
              const edgeRevealed = revealProgress > Math.max(sourceRank, targetRank);
              const particleColor = isPath ? "#3b82f6" : "#94a3b8";

              return (
                <g key={`link-${i}`}>
                  <path
                    d={d}
                    stroke={isPath ? "#3b82f6" : "#64748b"}
                    strokeWidth={isPath ? 2.5 : 1.5}
                    opacity={edgeRevealed ? (isPath ? 1 : activeSet.size > 0 ? 0.15 : 0.8) : 0}
                    fill="none"
                    markerEnd={isPath ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                    style={{ transition: "opacity 0.4s ease-out" }}
                  />
                  {/* Particle flowing along edge */}
                  {edgeRevealed && (
                    <motion.circle
                      r="2.5"
                      fill={particleColor}
                      initial={{ offsetDistance: '0%', opacity: 0 }}
                      animate={{ offsetDistance: ['0%', '100%'], opacity: [0, 0.5, 0.5, 0] }}
                      transition={{
                        duration: 3 + (i % 5) * 0.4,
                        delay: i * 0.2,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                      style={{ offsetPath: `path("${d}")` } as React.CSSProperties}
                    />
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* DOM layer for nodes */}
        <div className="absolute inset-0 pointer-events-none" data-graph-nodes>
          {simNodes.map((node) => {
            if (node.x === undefined || node.y === undefined) return null;
            const size = getNodeRadius(node.label, node.relevance || 0.6);
            const borderColor = confidenceToNodeBorder(node.confidence ?? 0);
            const isInSet = activeSet.has(node.id);
            const hasSelection = activeSet.size > 0;
            const isDimmed = hasSelection && !isInSet;
            const isActive = node.id === activeConceptId;
            const glowColor = isActive ? COLOR_HEX.active : borderColor;

            // 4-bucket fill matching heatmap: orange / yellow / green / gray
            const baseFill = confidenceToNodeFill(node.confidence ?? 0);

            // Node reveals based on its rank in the left-to-right order
            const nodeRank = revealRank.get(node.id) ?? 0;
            const nodeRevealed = revealProgress > nodeRank;
            const targetOpacity = nodeRevealed ? (isDimmed ? 0.2 : 1) : 0;
            const targetScale = nodeRevealed
              ? (isActive ? 1.25 : isInSet && !isDimmed ? 1.08 : 1)
              : 0;

            return (
              <motion.div
                key={node.id}
                initial={false}
                animate={{
                  opacity: targetOpacity,
                  scale: targetScale,
                  x: node.x - size,
                  y: node.y - size,
                }}
                transition={{
                  opacity: { duration: 0.4 },
                  scale: { duration: 0.3 },
                  x: { duration: draggingNodeId.current === node.id ? 0.06 : 0.4 },
                  y: { duration: draggingNodeId.current === node.id ? 0.06 : 0.4 },
                }}
                data-graph-node
                data-node-id={node.id}
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
                    className={`font-[family-name:var(--font-comfortaa)] font-semibold leading-[1.15] transition-colors ${
                      isInSet || isActive ? "text-gray-900" : "text-gray-700"
                    }`}
                    style={{
                      fontSize: `${NODE_FONT_SIZE}px`,
                      wordBreak: "keep-all",
                      overflowWrap: "normal",
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

      {/* Zoom controls + reset */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5">
        <button
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.25))}
          className="p-2 rounded-lg bg-white/70 hover:bg-gray-100 text-gray-400 border border-gray-200/80 backdrop-blur-md transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z * 0.8))}
          className="p-2 rounded-lg bg-white/70 hover:bg-gray-100 text-gray-400 border border-gray-200/80 backdrop-blur-md transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
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
