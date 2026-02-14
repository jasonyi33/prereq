"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Students</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-1">
        {students.length === 0 && (
          <p className="text-sm text-muted-foreground">No students</p>
        )}
        {students.map((s) => (
          <button
            key={s.id}
            onClick={() => router.push(`/student/${s.id}`)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted transition-colors"
          >
            <span className="flex-1">{s.name}</span>
            <div className="flex gap-0.5">
              {(["green", "yellow", "red", "gray"] as const).map((color) => {
                const count = s.masteryDistribution[color];
                if (count === 0) return null;
                return (
                  <div
                    key={color}
                    className="flex items-center justify-center rounded-full text-[9px] text-white font-medium"
                    style={{
                      backgroundColor: COLOR_HEX[color],
                      width: 18,
                      height: 18,
                    }}
                  >
                    {count}
                  </div>
                );
              })}
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
