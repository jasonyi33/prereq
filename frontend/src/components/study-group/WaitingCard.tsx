"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Props {
  conceptLabels: string[];
  onCancel: () => void;
}

export default function WaitingCard({ conceptLabels, onCancel }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(30);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  return (
    <Card className="p-8 bg-white/80 backdrop-blur-sm border-slate-200 shadow-lg text-center">
      <div className="flex justify-center mb-4">
        <div className="relative">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
          <div className="absolute inset-0 w-16 h-16 rounded-full bg-blue-100 blur-xl animate-pulse" />
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-slate-800 mb-2">
        Finding your study partner
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Searching for someone who can help with these concepts
      </p>

      <div className="flex flex-wrap justify-center gap-2 mb-4">
        {conceptLabels.map(label => (
          <span
            key={label}
            className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full"
          >
            {label}
          </span>
        ))}
      </div>

      <p className="text-xs text-slate-400 mb-6">
        Timeout in {secondsLeft}s
      </p>

      <Button
        onClick={onCancel}
        variant="outline"
        className="w-full border-slate-300 text-slate-600 hover:bg-slate-50"
      >
        Cancel
      </Button>
    </Card>
  );
}
