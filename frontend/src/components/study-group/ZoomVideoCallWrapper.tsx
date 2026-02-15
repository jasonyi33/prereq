"use client";

import dynamic from "next/dynamic";

const ZoomVideoCall = dynamic(
  () => import("./ZoomVideoCall"),
  { ssr: false, loading: () => (
    <div className="w-full rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center" style={{ minHeight: 400 }}>
      <p className="text-sm text-gray-400">Loading video...</p>
    </div>
  )}
);

interface Props {
  topic: string;
  userName: string;
  onLeave?: () => void;
}

export default function ZoomVideoCallWrapper(props: Props) {
  return <ZoomVideoCall {...props} />;
}
