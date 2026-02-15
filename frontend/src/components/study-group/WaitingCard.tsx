"use client";

import { useEffect, useState } from "react";
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
    <div className="bg-white/70 backdrop-blur-2xl border border-gray-200/80 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] rounded-2xl p-8 text-center">
      <div className="flex justify-center mb-4">
        <div className="relative">
          <Loader2 className="w-16 h-16 text-gray-400 animate-spin" />
          <div className="absolute inset-0 w-16 h-16 rounded-full bg-gray-200 blur-xl animate-pulse" />
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-gray-800 mb-2">
        Finding your study partner
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Searching for someone who can help with these concepts
      </p>

      <div className="flex flex-wrap justify-center gap-2 mb-4">
        {conceptLabels.map(label => (
          <span
            key={label}
            className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full"
          >
            {label}
          </span>
        ))}
      </div>

      <p className="text-xs text-gray-400 mb-6">
        Timeout in {secondsLeft}s
      </p>

      <Button
        onClick={onCancel}
        variant="outline"
        className="w-full border-gray-300 text-gray-600 hover:bg-gray-50"
      >
        Cancel
      </Button>
    </div>
  );
}
