import { NextRequest, NextResponse } from "next/server";
import { flaskPost } from "@/lib/flask";

interface Lecture {
  id: string;
  course_id: string;
  title: string;
  status: string;
}

export async function POST(req: NextRequest) {
  const { courseId, title } = await req.json();

  try {
    const data = await flaskPost<Lecture>("/api/lectures", {
      course_id: courseId,
      title,
    });

    // In demo mode, automatically start the transcript simulator
    if (process.env.DEMO_MODE === "true") {
      try {
        const { startSimulator } = await import("@server/simulator");
        startSimulator(data.id, data.course_id);
      } catch {
        // Simulator not available — that's fine
      }
    }

    return NextResponse.json({
      id: data.id,
      courseId: data.course_id,
      title: data.title,
      status: data.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create lecture" },
      { status: 500 }
    );
  }
}
