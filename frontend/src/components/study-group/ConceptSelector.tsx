"use client";

import { Button } from "@/components/ui/button";

interface ConceptOption {
  id: string;
  label: string;
  category: string;
  confidence: number;
  color: string;
}

interface Props {
  concepts: ConceptOption[];
  selectedConcepts: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  onFindPartner: () => void;
  loading: boolean;
}

export default function ConceptSelector({
  concepts,
  selectedConcepts,
  onSelectionChange,
  onFindPartner,
  loading
}: Props) {
  // Sort by confidence (weakest first) and group by mastery level
  const sorted = [...concepts].sort((a, b) => a.confidence - b.confidence);

  const needHelp = sorted.filter(c => c.confidence < 0.4);
  const learning = sorted.filter(c => c.confidence >= 0.4 && c.confidence < 0.7);
  const comfortable = sorted.filter(c => c.confidence >= 0.7);

  const toggleConcept = (id: string) => {
    const newSet = new Set(selectedConcepts);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    onSelectionChange(newSet);
  };

  const renderConcept = (concept: ConceptOption) => {
    const percentage = Math.round(concept.confidence * 100);
    const isSelected = selectedConcepts.has(concept.id);

    return (
      <label
        key={concept.id}
        className={`block p-3 rounded-lg border cursor-pointer transition-all ${
          isSelected
            ? "border-gray-400 bg-gray-50"
            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
        }`}
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleConcept(concept.id)}
            className="mt-0.5 w-4 h-4 text-gray-800 rounded focus:ring-2 focus:ring-gray-400 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="text-sm font-medium text-gray-700">
                {concept.label}
              </span>
              <span className="text-xs text-gray-400 font-mono tabular-nums flex-shrink-0">
                {percentage}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: percentage < 40 ? '#ef4444' : percentage < 70 ? '#eab308' : '#22c55e'
                }}
              />
            </div>
          </div>
        </div>
      </label>
    );
  };

  return (
    <div className="bg-white/70 backdrop-blur-2xl border border-gray-200/80 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] rounded-2xl p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-1.5">
          What do you want to work on?
        </h2>
        <p className="text-sm text-gray-500">
          Pick topics where you need help. We'll find someone who can teach you.
        </p>
      </div>

      <div className="space-y-5 max-h-[420px] overflow-y-auto mb-6 pr-2">
        {needHelp.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="h-2 w-2 rounded-full bg-red-400" />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Need help with
              </p>
            </div>
            <div className="space-y-2">
              {needHelp.map(renderConcept)}
            </div>
          </div>
        )}

        {learning.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="h-2 w-2 rounded-full bg-yellow-400" />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Still learning
              </p>
            </div>
            <div className="space-y-2">
              {learning.map(renderConcept)}
            </div>
          </div>
        )}

        {comfortable.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="h-2 w-2 rounded-full bg-green-400" />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Comfortable with
              </p>
            </div>
            <div className="space-y-2">
              {comfortable.map(renderConcept)}
            </div>
          </div>
        )}
      </div>

      <Button
        onClick={onFindPartner}
        disabled={selectedConcepts.size === 0 || loading}
        className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 disabled:opacity-50"
      >
        {loading ? "Searching..." : `Find Study Partner${selectedConcepts.size > 0 ? ` (${selectedConcepts.size})` : ""}`}
      </Button>
    </div>
  );
}
