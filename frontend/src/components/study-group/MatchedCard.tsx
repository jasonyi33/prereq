"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, User } from "lucide-react";

interface MatchDetails {
  matchId: string;
  partner: { id: string; name: string; email?: string };
  conceptLabels: string[];
  zoomLink: string;
  complementarityScore: number;
}

interface Props {
  matchDetails: MatchDetails;
}

export default function MatchedCard({ matchDetails }: Props) {
  const { partner, conceptLabels, zoomLink, complementarityScore } = matchDetails;

  const getMatchQuality = () => {
    if (complementarityScore >= 0.6) return { label: "Excellent", color: "text-emerald-600" };
    if (complementarityScore >= 0.4) return { label: "Good", color: "text-blue-600" };
    return { label: "Fair", color: "text-slate-600" };
  };

  const matchQuality = getMatchQuality();

  return (
    <Card className="p-8 bg-white/80 backdrop-blur-sm border-slate-200 shadow-lg">
      <div className="flex justify-center mb-5">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-white" />
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-slate-800 text-center mb-1">
        Matched with {partner.name}
      </h2>
      <p className="text-sm text-slate-500 text-center mb-6">
        {matchQuality.label} match • You can help each other learn
      </p>

      {/* Concepts */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2.5">
          Focus areas
        </p>
        <div className="flex flex-wrap gap-2">
          {conceptLabels.map(label => (
            <span
              key={label}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Match quality indicator */}
      <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Match quality
          </span>
          <span className={`text-sm font-semibold ${matchQuality.color}`}>
            {matchQuality.label}
          </span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${complementarityScore * 100}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-3 leading-relaxed">
          Based on your knowledge gaps and strengths, you can effectively tutor each other.
        </p>
      </div>

      {/* Zoom link */}
      <Button
        onClick={() => window.open(zoomLink, "_blank")}
        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-3"
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        Join Study Session
      </Button>
    </Card>
  );
}
