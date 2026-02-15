"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  topic: string;
  userName: string;
  onLeave?: () => void;
}

export default function ZoomVideoCall({ topic, userName, onLeave }: Props) {
  return (
    <div className="w-full rounded-xl border border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-4 p-8" style={{ minHeight: 400 }}>
      <div className="text-center">
        <p className="text-lg font-medium text-gray-700 mb-2">Video Call: {topic}</p>
        <p className="text-sm text-gray-500">Join via Zoom link below</p>
      </div>

      {onLeave && (
        <Button
          onClick={onLeave}
          variant="outline"
          className="mt-4"
        >
          Leave Session
        </Button>
      )}
    </div>
  );
}
