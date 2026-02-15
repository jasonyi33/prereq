"use client";

import { useEffect, useRef, useState } from "react";
import uitoolkit from "@zoom/videosdk-ui-toolkit";
import "@zoom/videosdk-ui-toolkit/dist/videosdk-ui-toolkit.css";

interface Props {
  topic: string;
  userName: string;
  onLeave?: () => void;
}

export default function ZoomVideoCall({ topic, userName, onLeave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || joinedRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/zoom/videosdk-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, userIdentity: userName }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to get video token");
          return;
        }

        if (cancelled) return;

        const { token } = await res.json();

        joinedRef.current = true;
        await uitoolkit.joinSession(containerRef.current!, {
          videoSDKJWT: token,
          sessionName: topic,
          userName,
          features: ["video", "audio", "share", "chat"],
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to join video call");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (joinedRef.current && containerRef.current) {
        try {
          uitoolkit.closeSession(containerRef.current);
        } catch {
          // ignore cleanup errors
        }
        joinedRef.current = false;
      }
      onLeave?.();
    };
  }, [topic, userName, onLeave]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden border border-gray-200"
      style={{ minHeight: 400 }}
    />
  );
}
