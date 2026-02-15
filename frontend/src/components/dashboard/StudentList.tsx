"use client";

import { useRouter } from "next/navigation";

export interface StudentSummary {
  id: string;
  name: string;
  masteryDistribution: { green: number; lime: number; yellow: number; orange: number; gray: number };
}

interface StudentListProps {
  students: StudentSummary[];
}

export default function StudentList({ students }: StudentListProps) {
  const router = useRouter();

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white border border-gray-200/80 overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-sm font-medium text-gray-800 tracking-tight">
          Students
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        {students.length === 0 && (
          <p className="text-sm text-gray-400 px-2">No students</p>
        )}
        {students.map((s) => (
          <button
            key={s.id}
            onClick={() => router.push(`/student/${s.id}`)}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-gray-50 transition-all duration-200 group"
          >
            <span className="flex-1 text-gray-600 group-hover:text-gray-900 transition-colors tracking-tight font-medium">
              {s.name}
            </span>
            <div className="flex gap-1">
              {([
                { key: "green", bg: "#4ade80" },
                { key: "lime", bg: "#a3e635" },
                { key: "yellow", bg: "#facc15" },
                { key: "orange", bg: "#fb923c" },
                { key: "gray", bg: "#cbd5e1" },
              ] as const).map(({ key, bg }) => {
                const count = s.masteryDistribution[key] ?? 0;
                if (count === 0) return null;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{
                      backgroundColor: bg,
                      width: 20,
                      height: 20,
                    }}
                  >
                    {count}
                  </div>
                );
              })}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
