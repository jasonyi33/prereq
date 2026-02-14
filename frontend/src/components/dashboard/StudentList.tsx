"use client";

import { useRouter } from "next/navigation";
import { COLOR_HEX } from "@/lib/colors";

export interface StudentSummary {
  id: string;
  name: string;
  masteryDistribution: { green: number; yellow: number; red: number; gray: number };
}

interface StudentListProps {
  students: StudentSummary[];
}

export default function StudentList({ students }: StudentListProps) {
  const router = useRouter();

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
          Students
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        {students.length === 0 && (
          <p className="text-sm text-slate-400 px-2">No students</p>
        )}
        {students.map((s) => (
          <button
            key={s.id}
            onClick={() => router.push(`/student/${s.id}`)}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-slate-50 transition-all duration-200 group"
          >
            <span className="flex-1 text-slate-600 group-hover:text-slate-900 transition-colors tracking-tight font-medium">
              {s.name}
            </span>
            <div className="flex gap-1">
              {(["green", "yellow", "red", "gray"] as const).map((color) => {
                const count = s.masteryDistribution[color];
                if (count === 0) return null;
                return (
                  <div
                    key={color}
                    className="flex items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{
                      backgroundColor: color === "gray" ? "#cbd5e1" : color === "yellow" ? "#f59e0b" : COLOR_HEX[color],
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
