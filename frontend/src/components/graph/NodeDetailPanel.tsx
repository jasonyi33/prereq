"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COLOR_HEX } from "@/lib/colors";
import type { GraphNode } from "./KnowledgeGraph";

interface NodeDetailPanelProps {
  node: GraphNode | null;
  onClose: () => void;
}

export default function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  if (!node) return null;

  const colorHex = COLOR_HEX[node.color] || COLOR_HEX.gray;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-lg">{node.label}</CardTitle>
          {node.category && (
            <p className="text-sm text-muted-foreground">{node.category}</p>
          )}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">
          &times;
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        {node.description && <p className="text-sm">{node.description}</p>}

        <div className="flex items-center gap-2">
          <Badge style={{ backgroundColor: colorHex, color: "#fff" }}>
            {node.color}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Confidence: {(node.confidence * 100).toFixed(0)}%
          </span>
        </div>

        <Button variant="outline" size="sm" onClick={() => console.log("Find resources for:", node.label)}>
          Find Resources
        </Button>
      </CardContent>
    </Card>
  );
}
